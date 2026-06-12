import { stderr, stdout } from "process";

import { spawnSync } from "child_process";

// ── ANSI colours ────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgGreen: "\x1b[42m",
};

const noColor =
  !stdout.isTTY ||
  process.env.NO_COLOR != null ||
  process.argv.includes("--no-color");
export const col = noColor
  ? Object.fromEntries(Object.keys(c).map((k) => [k, ""]))
  : c;

export const bold = (s) => `${col.bold}${s}${col.reset}`;
export const dim = (s) => `${col.dim}${s}${col.reset}`;
export const red = (s) => `${col.red}${s}${col.reset}`;
export const green = (s) => `${col.green}${s}${col.reset}`;
export const yellow = (s) => `${col.yellow}${s}${col.reset}`;
export const blue = (s) => `${col.blue}${s}${col.reset}`;
export const cyan = (s) => `${col.cyan}${s}${col.reset}`;
export const gray = (s) => `${col.gray}${s}${col.reset}`;

// ── Spinner ─────────────────────────────────────────────────────────────────
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠣", "⠏"];
export function spinner(msg) {
  if (!stderr.isTTY || process.env.NO_COLOR) return { stop: () => {} };
  let i = 0;
  const t = setInterval(() => {
    stderr.write(
      `\r${col.cyan}${FRAMES[i++ % FRAMES.length]}${col.reset} ${msg}`,
    );
  }, 80);
  return {
    stop: (final) => {
      clearInterval(t);
      stderr.write("\r\x1b[K"); // clear line
      if (final) stderr.write(final + "\n");
    },
  };
}

// ── Status badge ─────────────────────────────────────────────────────────────
export function statusBadge(status) {
  const map = {
    OK: `${col.green}● OK${col.reset}`,
    MAJOR_INCIDENT_CORE: `${col.red}▲ MAJOR INCIDENT (core)${col.reset}`,
    MINOR_INCIDENT_CORE: `${col.yellow}▲ MINOR INCIDENT (core)${col.reset}`,
    MAINTENANCE_CORE: `${col.blue}◆ MAINTENANCE (core)${col.reset}`,
    MAJOR_INCIDENT_NONCORE: `${col.red}△ MAJOR INCIDENT${col.reset}`,
    MINOR_INCIDENT_NONCORE: `${col.yellow}△ MINOR INCIDENT${col.reset}`,
    MAINTENANCE_NONCORE: `${col.blue}◇ MAINTENANCE${col.reset}`,
  };
  return map[status] ?? `${col.gray}${status}${col.reset}`;
}

// ── Simple table ─────────────────────────────────────────────────────────────
export function table(headers, rows, opts = {}) {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce(
      (m, r) => Math.max(m, stripAnsi(String(r[i] ?? "")).length),
      0,
    );
    return Math.max(stripAnsi(h).length, maxRow, opts.minWidth ?? 0);
  });

  const sep = "─";
  const border = colWidths.map((w) => sep.repeat(w + 2)).join("┼");
  const line = `┌${colWidths.map((w) => sep.repeat(w + 2)).join("┬")}┐`;
  const midLine = `├${border}┤`;
  const botLine = `└${colWidths.map((w) => sep.repeat(w + 2)).join("┴")}┘`;

  const fmtRow = (cells, bold_ = false) =>
    "│" +
    cells
      .map((cell, i) => {
        const s = String(cell ?? "");
        const visible = stripAnsi(s);
        const pad = colWidths[i] - visible.length;
        return ` ${bold_ ? col.bold : ""}${s}${bold_ ? col.reset : ""}${" ".repeat(Math.max(0, pad))} `;
      })
      .join("│") +
    "│";

  const out = [
    line,
    fmtRow(headers, true),
    midLine,
    ...rows.map((r) => fmtRow(r)),
    botLine,
  ];
  return out.join("\n");
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ── Misc helpers ─────────────────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return gray("—");
  const d = new Date(iso);
  return d.toLocaleString("en-CA", {
    hour12: false,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// ── Pager ─────────────────────────────────────────────────────────────────────
// Buffer all print() calls, then flush through `less -R` at exit (TTY only).
// Falls back to direct stdout when: not a TTY, --no-pager flag, --json flag,
// --watch flag (streaming), or less/pager not available on PATH.


const PAGER = process.env.PAGER ?? "less";
const USE_PAGER =
  stdout.isTTY &&
  process.platform !== "win32" &&
  !process.argv.includes("--no-pager") &&
  !process.argv.includes("--json") &&
  !process.argv.includes("--watch");

let _buf = [];
let _pagerEnabled = USE_PAGER;

export function disablePager() {
  _pagerEnabled = false;
}

export function flushPager() {
  if (!_pagerEnabled || !_buf.length) {
    // Already been writing direct — nothing to flush
    return;
  }
  const output = _buf.join("");
  _buf = [];

  // Check if output is short enough to skip the pager (fits in terminal)
  const lines = output.split("\n").length;
  const termRows = stdout.rows ?? 24;
  if (lines <= termRows) {
    stdout.write(output);
    return;
  }

  const result = spawnSync(PAGER, ["-R", "--quit-if-one-screen", "--no-init"], {
    input: output,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  });

  // If pager failed (not installed etc), fall back to direct write
  if (result.error) stdout.write(output);
}

export function print(s = "") {
  if (_pagerEnabled) {
    _buf.push(s + "\n");
  } else {
    stdout.write(s + "\n");
  }
}
export function err(s) {
  stderr.write(red("✖ ") + s + "\n");
}
export function info(s) {
  stderr.write(cyan("ℹ ") + s + "\n");
}

export function section(title) {
  print(`\n${bold(cyan("━━ "))}${bold(title)}${bold(cyan(" ━━"))}`);
}

// Word-wrap text to <width> columns, re-indenting continuation lines with <indent>
export function wrap(text, width = 100, indent = "") {
  if (!text) return "";
  const words = text.replace(/\r?\n/g, " ").split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = indent + word;
    } else {
      line = line ? line + " " + word : (lines.length ? indent : "") + word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
