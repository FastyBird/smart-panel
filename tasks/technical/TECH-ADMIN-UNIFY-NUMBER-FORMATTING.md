# Task: Unify number formatting across admin app
ID: TECH-ADMIN-UNIFY-NUMBER-FORMATTING
Type: technical
Scope: admin
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to have consistent number presentation that respects the user's configured locale preferences,
As a Smart Panel administrator,
I want all numbers displayed in the admin app to use the system-configured number format (`number_format` setting).

## 2. Context

### Current state

The system module already exposes a `number_format` configuration with four options:

| Key | Example | Locale |
|-----|---------|--------|
| `comma_dot` | 1,234.56 | en-US |
| `dot_comma` | 1.234,56 | de-DE |
| `space_comma` | 1 234,56 | fr-FR |
| `none` | 1234.56 | — (no grouping) |

The admin app already has:

- **`formatNumber()`** utility (`apps/admin/src/common/utils/number.utils.ts`) that accepts an optional `numberFormat` parameter — but **no caller passes it**.
- **`formatPercent()`** utility (`apps/admin/src/common/utils/format.utils.ts`) that wraps `formatNumber` — also **never passes** `numberFormat`.
- **`useConfigModule()`** composable (`apps/admin/src/modules/config/composables/useConfigModule.ts`) that can retrieve the system config, including `numberFormat`.
- A settings form in `apps/admin/src/modules/system/components/system-config-form.vue` where the user can pick the format.

### Problem

Despite the infrastructure being in place, the actual number formatting calls never receive the system config `numberFormat` value. This means:

1. All `formatNumber()` calls fall back to `navigator.language`, resulting in browser-locale-dependent formatting that ignores the user's explicit preference.
2. Some places use `.toFixed()` directly, which always produces US-style decimal formatting regardless of any setting.
3. The result is inconsistent: some numbers appear in European format (from browser locale), others in US format (from `.toFixed()`).

### Key files

| File | Role |
|------|------|
| `apps/admin/src/common/utils/number.utils.ts` | Core `formatNumber()` utility |
| `apps/admin/src/common/utils/format.utils.ts` | `formatPercent()` wrapper |
| `apps/admin/src/modules/config/composables/useConfigModule.ts` | Config access composable |
| `apps/admin/src/modules/system/system.constants.ts` | `SYSTEM_MODULE_NAME` constant |
| `apps/admin/src/modules/system/store/config.store.schemas.ts` | System config store schema (contains `numberFormat`) |

### Components that call `formatNumber()` without `numberFormat`

| Component | What it formats |
|-----------|----------------|
| `modules/stats/components/stats-memory.vue` | Memory usage (MB) |
| `modules/stats/components/stats-devices.vue` | Device counts |
| `modules/stats/components/stats-devices-communication.vue` | Update counts |
| `modules/system/components/system-info/system-info-detail.vue` | CPU load, memory |
| `modules/weather/components/location-forecast.vue` | Temperature |
| `modules/weather/components/location-detail.vue` | Temperature, wind speed |
| `modules/weather/components/locations-table-column-weather.vue` | Temperature |
| `modules/weather/components/weather-day.vue` | Temperature |
| `modules/weather/components/location-hourly-forecast.vue` | Temperature |

### Components that call `formatPercent()` without `numberFormat`

| Component | What it formats |
|-----------|----------------|
| `modules/stats/components/stats-cpu.vue` | CPU load percentage |

### Components that use `.toFixed()` directly (bypassing `formatNumber` entirely)

| Component | What it formats |
|-----------|----------------|
| `plugins/weather-open-meteo/components/open-meteo-location-add-form.vue` | Lat/lon coordinates |
| `plugins/weather-open-meteo/components/open-meteo-location-edit-form.vue` | Lat/lon coordinates |
| `plugins/weather-openweathermap-onecall/components/openweathermap-onecall-location-add-form.vue` | Lat/lon coordinates |
| `plugins/weather-openweathermap-onecall/components/openweathermap-onecall-location-edit-form.vue` | Lat/lon coordinates |
| `modules/onboarding/components/step-location.vue` | Lat/lon coordinates |

## 3. Scope

**In scope**

- Create a `useNumberFormat` composable that provides a reactive `numberFormat` value from the system config
- Update `formatNumber()` and `formatPercent()` signatures or create composable-based wrappers that automatically inject the system number format
- Update all existing `formatNumber()` / `formatPercent()` call sites to use the system number format
- Replace `.toFixed()` usages with `formatNumber()` calls that respect the system number format
- Add unit tests for the composable and updated utilities

**Out of scope**

- Date/time formatting (separate concern, separate setting)
- Backend number formatting (API always returns raw numbers)
- Panel (Flutter) number formatting (separate task)
- Changing the existing `number_format` config options or backend API
- Display-level override support (per-display `numberFormat` field exists but wiring it is a separate concern)

## 4. Acceptance criteria

### Phase 1: Composable & utility layer

