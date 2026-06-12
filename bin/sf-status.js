#!/usr/bin/env node
/**
 * sf-status — CLI for the Salesforce Trust Status API
 * https://api.status.salesforce.com/v1
 */

import {
  blue,
  bold,
  cyan,
  dim,
  disablePager,
  err,
  flushPager,
  fmtDate,
  gray,
  green,
  info,
  print,
  red,
  section,
  spinner,
  statusBadge,
  table,
  wrap,
  yellow,
} from "../lib/fmt.js";

import { api } from "../lib/api.js";

// ── Arg parser (zero deps) ────────────────────────────────────────────────────
const [, , cmd, ...args] = process.argv;

function flag(name) {
  return args.includes(`--${name}`);
}
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
}

const IS_VERBOSE = flag("verbose") || flag("v");
const IS_JSON = flag("json");
const WATCH_INT = parseInt(opt("interval") ?? "60", 10);

// ── Per-command help ──────────────────────────────────────────────────────────
const HELP = {
  status: `
${bold("sf-status status")} — Instance health overview

${bold("USAGE")}
  sf-status status [options]

${bold("OPTIONS")}
  --instance <key>     Single instance key
                       ${dim("Examples: NA1, NA2, CS2, CS17, EU1, AP1, IND1")}
  --product  <key>     Filter all instances by product key
                       ${dim("Examples: Sales_Cloud, Service_Cloud, Marketing_Cloud, Commerce_Cloud")}
  --watch              Auto-refresh (default: 60s, see --interval)
  --interval <secs>    Refresh interval in seconds (default: 60)
  --verbose            Show release numbers, tags, maintenance windows, services
  --json               Raw JSON output

${bold("EXAMPLES")}
  sf-status status
  sf-status status --instance NA1
  sf-status status --product Sales_Cloud
  sf-status status --watch --interval 30
  sf-status status --instance CS2 --verbose
`,

  incidents: `
${bold("sf-status incidents")} — View incidents

${bold("USAGE")}
  sf-status incidents [options]

${bold("OPTIONS")}
  --all                Include resolved incidents (last 30 days)
  --id <id>            Full detail for one incident
                       ${dim("Example: --id 12345")}
  --instance <key>     Filter by instance key
                       ${dim("Examples: NA1, CS2, EU1, AP1")}
  --service  <name>    Filter by service name (case-insensitive)
                       ${dim('Examples: "Core CRM", "Salesforce APIs", "Chatter"')}
  --since    <date>    ISO 8601 start date
                       ${dim("Examples: 2026-05-01  |  2026-05-01T00:00:00Z")}
  --limit    <n>       Max results (default: 100, max: 10000)
  --watch              Auto-refresh (active incidents only)
  --interval <secs>    Refresh interval in seconds (default: 60)
  --verbose            Show service issue, end-user impact, external IDs, events
  --json               Raw JSON output

${bold("EXAMPLES")}
  sf-status incidents
  sf-status incidents --all
  sf-status incidents --all --since 2026-05-01
  sf-status incidents --id 12345
  sf-status incidents --instance NA1 --all
  sf-status incidents --service "Core CRM" --all
  sf-status incidents --watch --interval 30
`,

  maintenances: `
${bold("sf-status maintenances")} — View scheduled and active maintenances

${bold("USAGE")}
  sf-status maintenances [options]

${bold("OPTIONS")}
  --all                Last 30 days (default shows upcoming/active only)
  --id <id>            Full detail for one maintenance
                       ${dim("Example: --id abc-123")}
  --instance <key>     Filter by instance key
                       ${dim("Examples: NA1, CS2, EU1, AP1")}
  --active             Active (in-progress) maintenances only
  --since    <date>    ISO 8601 start date
                       ${dim("Examples: 2026-06-01  |  2026-06-01T00:00:00Z")}
  --product  <key>     Filter by product key
                       ${dim("Examples: Sales_Cloud, Service_Cloud")}
  --watch              Auto-refresh
  --interval <secs>    Refresh interval in seconds (default: 60)
  --verbose            Show substrate, external IDs, system availability, release type
  --json               Raw JSON output

${bold("EXAMPLES")}
  sf-status maintenances
  sf-status maintenances --active
  sf-status maintenances --instance NA1
  sf-status maintenances --all --since 2026-06-01
  sf-status maintenances --id abc-123 --verbose
`,

  instances: `
${bold("sf-status instances")} — List all Salesforce instances

${bold("USAGE")}
  sf-status instances [options]

${bold("OPTIONS")}
  --product <key>      Filter by product key
                       ${dim("Examples: Sales_Cloud, Service_Cloud, Marketing_Cloud")}
  --tag     <id>       Filter by tag ID (numeric)
                       ${dim("Example: --tag 5")}
  --active             Active instances only
  --verbose            Show service keys, tags
  --json               Raw JSON output

${bold("EXAMPLES")}
  sf-status instances
  sf-status instances --product Sales_Cloud
  sf-status instances --active
  sf-status instances --verbose
`,

  products: `
${bold("sf-status products")} — List all Salesforce products

${bold("USAGE")}
  sf-status products [options]

${bold("OPTIONS")}
  --verbose            Show URLs, alt display names, category IDs, order
  --json               Raw JSON output

${bold("EXAMPLES")}
  sf-status products
  sf-status products --verbose
`,

  messages: `
${bold("sf-status messages")} — Active general / informational messages

${bold("USAGE")}
  sf-status messages [options]

${bold("OPTIONS")}
  --all                Include expired messages
  --watch              Auto-refresh
  --interval <secs>    Refresh interval in seconds (default: 60)
  --verbose            Show full message body (no truncation), external IDs
  --json               Raw JSON output

${bold("EXAMPLES")}
  sf-status messages
  sf-status messages --all
  sf-status messages --verbose
  sf-status messages --watch
`,
};

