# Task: Panel — Energy module screen + Space header widget
ID: FEATURE-PANEL-ENERGY-SCREEN
Type: feature
Scope: panel
Size: medium
Parent: none
Status: in-progress

## 1. Business goal

In order to monitor whole-installation energy consumption and production at a glance,
As a smart panel user,
I want a standalone Energy screen in the deck navigation (like Security) and a compact header widget showing today's consumption.

## 2. Context

- The `modules/security` module provides the pattern to follow: standalone screen registered as a deck item after domain views.
- The `modules/energy` module already contains `EnergyService` (HTTP client) and models (`EnergySummary`, `EnergyTimeseries`, `EnergyBreakdown`).
- The `deck/presentation/domain_pages/energy_domain_view.dart` implements room-level energy UI — the standalone screen reuses similar layout but for the whole installation (`spaceId = 'home'`).
- Backend endpoints: `GET /api/energy/spaces/:spaceId/summary|timeseries|breakdown`.
- i18n strings for energy labels already exist in `app_en.arb`.

## 3. Scope

**In scope**

- `EnergyViewItem` deck item type (mirrors `SecurityViewItem`)
- `EnergyScreen` standalone presentation (whole-installation, `spaceId = 'home'`)
- `EnergyRepository` with `ChangeNotifier` for reactive state management
- `EnergyModuleService` for module lifecycle (mirrors `SecurityModuleService`)
- Support detection: probe summary endpoint, hide energy if 404/501
- Registration in deck builder, mapper, bottom nav bar, more sheet
- Space header energy widget (compact: today consumption + optional production)
- Minimal widget tests

**Out of scope**

- Costs/tariffs
- Real-time instantaneous power charts
- Per-device drilldown beyond existing device detail
- Alerts/anomalies
- Backend or admin changes

## 4. Acceptance criteria

- [ ] `EnergyViewItem` added to `deck_item.dart` with `generateId()` and equality
- [ ] `DeckItemType.energyView` added to the enum
- [ ] `EnergyRepository` extends `ChangeNotifier`, caches summary/timeseries/breakdown, exposes `isSupported`
- [ ] `EnergyModuleService` initializes repository, registers in `locator`
- [ ] `EnergyScreen` shows: header with title/range selector, summary cards, timeseries chart, breakdown list
- [ ] Production UI hidden when `hasProduction` is false
- [ ] Energy deck item registered after Security in `deck_builder.dart`
- [ ] Energy item appears in bottom nav bar and more sheet
- [ ] `buildDeckItemWidget` maps `EnergyViewItem` to `EnergyScreen(embedded: true)`
- [ ] Space header energy widget shows today consumption (and production if available)
- [ ] Header widget shows "—" on error, does not crash
- [ ] Energy screen hidden from deck when support detection returns unsupported
- [ ] Startup manager registers and unregisters `EnergyModuleService` and `EnergyRepository`
- [ ] At least one widget test for summary rendering

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Energy supported installation

Given the backend returns a valid summary for spaceId "home"
When the deck is built
Then the Energy item appears after Security in the navigation

### Scenario: Energy not supported

Given the backend returns 404 for the energy summary endpoint
When the deck is built
Then the Energy item is not shown in the navigation

### Scenario: Production data available

Given the summary includes production > 0
When the Energy screen renders
Then the production card and net card are shown

## 6. Technical constraints

- Follow the existing `modules/security` structure for module service, repository, screen patterns.
- Use `ChangeNotifier` + `Provider/Consumer` for reactive UI (same as security).
- Use `fl_chart` for bar charts (already a dependency).
- Use `spaceId = 'home'` for whole-installation data.
- Do not modify generated code (`spec/`, `api/`).
- Use existing `EnergyService` for HTTP calls.

## 7. Implementation hints (optional)

- Mirror `SecurityViewItem` for `EnergyViewItem` in `deck_item.dart`.
- Mirror `SecurityModuleService` for `EnergyModuleService` in `module.dart`.
- Reuse UI patterns from `energy_domain_view.dart` (summary cards, chart, breakdown).
- For support detection, catch `DioException` with 404/501 status in repository `initialize()`.
- Register energy view in `buildDeck()` after `securityView`.
- For the header widget, fetch summary with `EnergyRange.today` and display compactly.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