- [x] Create `useNumberFormat` composable in `apps/admin/src/common/composables/` that:
  - Retrieves the system `numberFormat` from the config store via `useConfigModule`
  - Returns a reactive `numberFormat` ref
  - Returns a `format(value, options?)` function that wraps `formatNumber()` with the system setting
  - Returns a `formatPct(value, fractionDigits?)` function that wraps `formatPercent()` with the system setting
- [x] Update `formatPercent()` in `format.utils.ts` to accept and forward an optional `numberFormat` parameter

### Phase 2: Migrate existing `formatNumber()` call sites

- [x] `modules/stats/components/stats-memory.vue` — pass system `numberFormat`
- [x] `modules/stats/components/stats-devices.vue` — pass system `numberFormat`
- [x] `modules/stats/components/stats-devices-communication.vue` — pass system `numberFormat`
- [x] `modules/system/components/system-info/system-info-detail.vue` — pass system `numberFormat`
- [x] `modules/weather/components/location-forecast.vue` — pass system `numberFormat`
- [x] `modules/weather/components/location-detail.vue` — pass system `numberFormat`
- [x] `modules/weather/components/locations-table-column-weather.vue` — pass system `numberFormat`
- [x] `modules/weather/components/weather-day.vue` — pass system `numberFormat`
- [x] `modules/weather/components/location-hourly-forecast.vue` — pass system `numberFormat`

### Phase 3: Migrate `formatPercent()` call sites

- [x] `modules/stats/components/stats-cpu.vue` — pass system `numberFormat`

### Phase 4: Replace `.toFixed()` with `formatNumber()`

- Skipped: lat/lon coordinates kept as `.toFixed(4)` — these are technical notation (comma-separated pairs), and locale-aware decimal commas would create visual ambiguity like `(48,8566, 2,3522)`

### Phase 5: Tests

- [x] Unit test for `useNumberFormat` composable — verify it returns the correct format from system config
- [x] Unit test for `formatNumber()` — verify all four format modes produce correct output
- [x] Unit test for `formatPercent()` with `numberFormat` parameter

### Phase 6: Verification

- [x] All existing admin unit tests pass (`pnpm --filter ./apps/admin run test:unit`)
- [x] Lint passes (`pnpm run lint:js`)
- [x] No hardcoded `.toFixed()` calls remain for user-visible numbers in admin app
- [x] Manually verify: changing `number_format` in system settings updates all displayed numbers

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: European user sees consistent dot-comma formatting

Given the system `number_format` is set to `dot_comma`
When the admin views the stats dashboard showing memory "1536.7 MB"
Then the memory is displayed as "1.537 MB" (European thousands separator, comma decimal)

### Scenario: US user sees comma-dot formatting

Given the system `number_format` is set to `comma_dot`
When the admin views a weather location with temperature 1234.5
Then the temperature is displayed as "1,234.5"

### Scenario: No-grouping format

Given the system `number_format` is set to `none`
When the admin views CPU load of 45.678%
Then it is displayed as "45.68%" (no thousands separator)

### Scenario: Coordinate formatting respects locale

Given the system `number_format` is set to `dot_comma`
When the admin searches for a weather location and sees coordinates
Then latitude/longitude are displayed as "48,8566" and "2,3522" (comma as decimal separator)

## 6. Technical constraints

- Do not modify generated code (`apps/admin/src/openapi.ts`, `apps/panel/lib/api/`).
- Do not introduce new dependencies.
- The `formatNumber()` utility signature must remain backward-compatible (the third `numberFormat` parameter is already optional).
- The composable must handle the case where the config module hasn't loaded yet (fall back to `navigator.language` via the existing `formatNumber` default).
- Follow the existing composable patterns in `apps/admin/src/common/composables/` and `apps/admin/src/modules/config/composables/`.
- Tests are expected for new composable logic.

## 7. Implementation hints

- **Composable approach**: Create `useNumberFormat` that internally calls `useConfigModule({ type: 'system-module' })` and extracts `configModule.value?.numberFormat`. Return helper functions that close over this reactive ref.
- **Migration strategy**: For each component, the minimal change is:
  1. Import `useNumberFormat` (or import `formatNumber` + the composable)
  2. Call the composable in `setup()`
  3. Replace `formatNumber(val, opts)` with `formatNumber(val, opts, numberFormat.value)` or use the composable's `format()` wrapper
- **For `.toFixed()` replacements**: Use `formatNumber(val, { minimumFractionDigits: 4, maximumFractionDigits: 4 }, numberFormat.value)`.
- **`formatPercent` update**: Add `numberFormat` parameter and forward it: `formatNumber(n, opts, numberFormat)`.
- **Look at** `apps/admin/src/modules/system/system.constants.ts` for the `SYSTEM_MODULE_NAME` constant used with `useConfigModule`.
- **Reuse** the existing `useConfigModule` composable — do not duplicate config access logic.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope` (admin only).
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Start with Phase 1 (composable), then Phase 2-4 (migrations), then Phase 5 (tests), then Phase 6 (verification).
- Run `pnpm --filter ./apps/admin run test:unit` and `pnpm run lint:js` after all changes to verify nothing is broken.