// ── Global help ───────────────────────────────────────────────────────────────
function usageGlobal() {
  print(`
${bold("sf-status")} — Salesforce Trust Status CLI

${bold("USAGE")}
  sf-status <command> [options]
  sf-status <command> --help      Per-command help with all flags and examples

${bold("COMMANDS")}
  ${cyan("status")}         Instance health overview (OK / incidents / maintenance)
  ${cyan("incidents")}      Active and historical incidents
  ${cyan("maintenances")}   Upcoming, active, and past maintenances
  ${cyan("instances")}      List all instances (location, release, maint window)
  ${cyan("products")}       List all Salesforce products
  ${cyan("messages")}       Active general / informational messages

${bold("GLOBAL FLAGS")}
  --verbose / -v   Show all available fields from the API
  --json           Raw JSON output (pipe-friendly)
  --watch          Auto-refresh (supported: status, incidents, maintenances, messages)
  --interval <s>   Watch refresh interval in seconds (default: 60)
  --no-color       Plain text output (also respects NO_COLOR env var)

${bold("QUICK EXAMPLES")}
  sf-status status
  sf-status status --instance NA1 --verbose
  sf-status incidents --watch --interval 30
  sf-status maintenances --instance NA1
  sf-status incidents --all --since 2026-05-01
  sf-status incidents --id 12345
  sf-status instances --product Sales_Cloud
  sf-status messages --verbose

  # Pipe to jq
  sf-status incidents --json | jq '.[].instanceKeys'
  sf-status status --instance NA1 --json | jq '.[0].status'
`);
}

// ── Watch wrapper ─────────────────────────────────────────────────────────────
async function withWatch(run, watchable = true) {
  await run();
  if (flag("watch")) {
    if (!watchable) {
      info("--watch is not supported for this command.");
      return;
    }
    disablePager(); // streaming — pager makes no sense
    info(`Watching — refreshing every ${WATCH_INT}s. Ctrl-C to stop.`);
    setInterval(async () => {
      process.stdout.write("\x1b[2J\x1b[H");
      await run().catch((e) => err(e.message));
    }, WATCH_INT * 1000);
  }
}

