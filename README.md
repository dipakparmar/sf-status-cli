# sf-status

[![CI](https://github.com/dipakparmar/sf-status-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/dipakparmar/sf-status-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sf-status.svg)](https://www.npmjs.com/package/sf-status)
[![Node.js](https://img.shields.io/node/v/sf-status)](https://www.npmjs.com/package/sf-status)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

CLI for the [Salesforce Trust Status](https://status.salesforce.com/). Check instance health, incidents, and scheduled maintenances from your terminal.

Zero dependencies - requires Node.js 22+.


## Install

```bash
bun install -g sf-status
```

Or run without installing:

```bash
bunx sf-status <command>
```


## Commands

### `status`
Instance health overview - shows OK, incident, and maintenance counts across all instances.

```bash
sf-status status                              # all instances
sf-status status --instance NA1              # single instance
sf-status status --product Sales_Cloud       # filter by product
sf-status status --instance NA1 --verbose    # full detail
sf-status status --watch --interval 30       # auto-refresh every 30s
```

### `incidents`
Active and historical incidents.

```bash
sf-status incidents                          # active only
sf-status incidents --all                    # last 30 days
sf-status incidents --id 12345               # full detail for one incident
sf-status incidents --instance NA1           # filter by instance
sf-status incidents --service "Core CRM"     # filter by service
sf-status incidents --all --since 2026-05-01 # from a specific date
sf-status incidents --watch                  # auto-refresh active incidents
```

### `maintenances`
Upcoming, active, and past scheduled maintenances.

```bash
sf-status maintenances                       # upcoming and active
sf-status maintenances --active              # in-progress only
sf-status maintenances --all                 # last 30 days
sf-status maintenances --id abc-123          # full detail
sf-status maintenances --instance CS2        # filter by instance
sf-status maintenances --all --since 2026-06-01
```

### `instances`
List all Salesforce instances with location, release, and maintenance window.

```bash
sf-status instances
sf-status instances --product Sales_Cloud
sf-status instances --active                 # active instances only
sf-status instances --verbose                # include release numbers, services, tags
```

### `products`
List all Salesforce products with incident and maintenance counts.

```bash
sf-status products
sf-status products --verbose                 # include URLs, alt names, category IDs
```

### `messages`
Active general and informational messages from Salesforce.

```bash
sf-status messages
sf-status messages --all                     # include expired messages
sf-status messages --verbose                 # full message body
sf-status messages --watch                   # auto-refresh
```


## Global flags

| Flag | Description |
|------|-------------|
| `--verbose` | Show all available fields from the API |
| `--json` | Raw JSON output - pipe-friendly |
| `--watch` | Auto-refresh (supported: `status`, `incidents`, `maintenances`, `messages`) |
| `--interval <secs>` | Refresh interval in seconds when using `--watch` (default: `60`) |
| `--no-color` | Plain text output - also respects the `NO_COLOR` env var |
| `--no-pager` | Disable the built-in pager (`less`) |


## Examples

```bash
# Quick health check
sf-status status

# Watch NA1 for changes every 30 seconds
sf-status status --instance NA1 --watch --interval 30

# Full incident detail
sf-status incidents --id 12345 --verbose

# All incidents in the last month
sf-status incidents --all --since 2026-05-01

# Upcoming maintenances on CS2
sf-status maintenances --instance CS2

# Pipe to jq
sf-status incidents --json | jq '.[].instanceKeys'
sf-status status --instance NA1 --json | jq '.[0].status'

# Plain text output (e.g. for logging)
sf-status status --no-color
NO_COLOR=1 sf-status incidents --all
```


## Per-command help

Every command has its own `--help` output:

```bash
sf-status status --help
sf-status incidents --help
sf-status maintenances --help
```


## Releases

Releases are fully automated via [semantic-release](https://semantic-release.gitbook.io). Every push to `main` is analysed and a release is cut automatically if the commits warrant one.

Versioning is driven by [Conventional Commits](https://www.conventionalcommits.org):

| Commit prefix | Release type |
|---------------|-------------|
| `fix:` | Patch (`1.0.0` - `1.0.1`) |
| `feat:` | Minor (`1.0.0` - `1.1.0`) |
| `feat!:` or `BREAKING CHANGE:` | Major (`1.0.0` - `2.0.0`) |
| `chore:`, `docs:`, `ci:` | No release |

A `CHANGELOG.md` is generated and committed automatically with each release.


## License

[MIT](LICENSE)
