# Task: Panel UI — Energy domain page + Space header widget (read-only)
ID: FEATURE-PANEL-ENERGY-DOMAIN-PAGE
Type: feature
Scope: panel
Size: large
Parent: (none)
Status: in-progress

## 1. Business goal

In order to give users visibility into their energy consumption and (optionally) PV production at a glance
As a smart home panel user
I want an Energy domain page that shows today's summary, a timeseries chart, and top consumers — plus a compact energy widget in the space header.

## 2. Context

- Backend provides space-level energy endpoints:
  - `GET /api/energy/spaces/:spaceId/summary?range=today|week|month`
  - `GET /api/energy/spaces/:spaceId/timeseries?range=...&interval=...`
  - `GET /api/energy/spaces/:spaceId/breakdown?range=today&limit=...`
- The spec is normalized: consumption is cumulative kWh, deltas computed server-side.
- PV generation exists (`electrical_generation.production` + optional `power`).
- Panel already has:
  - electrical categories mapped to ThemeColors.info
  - translations for average_power / production / electrical_generation
  - sensor utilities: unit/scale/labels for electrical categories
  - electricalGeneration grouped into an energy domain view (SensorCategory.energy)
- `fl_chart` dependency already present in pubspec.yaml (v0.69.0).
- Domain pages follow pattern: DomainType enum → DomainViewItem → deck mapper → domain view page.

## 3. Scope

**In scope**

- New `DomainType.energy` in the deck navigation system
- Energy API service using Dio directly (endpoints not in generated OpenAPI)
- Energy domain page with: summary cards, timeseries bar chart, top consumers list
- Range switcher (Today / Week / Month)
- Space header energy badge (today's consumption + optional production)
- i18n labels for all new UI strings
- Consistent loading/error states using DomainStateView pattern
- Basic unit tests for model mapping

**Out of scope**

- Cost/tariffs display
- Per-device power realtime charts
- Detailed drill-down history per device
- Alerts/anomalies
- Custom date pickers
- Backend changes

## 4. Acceptance criteria

- [ ] Energy domain page is accessible from the deck (swipeable like other domain pages)
- [ ] Energy domain uses MdiIcons.flashOutline icon and ThemeColors.info accent
- [ ] Summary section shows today's total consumption (kWh), production if available, and net if both present
- [ ] Timeseries bar chart shows consumption (and production if available) for selected range
- [ ] Top consumers list shows up to 10 devices sorted by consumption
- [ ] Range switcher (Today / Week / Month) updates summary and chart
- [ ] Chart interval adjusts: 1h for today, 1h for week, 1d for month
- [ ] Space header badge shows today's consumption (and production icon if available)
- [ ] Header badge is hidden or shows "—" when API fails
- [ ] Loading and error states are consistent with other domain pages
- [ ] Empty state shown when no energy data exists
- [ ] i18n labels added for Energy, Consumption, Production, Today, Week, Month, Top consumers
- [ ] Energy domain is visible when sensor devices exist in the room

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Room with consumption-only energy devices

Given a room display with sensor devices that have energy channels
When the user swipes to the Energy domain page
Then they see today's consumption total, a consumption-only chart, and top consumers

### Scenario: Room with PV production

Given a room display with both consumption and generation devices
When the user views the Energy page
Then both consumption and production are shown in summary, chart has two series

### Scenario: API failure

Given the energy API returns an error
When the Energy page loads
Then an inline error state with retry button is shown

### Scenario: Range switching

Given the user is on the Energy page showing today's data
When they tap "Week"
Then summary updates to weekly totals, chart shows hourly bars for the week

## 6. Technical constraints

- Follow the existing domain view pattern (DomainType → DomainViewItem → mapper → page)
- Use Dio directly for energy API calls (endpoints not in generated OpenAPI)
- Do not modify generated code (apps/panel/lib/api/, apps/panel/lib/spec/)
- Use fl_chart for charting (already a dependency)
- Use ThemeColors.info for energy accent color
- Follow existing number formatting (NumberFormatUtils)
- Tests expected for model mapping and conditional rendering

## 7. Implementation hints (optional)

- Look at `sensors_domain_view.dart` for domain page pattern
- Look at `room_overview.dart` `_buildStatusBadges` for header widget pattern
- Look at `domain_type.dart`, `room_domain_classifier.dart`, `system_views_builder.dart` for domain registration
- Reuse `DomainStateView` for loading/error states
- Reuse `PortraitViewLayout` / `LandscapeViewLayout` for responsive layout
- Reuse `PageHeader`, `SectionTitle` for consistent headers
- Use `NumberFormatUtils.defaultFormat.formatDecimal` for kWh formatting

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
