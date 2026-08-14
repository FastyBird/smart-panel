# Buddy Adaptive Context — MCP Pre-extraction Contract

Date: 2026-08-14
Plan: [plan-buddy-adaptive-context.md](./plan-buddy-adaptive-context.md)

## Purpose

This baseline freezes the MCP read behavior that Phase 1 must preserve while moving provider-neutral home queries out of
the MCP transport module. It is a compatibility contract, not a recommendation that Buddy should inject the composite
MCP home snapshot into its prompt. Buddy will use narrower query profiles and stricter result budgets.

The regression coverage is split between `McpContextService`, which owns the current domain mapping and bounds, and
`McpReadToolService`, which owns MCP authorization, deadlines, envelopes, and tool/resource registration.

## Current Bounds

| Domain                               |   Bound |
| ------------------------------------ | ------: |
| Home spaces                          |      50 |
| Home devices                         |     100 |
| Channels per device                  |      20 |
| Properties per channel               |      40 |
| Home scenes                          |      50 |
| Writable properties returned         |     100 |
| Writable candidates scanned per page |     500 |
| Triggerable scenes                   |      50 |
| Triggerable spaces                   |      50 |
| Security alerts                      |      20 |
| Security devices                     |     100 |
| Security channels per device         |      10 |
| Security properties per channel      |      20 |
| Weather forecast                     |  5 days |
| Timeseries range                     | 14 days |
| Timeseries points                    |     500 |
| Energy range                         | 31 days |

These values remain MCP compatibility constants during extraction. Buddy-facing adapters may impose smaller limits after
the shared query layer returns typed domain results.

## Home Snapshot Contract

- A whole-home snapshot reads a limit-plus-one space page, visible device summaries, bounded scene summaries, primary
  weather, whole-home energy, and bounded security state.
- A scoped snapshot returns the selected space as its only space summary and applies the resolved room/zone/master scope
  to devices, scenes, energy, and security. A master space retains whole-home domain behavior.
- Hidden devices remain excluded by the visible-domain queries. Disabled visible devices and disabled scenes remain in
  MCP snapshots with their `enabled` state.
- Device connection state is a strict read. Optional weather, energy, and security failures become `null` sections in the
  composite snapshot; strict device state failures still propagate.
- The composite result keeps `scope`, `spaces`, `devices`, `scenes`, `weather`, `energy`, `security`, and `limits`.
  `limits` independently reports `spaces_truncated`, `devices_truncated`, and `scenes_truncated`.
- Device state keeps nested channel/property values and independently reports `channels_truncated` and
  `properties_truncated` at the affected levels.
- Security output keeps device/channel/property truncation flags plus the derived `state_truncated` flag. Alert selection
  has its own `alerts_truncated` flag.

## Domain Read Contract

- `get_weather` with `location_id` calls the exact configured location; omitting the ID calls the primary location.
- Timeseries validates the date range and projected bucket count before storage access, returns no more than 500 points,
  and preserves its `truncated` marker.
- Energy validates its range and retains room, explicit zone-membership, and master/whole-home selection semantics.
- Space resources use a stable offset cursor and do not repeat static installation/home resources after the first page.

## MCP Adapter Contract

Successful tools retain the established envelope fields:

```text
installation, request_id, tool, observed_at, data
```

Tool arguments are passed through without silently changing whole-home versus scoped behavior. Policy, installation
identity, client credentials, audit records, MCP deadlines, sanitized errors, and protocol registration remain in the MCP
adapter. Phase 1 may replace the mapper behind `McpContextService`, but must not move these transport concerns into the
shared query module.

## Phase 1 Regression Rule

Run the focused MCP service/tool specs before and after each extraction slice. Existing external output, ordering, totals,
truncation flags, explicit/primary weather selection, and scoped/whole-home routing must remain unchanged. Any intentional
MCP protocol change requires a separate compatibility decision and is outside the Buddy context optimization.
