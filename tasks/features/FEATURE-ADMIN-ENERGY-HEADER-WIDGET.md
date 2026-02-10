# Task: Admin — Space header configuration for Energy widget
ID: FEATURE-ADMIN-ENERGY-HEADER-WIDGET
Type: feature
Scope: backend, admin
Size: medium
Parent: (none)
Status: in-progress

## 1. Business goal

In order to configure the Energy header widget per Space from the admin interface
As an administrator
I want to enable/disable the Energy header widget and adjust its settings (range, show production) on each Space

## 2. Context

- Energy Phase 1 is implemented: backend energy endpoints, panel Energy screen + compact header widget
- The panel's `EnergyHeaderWidget` shows today's consumption (and optional production) in the space header area
- Currently there is no per-Space configuration for header widgets on the Space entity
- This task adds a `header_widgets` JSON column to the Space entity and provides Admin UI to manage it
- The pattern follows existing Space role configurations (lighting, climate, sensor, covers, media activities)

Relevant files:
- Backend: `apps/backend/src/modules/spaces/entities/space.entity.ts`
- Backend DTOs: `apps/backend/src/modules/spaces/dto/create-space.dto.ts`, `update-space.dto.ts`
- Admin store: `apps/admin/src/modules/spaces/store/spaces.store.ts`
- Admin edit form: `apps/admin/src/modules/spaces/components/space-edit-form.vue`
- Panel widget: `apps/panel/lib/modules/energy/widgets/energy_header_widget.dart`

## 3. Scope

**In scope**

- Add `header_widgets` JSON column to SpaceEntity
- Update Space DTOs (create + update) to accept header_widgets
- Create database migration for the new column
- Update admin store types, schemas, transformers to handle header_widgets
- Add "Header Widgets" section to Space edit form with Energy widget configuration
- Add i18n translations
- Add unit tests for store/transformer logic
- Regenerate OpenAPI spec + admin types

**Out of scope**

- Energy page configuration (only header widget config)
- Tariffs/cost configuration
- Per-device energy mapping
- Panel changes (panel will read the config from existing Space API)

## 4. Acceptance criteria

- [ ] SpaceEntity has a `header_widgets` JSON column (nullable, default null)
- [ ] Create/Update Space DTOs accept `header_widgets` array
- [ ] Database migration adds the column
- [ ] Admin store ISpace interface includes `headerWidgets`
- [ ] Admin Space edit form has "Header Widgets" section
- [ ] Energy widget card has: enable toggle, range selector (today/week/month), show production toggle
- [ ] Enabling energy widget sets defaults: range=today, showProduction=true
- [ ] Saving space persists header_widgets config via API
- [ ] Translations added for all new strings
- [ ] Unit tests cover: add widget, update settings, remove widget, no-change regression
- [ ] OpenAPI spec regenerated

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Enable Energy header widget

Given a Space "Living Room" with no header widgets
When the admin enables the Energy header widget
Then the header_widgets payload contains `[{ type: "energy", order: 0, settings: { range: "today", show_production: true } }]`

### Scenario: Change range to week

Given a Space with Energy header widget enabled (range=today)
When the admin changes range to "week"
Then the settings.range field updates to "week"

### Scenario: Disable Energy widget

Given a Space with Energy header widget enabled
When the admin disables the Energy widget
Then the header_widgets array no longer contains an energy entry

## 6. Technical constraints

- Follow existing Space entity/DTO/store patterns
- Use `simple-json` TypeORM column type for SQLite compatibility
- Do not modify generated code manually (regenerate OpenAPI instead)
- Tests must follow existing Vitest patterns in admin composables

## 7. Implementation hints

- Look at `space-sensor-roles-summary.vue` for summary component pattern
- Look at `space-edit-form.vue` for adding new collapse sections
- Use `useSpaceEditForm` composable pattern for form state
- Store JSON as array of `{ type, order, settings }` objects for future extensibility

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Keep changes scoped to this task and its `Scope`
- For each acceptance criterion, either implement it or explain why it's skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
