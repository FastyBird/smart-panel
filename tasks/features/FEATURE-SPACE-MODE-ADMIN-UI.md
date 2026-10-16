# Task: Admin UI for configuring space modes
ID: FEATURE-SPACE-MODE-ADMIN-UI
Type: feature
Scope: admin
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: in_progress (UI implemented; independent review and alpha acceptance pending)
Tracking: #1287
Issues: #1295

## 1. Business goal

In order to customize how activity modes behave in each space,
As an administrator,
I want to configure mode settings per space including which domains are affected and what values are applied.

## 2. Context

### Existing Code References
- **Space configuration**: `apps/admin/src/plugins/spaces-home-control/`
- **Lighting roles UI**: Similar role assignment patterns exist
- **Climate roles UI**: Similar role assignment patterns exist
- **House modes config**: `apps/admin/src/modules/system/`

### Dependencies
- Requires `FEATURE-SPACE-ACTIVITY-MODES` backend implementation
- Should follow existing admin UI patterns

## 3. Scope

**In scope**

- Space detail page section for "Activity Modes"
- List of available modes with enable/disable toggle
- Mode configuration editor:
  - Per-domain enable/disable
  - Per-domain value overrides
  - Preview of what the mode will do
- Mode reordering (priority for quick actions)
- Localization for all mode-related strings

**Out of scope**
- Creating custom modes (use scenes for that)
- Mode scheduling (separate task)
- Mode history/analytics

## 4. Acceptance criteria

- [x] Space detail page shows "Activity Modes" section
- [x] Admin can enable/disable each mode for the space
- [x] Admin can click on a mode to edit its configuration
- [x] Mode editor shows per-domain settings with current values
- [x] Admin can override default values for any domain
- [x] Admin can reset mode to defaults
- [x] Changes are saved via API and reflected immediately
- [x] Disabled modes are hidden from panel UI
- [x] UI is responsive and follows existing admin patterns
- [x] All strings are localized (en-US at minimum)

## 5. Example scenarios

### Scenario: Disable Entertainment mode for Office

Given admin is on Space "Office" detail page
When admin toggles off "Entertainment" mode
Then Entertainment mode is no longer available in Office
And panel will not show Entertainment as an option

### Scenario: Customize Work mode lighting

Given admin is editing "Work" mode for Space "Office"
When admin sets lighting brightness to 80% (instead of 100%)
And saves the configuration
Then Work mode in Office will use 80% brightness

### Scenario: Reset mode to defaults

Given admin has customized "Relax" mode for Living Room
When admin clicks "Reset to defaults"
Then all overrides are removed
And mode uses system defaults

## 6. Technical constraints

- Follow existing admin UI component patterns
- Use existing form validation schemas
- Reuse existing API service patterns
- Do not modify generated API client code
- Support both light and dark themes

## 7. Implementation hints

### Component Structure
```
SpaceModeSection/
├── SpaceModeList.vue           # List of modes with toggles
├── SpaceModeEditor.vue         # Modal/drawer for editing
├── SpaceModeDomainConfig.vue   # Per-domain configuration
└── SpaceModePreview.vue        # Preview of mode effects
```

### API Integration
```typescript
// Read every built-in configuration, including disabled modes
GET /api/v1/modules/spaces/spaces/{id}/activity-modes/{mode}/config

// Full configuration replacement with data.expected_revision
PUT /api/v1/modules/spaces/spaces/{id}/activity-modes/{mode}/config

// Explicit reset with data.expected_revision
POST /api/v1/modules/spaces/spaces/{id}/activity-modes/{mode}/config/reset

// Readiness of SAVED configuration only, with data.expected_revision
POST /api/v1/modules/spaces/spaces/{id}/activity-modes/{mode}/preview
```

### Localization Keys
```json
{
  "spaces.modes.title": "Activity Modes",
  "spaces.modes.description": "Configure how modes affect this space",
  "spaces.modes.enabled": "Enabled",
  "spaces.modes.disabled": "Disabled",
  "spaces.modes.edit": "Edit Mode",
  "spaces.modes.reset": "Reset to Defaults",
  "spaces.modes.domain.lighting": "Lighting",
  "spaces.modes.domain.climate": "Climate",
  "spaces.modes.domain.covers": "Window Coverings",
  "spaces.modes.domain.media": "Media",
  "spaces.modes.domain.security": "Security",
  "spaces.modes.work": "Work",
  "spaces.modes.relax": "Relax",
  "spaces.modes.sleep": "Sleep",
  "spaces.modes.entertainment": "Entertainment",
  "spaces.modes.away": "Away"
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow existing admin UI patterns for consistency.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

## Implementation and acceptance boundary

Implemented in the home-control space detail Domains tab. The five built-ins are read through their configuration
endpoints so disabled modes remain editable. Each independent display-order save and reset uses that mode's saved
revision. Conflicts refresh saved truth, preserve the visible draft and require explicit discard/review before a new
edit; no automatic overwrite or retry is performed. Preview accepts the saved revision only and is invalidated by
any draft change. Climate defaults stay disabled/unset and explicit enabled intent requires a supported preset
reference or a heat/cool target/delta. Climate/security actuation remains visibly unsupported.

All six Admin locales are translated. Mounted editor/API tests cover disabled-mode reads and toggles, order/revision
saves, reset, saved-only preview invalidation, late-space preview fencing, climate validation, role permissions and
409 draft preservation. Existing configure/detail tests verify the section's placement and preserve ordinary details.
These checked criteria record local UI implementation; independent review, composed CI and alpha acceptance remain
pending. VD1458 climate integration, security actuation, scheduler/presence and post-alpha hardware qualification are
not completed by this task. The referenced `/.ai-rules/GUIDELINES.md` was unavailable; repository AGENTS.md and
CONTRIBUTING.md were followed.
