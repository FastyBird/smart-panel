# Task: Admin UI for configuring space modes
ID: FEATURE-SPACE-MODE-ADMIN-UI
Type: feature
Scope: admin
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: planned

## 1. Business goal

In order to customize how activity modes behave in each space,
As an administrator,
I want to configure mode settings per space including which domains are affected and what values are applied.

## 2. Context

### Existing Code References
- **Space configuration**: `apps/admin/src/modules/spaces/`
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

- [ ] Space detail page shows "Activity Modes" section
- [ ] Admin can enable/disable each mode for the space
- [ ] Admin can click on a mode to edit its configuration
- [ ] Mode editor shows per-domain settings with current values
- [ ] Admin can override default values for any domain
- [ ] Admin can reset mode to defaults
- [ ] Changes are saved via API and reflected immediately
- [ ] Disabled modes are hidden from panel UI
- [ ] UI is responsive and follows existing admin patterns
- [ ] All strings are localized (en-US at minimum)

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
// Get modes for space
GET /api/v1/spaces/{spaceId}/modes

// Update mode configuration
PATCH /api/v1/spaces/{spaceId}/modes/{modeId}

// Reset mode to defaults
DELETE /api/v1/spaces/{spaceId}/modes/{modeId}/config
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