// ── status ────────────────────────────────────────────────────────────────────
async function cmdStatus() {
  if (flag("help") || flag("h")) {
    print(HELP.status);
    return;
  }
  const instanceKey = opt("instance");
  const product = opt("product");

  await withWatch(async () => {
    const spin = spinner("Fetching status…");
    try {
      if (instanceKey) {
        const data = await api.instanceStatus(instanceKey);
        spin.stop();
        if (IS_JSON) {
          print(JSON.stringify(data, null, 2));
          return;
        }
        renderInstanceStatuses(
          Array.isArray(data) ? data : [data],
          `Instance: ${instanceKey}`,
        );
      } else {
        const data = await api.instancesStatusPreview({
          statusOnly: false,
          products: product || undefined,
        });
        spin.stop();
        if (IS_JSON) {
          print(JSON.stringify(data, null, 2));
          return;
        }
        renderInstanceStatuses(
          data,
          product ? `Product: ${product}` : "All Instances",
        );
      }
    } catch (e) {
      spin.stop();
      throw e;
    }
  });
}

function renderInstanceStatuses(instances, title) {
  section(title);

  const counts = { OK: 0, incident: 0, maintenance: 0 };
  for (const inst of instances) {
    if (!inst.status || inst.status === "OK") counts.OK++;
    else if (inst.status.includes("INCIDENT")) counts.incident++;
    else counts.maintenance++;
  }
  print(
    `  ${green("●")} OK: ${bold(counts.OK)}   ${red("▲")} Incidents: ${bold(counts.incident)}   ${blue("◆")} Maintenance: ${bold(counts.maintenance)}   ${dim("Total: " + instances.length)}`,
  );
  print();

  const nonOK = instances.filter((i) => i.status && i.status !== "OK");
  const ok = instances.filter((i) => !i.status || i.status === "OK");

  if (nonOK.length > 0) {
    const rows = nonOK.map((i) => {
      const ver =
        [i.releaseVersion, i.releaseNumber].filter(Boolean).join(" · ") ||
        gray("—");
      const row = [
        bold(i.key),
        statusBadge(i.status),
        i.location ?? gray("—"),
        ver,
        i.maintenanceWindow || gray("—"),
      ];
      if (IS_VERBOSE)
        row.push(
          i.environment ?? gray("—"),
          (i.Services ?? [])
            .filter((s) => s.isCore)
            .map((s) => s.key)
            .join(", ") || gray("—"),
        );
      return row;
    });
    const headers = [
      "Instance",
      "Status",
      "Location",
      "Version",
      "Maint. Window",
    ];
    if (IS_VERBOSE) headers.push("Environment", "Core Services");
    print(table(headers, rows));
    print();

    for (const inst of nonOK) {
      if (inst.Incidents?.length) {
        print(
          `  ${red("▲")} ${bold(inst.key)} — ${inst.Incidents.length} incident(s):`,
        );
        for (const inc of inst.Incidents) {
          const msg = extractMsg(inc.message);
          print(
            `     ${dim("#" + inc.id)} ${bold(msg || gray("(no summary)"))}`,
          );
          print(
            `     ${gray("  isCore:")} ${inc.isCore ? red("yes") : "no"}   ${gray("affectsAll:")} ${inc.affectsAll ? yellow("yes") : "no"}`,
          );
          for (const impact of inc.IncidentImpacts ?? []) {
            const active = !impact.endTime;
            print(
              `     ${active ? red("●") : gray("○")} ${impact.type}  ${gray("started:")} ${fmtDate(impact.startTime)}  ${gray("ended:")} ${impact.endTime ? fmtDate(impact.endTime) : yellow("ongoing")}`,
            );
            if (IS_VERBOSE) {
              if (impact.serviceIssue)
                print(
                  `       ${gray("Service issue:")} ${impact.serviceIssue}`,
                );
              if (impact.endUserImpact)
                print(
                  `       ${gray("User impact:")}   ${impact.endUserImpact}`,
                );
            }
          }
          if (IS_VERBOSE && inc.serviceKeys?.length)
            print(`     ${gray("Services:")} ${inc.serviceKeys.join(", ")}`);
        }
      }
      if (inst.Maintenances?.length) {
        print(
          `  ${blue("◆")} ${bold(inst.key)} — ${inst.Maintenances.length} maintenance(s):`,
        );
        for (const m of inst.Maintenances) {
          const name = m.name ?? extractMsg(m.message);
          print(`     ${dim("#" + m.id)} ${bold(name || gray("(no name)"))}`);
          print(
            `     ${gray("  Scheduled:")} ${fmtDate(m.plannedStartTime)} → ${fmtDate(m.plannedEndTime)}`,
          );
          if (IS_VERBOSE) {
            if (m.externalMaintenanceType)
              print(
                `     ${gray("  Type:")}      ${m.externalMaintenanceType}`,
              );
            if (m.releaseType)
              print(`     ${gray("  Release:")}   ${m.releaseType}`);
            if (m.substrate)
              print(`     ${gray("  Substrate:")} ${m.substrate}`);
            if (m.externalId)
              print(`     ${gray("  ExternalID:")} ${m.externalId}`);
          }
        }
      }
      if (IS_VERBOSE && inst.GeneralMessages?.length) {
        print(
          `  ${cyan("◉")} ${bold(inst.key)} — ${inst.GeneralMessages.length} general message(s):`,
        );
        for (const gm of inst.GeneralMessages) {
          print(
            `     ${bold(gm.subject ?? "(no subject)")}  ${gray(fmtDate(gm.startDate))}`,
          );
          if (gm.body) print(`     ${dim(gm.body)}`);
        }
      }
      if (IS_VERBOSE && inst.tags?.length) {
        print(
          `     ${gray("Tags:")} ${inst.tags.map((t) => t.value).join(", ")}`,
        );
      }
    }
  }

  if (ok.length > 0) {
    print(`  ${green("●")} ${ok.length} instance(s) fully operational`);
    if (ok.length <= 5 || IS_VERBOSE) {
      for (const i of ok) {
        const ver = [i.releaseVersion, i.releaseNumber]
          .filter(Boolean)
          .join(" · ");
        const mw = i.maintenanceWindow
          ? `  ${gray("maint window:")} ${dim(i.maintenanceWindow)}`
          : "";
        print(
          `  ${gray("  ")}${bold(i.key)}${ver ? `  ${gray("version:")} ${cyan(ver)}` : ""}${mw}`,
        );
      }
    } else {
      const keys = ok.map((i) => i.key);
      if (keys.length <= 30) {
        print(`  ${gray(keys.join(", "))}`);
      } else {
        print(
          `  ${gray(keys.slice(0, 30).join(", "))} ${dim(`+${keys.length - 30} more`)}`,
        );
      }
    }
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  print(
    `\n  ${dim(`Timestamps are in your local timezone (${tz}). Maintenance windows are shown as provided by Salesforce.`)}`,
  );
}

// ── incidents ─────────────────────────────────────────────────────────────────
async function cmdIncidents() {
  if (flag("help") || flag("h")) {
    print(HELP.incidents);
    return;
  }
  const id = opt("id");
  const instance = opt("instance");
  const service = opt("service");
  const since = opt("since");
  const limit = opt("limit") ?? "100";
  const all = flag("all");

  await withWatch(async () => {
    const spin = spinner("Fetching incidents…");
    try {
      if (id) {
        const data = await api.incident(id);
        spin.stop();
        if (IS_JSON) {
          print(JSON.stringify(data, null, 2));
          return;
        }
        renderIncidentDetail(data);
        return;
      }

      let data;
      if (!all && !instance && !service && !since) {
        data = await api.activeIncidents();
      } else {
        data = await api.incidents({
          instance: instance || undefined,
          service: service || undefined,
          startTime: since || undefined,
          limit: limit,
        });
      }
      spin.stop();
      if (IS_JSON) {
        print(JSON.stringify(data, null, 2));
        return;
      }

      const label =
        !all && !instance && !service && !since
          ? "Active Incidents"
          : "Incidents";
      section(label);

      if (!data.length) {
        print(`  ${green("✓")} No incidents found.`);
        return;
      }

      const rows = data.map((inc) => {
        const activeImpact = inc.IncidentImpacts?.find((i) => !i.endTime);
        const impact = activeImpact ?? inc.IncidentImpacts?.[0];
        const severity = impact?.type ?? gray("—");
        const start = fmtDate(impact?.startTime);
        const end = impact?.endTime
          ? fmtDate(impact.endTime)
          : yellow("ongoing");
        const msg = extractMsg(inc.message);
        const insts = fmtKeyList(inc.instanceKeys);
        const row = [
          String(inc.id),
          severity,
          msg || gray("(no summary)"),
          insts,
          start,
          end,
        ];
        if (IS_VERBOSE)
          row.push(
            inc.isCore ? red("core") : gray("no"),
            inc.affectsAll ? yellow("all") : gray("no"),
            (inc.serviceKeys ?? []).slice(0, 2).join(", ") || gray("—"),
            inc.externalId ?? gray("—"),
          );
        return row;
      });

      const headers = [
        "ID",
        "Severity",
        "Summary",
        "Instances",
        "Start",
        "End/Status",
      ];
      if (IS_VERBOSE)
        headers.push("Core", "AffectsAll", "Services", "External ID");
      print(table(headers, rows));
      print(
        `\n  ${dim(`${data.length} incident(s) — use --id <id> for full detail`)}`,
      );
    } catch (e) {
      spin.stop();
      throw e;
    }
  });
}

function renderIncidentDetail(inc) {
  section(`Incident #${inc.id}`);
  const msg = extractMsg(inc.message);
  if (msg) print(`  ${bold(msg)}`);
  print(
    `  ${gray("Core:")} ${inc.isCore ? red("Yes") : green("No")}   ${gray("Affects all:")} ${inc.affectsAll ? yellow("Yes") : "No"}`,
  );
  if (inc.externalId) print(`  ${gray("External ID:")} ${inc.externalId}`);
  if (inc.instanceKeys?.length)
    print(`  ${gray("Instances:")}  ${cyan(inc.instanceKeys.join(", "))}`);
  if (inc.serviceKeys?.length)
    print(`  ${gray("Services:")}   ${inc.serviceKeys.join(", ")}`);
  if (inc.additionalInformation) {
    print(`\n  ${bold("Additional Information:")}`);
    print(`  ${wrap(inc.additionalInformation, 80, "  ")}`);
  }

  if (inc.IncidentImpacts?.length) {
    print(`\n  ${bold("Impacts:")}`);
    for (const impact of inc.IncidentImpacts) {
      const active = !impact.endTime;
      print(
        `    ${active ? red("●") : gray("○")} [${impact.type}]  ${fmtDate(impact.startTime)} → ${impact.endTime ? fmtDate(impact.endTime) : yellow("ongoing")}`,
      );
      if (impact.serviceIssue)
        print(`       ${gray("Service issue:")} ${impact.serviceIssue}`);
      if (impact.endUserImpact)
        print(`       ${gray("User impact:")}   ${impact.endUserImpact}`);
      if (IS_VERBOSE) {
        if (impact.id) print(`       ${gray("Impact ID:")}     ${impact.id}`);
        if (impact.createdAt)
          print(
            `       ${gray("Created:")}       ${fmtDate(impact.createdAt)}`,
          );
        if (impact.updatedAt)
          print(
            `       ${gray("Updated:")}       ${fmtDate(impact.updatedAt)}`,
          );
      }
    }
  }

  if (inc.IncidentEvents?.length) {
    print(
      `\n  ${bold("Timeline:")} ${dim(`(${inc.IncidentEvents.length} events)`)}`,
    );
    const sorted = [...inc.IncidentEvents].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    for (const ev of sorted) {
      print(`    ${gray(fmtDate(ev.createdAt))}  ${cyan("[" + ev.type + "]")}`);
      if (ev.message) print(`      ${ev.message}`);
      if (IS_VERBOSE && ev.updatedAt)
        print(`      ${gray("updated: " + fmtDate(ev.updatedAt))}`);
    }
  }
}

// ── maintenances ──────────────────────────────────────────────────────────────
async function cmdMaintenances() {
  if (flag("help") || flag("h")) {
    print(HELP.maintenances);
    return;
  }
  const id = opt("id");
  const instance = opt("instance");
  const since = opt("since");
  const product = opt("product");
  const active = flag("active");
  const all = flag("all");

  await withWatch(async () => {
    const spin = spinner("Fetching maintenances…");
    try {
      if (id) {
        const data = await api.maintenance(id);
        spin.stop();
        if (IS_JSON) {
          print(JSON.stringify(data, null, 2));
          return;
        }
        renderMaintenanceDetail(data);
        return;
      }

      let data;
      if (!all && !instance && !since) {
        data = await api.maintenancesPreview({
          isActive: active || undefined,
          products: product || undefined,
        });
      } else {
        data = await api.maintenances({
          instance: instance || undefined,
          startTime: since || undefined,
          product: product || undefined,
          limit: 100,
        });
      }
      spin.stop();
      if (IS_JSON) {
        print(JSON.stringify(data, null, 2));
        return;
      }

      section("Maintenances");
      if (!data.length) {
        print(`  ${green("✓")} No maintenances found.`);
        return;
      }

      const rows = data.map((m) => {
        const name = m.name ?? extractMsg(m.message) ?? gray("—");
        const start = fmtDate(m.plannedStartTime);
        const end = m.plannedEndTime ? fmtDate(m.plannedEndTime) : gray("TBD");
        const insts = fmtKeyList(m.instanceKeys);
        const type = m.externalMaintenanceType ?? m.releaseType ?? gray("—");
        const row = [String(m.id), name, type, insts, start, end];
        if (IS_VERBOSE)
          row.push(
            m.isCore ? red("core") : gray("no"),
            m.substrate ?? gray("—"),
            m.externalId ?? gray("—"),
          );
        return row;
      });

      const headers = ["ID", "Name", "Type", "Instances", "Start", "End"];
      if (IS_VERBOSE) headers.push("Core", "Substrate", "External ID");
      print(table(headers, rows));
      print(
        `\n  ${dim(`${data.length} maintenance(s) — use --id <id> for full detail`)}`,
      );
    } catch (e) {
      spin.stop();
      throw e;
    }
  });
}

function renderMaintenanceDetail(m) {
  section(`Maintenance #${m.id}`);
  const name = m.name ?? extractMsg(m.message);
  if (name) print(`  ${bold(name)}`);
  print(
    `  ${gray("Core:")} ${m.isCore ? red("Yes") : green("No")}   ${gray("Affects all:")} ${m.affectsAll ? yellow("Yes") : "No"}`,
  );
  print(`  ${gray("Type:")}      ${m.externalMaintenanceType ?? gray("—")}`);
  print(`  ${gray("Release:")}   ${m.releaseType ?? gray("—")}`);
  print(`  ${gray("Substrate:")} ${m.substrate ?? gray("—")}`);
  print(
    `  ${gray("Scheduled:")} ${fmtDate(m.plannedStartTime)} → ${fmtDate(m.plannedEndTime)}`,
  );
  if (m.externalId) print(`  ${gray("External ID:")} ${m.externalId}`);
  if (m.instanceKeys?.length)
    print(`  ${gray("Instances:")}  ${cyan(m.instanceKeys.join(", "))}`);
  if (m.serviceKeys?.length)
    print(`  ${gray("Services:")}   ${m.serviceKeys.join(", ")}`);
  if (m.additionalInformation) {
    print(`\n  ${bold("Additional Information:")}`);
    print(`  ${wrap(m.additionalInformation, 80, "  ")}`);
  }

  if (m.MaintenanceImpacts?.length) {
    print(`\n  ${bold("Impacts:")}`);
    for (const impact of m.MaintenanceImpacts) {
      const active = !impact.endTime;
      print(
        `    ${active ? blue("●") : gray("○")} [${impact.type}]  ${fmtDate(impact.startTime)} → ${impact.endTime ? fmtDate(impact.endTime) : yellow("ongoing")}`,
      );
      if (impact.systemAvailability)
        print(`       ${gray("Availability:")} ${impact.systemAvailability}`);
      if (IS_VERBOSE) {
        if (impact.id) print(`       ${gray("Impact ID:")} ${impact.id}`);
        if (impact.createdAt)
          print(`       ${gray("Created:")}   ${fmtDate(impact.createdAt)}`);
        if (impact.updatedAt)
          print(`       ${gray("Updated:")}   ${fmtDate(impact.updatedAt)}`);
      }
    }
  }
}

// ── instances ─────────────────────────────────────────────────────────────────
async function cmdInstances() {
  if (flag("help") || flag("h")) {
    print(HELP.instances);
    return;
  }
  const product = opt("product");
  const tag = opt("tag");
  const activeOnly = flag("active");

  const spin = spinner("Fetching instances…");
  try {
    let data = await api.instances({
      products: product || undefined,
      tags: tag ? [tag] : undefined,
    });
    spin.stop();
    if (activeOnly) data = data.filter((i) => i.isActive);
    if (IS_JSON) {
      print(JSON.stringify(data, null, 2));
      return;
    }

    section(product ? `Instances — ${product}` : "All Instances");

    const rows = data.map((i) => {
      const ver =
        [i.releaseVersion, i.releaseNumber].filter(Boolean).join(" · ") ||
        gray("—");
      const row = [
        bold(i.key),
        i.location ?? gray("—"),
        i.environment ?? gray("—"),
        ver,
        i.isActive ? green("✓") : gray("✗"),
        i.maintenanceWindow ?? gray("—"),
      ];
      if (IS_VERBOSE)
        row.push(
          (i.serviceKeys ?? []).join(", ") || gray("—"),
          (i.tags ?? []).map((t) => t.value).join(", ") || gray("—"),
        );
      return row;
    });

    const headers = [
      "Key",
      "Location",
      "Environment",
      "Version",
      "Active",
      "Maint. Window",
    ];
    if (IS_VERBOSE) headers.push("Services", "Tags");
    print(table(headers, rows));
    print(`\n  ${dim(`${data.length} instance(s)`)}`);
  } catch (e) {
    spin.stop();
    throw e;
  }
}

// ── products ──────────────────────────────────────────────────────────────────
async function cmdProducts() {
  if (flag("help") || flag("h")) {
    print(HELP.products);
    return;
  }

  const spin = spinner("Fetching products…");
  try {
    const data = await api.products();
    spin.stop();
    if (IS_JSON) {
      print(JSON.stringify(data, null, 2));
      return;
    }

    section("Salesforce Products");
    const rows = data.map((p) => {
      const row = [
        bold(p.key ?? gray("—")),
        p.name ?? gray("—"),
        p.parentName ?? gray("—"),
        p.isActive ? green("✓") : gray("✗"),
        p.incidentCount ? red(String(p.incidentCount)) : green("0"),
        p.maintenanceCount ? yellow(String(p.maintenanceCount)) : green("0"),
      ];
      if (IS_VERBOSE)
        row.push(
          p.altDisplayName ?? gray("—"),
          p.url ?? gray("—"),
          p.productCategoryId ?? gray("—"),
          String(p.order ?? gray("—")),
        );
      return row;
    });

    const headers = [
      "Key",
      "Name",
      "Category",
      "Active",
      "Incidents",
      "Maintenances",
    ];
    if (IS_VERBOSE) headers.push("Alt Name", "URL", "Category ID", "Order");
    print(table(headers, rows));
    print(`\n  ${dim(`${data.length} product(s)`)}`);
  } catch (e) {
    spin.stop();
    throw e;
  }
}

// ── messages ──────────────────────────────────────────────────────────────────
async function cmdMessages() {
  if (flag("help") || flag("h")) {
    print(HELP.messages);
    return;
  }
  const all = flag("all");

  await withWatch(async () => {
    const spin = spinner("Fetching messages…");
    try {
      const data = await api.generalMessages();
      spin.stop();
      if (IS_JSON) {
        print(JSON.stringify(data, null, 2));
        return;
      }

      section("General Messages");
      const msgs = all
        ? data
        : data.filter((m) => !m.endDate || new Date(m.endDate) > new Date());

      if (!msgs.length) {
        print(`  ${green("✓")} No ${all ? "" : "active "}general messages.`);
        return;
      }

      for (const m of msgs) {
        const expired = m.endDate && new Date(m.endDate) <= new Date();
        print(
          `  ${expired ? gray("◉") : cyan("◉")} ${bold(m.subject ?? "(no subject)")}  ${dim("#" + m.id)}`,
        );
        print(
          `     ${gray("Active:")} ${fmtDate(m.startDate)} → ${m.endDate ? fmtDate(m.endDate) : yellow("ongoing")}`,
        );
        if (IS_VERBOSE) {
          if (m.externalId)
            print(`     ${gray("External ID:")} ${m.externalId}`);
          if (m.isVisibleWhenClosed !== undefined)
            print(
              `     ${gray("Visible when closed:")} ${m.isVisibleWhenClosed}`,
            );
        }
        if (m.body) {
          print();
          // Full body in verbose, otherwise wrap to 100 chars (no hard cutoff)
          print(`  ${IS_VERBOSE ? m.body : wrap(m.body, 100, "  ")}`);
        }
        print();
      }
      print(`  ${dim(`${msgs.length} message(s)`)}`);
    } catch (e) {
      spin.stop();
      throw e;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractMsg(msg) {
  if (!msg) return "";
  return msg.summary ?? msg.en ?? msg.default ?? Object.values(msg)[0] ?? "";
}

function fmtKeyList(keys = []) {
  if (!keys.length) return gray("—");
  if (IS_VERBOSE) return keys.join(", ");
  const shown = keys.slice(0, 4).join(", ");
  return keys.length > 4 ? shown + dim(` +${keys.length - 4}`) : shown;
}

// ── Router ────────────────────────────────────────────────────────────────────
async function main() {
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    disablePager();
    usageGlobal();
    process.exit(0);
  }

  try {
    switch (cmd) {
      case "status":
        await cmdStatus();
        break;
      case "incidents":
        await cmdIncidents();
        break;
      case "maintenances":
        await cmdMaintenances();
        break;
      case "instances":
        await cmdInstances();
        break;
      case "products":
        await cmdProducts();
        break;
      case "messages":
        await cmdMessages();
        break;
      default:
        err(`Unknown command: ${bold(cmd)}`);
        print(`  Run ${cyan("sf-status --help")} to see available commands.`);
        process.exit(1);
    }
    flushPager();
  } catch (e) {
    err(e.message);
    process.exit(1);
  }
}

main();
