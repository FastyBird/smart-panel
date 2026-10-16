# Task: Panel UI for activating space modes
ID: FEATURE-SPACE-MODE-PANEL-UI
Type: feature
Scope: panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: in_progress (UI implemented; independent review and alpha acceptance pending)
Tracking: #1287
Issues: #1296

## 1. Business goal

In order to quickly change my room's environment,
As a panel user,
I want to see available activity modes and activate them with a single tap.

## 2. Context

### Existing Code References
- **Space plugin**: `apps/panel/lib/plugins/spaces-home-control/`
- **Space page**: `apps/panel/lib/plugins/spaces-home-control/presentation/system_pages/room_overview.dart`
- **Quick actions**: `apps/panel/lib/features/dashboard/presentation/widgets/`
- **Lighting modes**: Existing mode buttons in lighting section
- **House modes page**: `apps/panel/lib/features/dashboard/presentation/pages/house_mode/`

### Dependencies
- Requires `FEATURE-SPACE-ACTIVITY-MODES` backend implementation
- Should integrate with existing SpacePage layout

## 3. Scope

**In scope**

- Mode section on SpacePage (prominent placement)
- Mode buttons with icons and labels
- Active mode indicator (highlighted button)
- Mode activation via tap
- Loading state during activation
- Success/partial/failure feedback
- Mode deactivation ("Manual" or none)

**Out of scope**
- Mode configuration (admin only)
- Mode scheduling display
- Mode history
- Confirmation dialogs (modes are safe operations)

## 4. Acceptance criteria

- [x] SpacePage shows "Modes" section when modes are available
- [x] Each enabled mode is shown as a tappable button
- [x] Buttons show mode icon and localized name
- [x] Active mode button is visually highlighted
- [x] Tapping a mode activates it (API call)
- [x] Loading indicator shown during activation
- [x] Success feedback on completion
- [x] Partial failure shows warning indicator
- [x] Tapping active mode deactivates it (returns to manual)
- [x] Modes section hidden when no modes enabled for space
- [x] UI is responsive across different panel sizes
- [x] All strings are localized (en, cs at minimum)

## 5. Example scenarios

### Scenario: Activate Work mode

Given user is on Space "Office" page
And Work mode is available
When user taps "Work" button
Then loading indicator shows
And API call activates Work mode
And on success, Work button is highlighted
And other mode buttons are unhighlighted

### Scenario: Partial activation failure

Given user taps "Entertainment" mode
And lighting succeeds but climate fails
Then mode activates with warning indicator
And user can tap for details

### Scenario: Deactivate mode

Given "Relax" mode is active
When user taps the highlighted "Relax" button
Then mode is deactivated
And no mode is highlighted
And room returns to manual control

## 6. Technical constraints

- Follow existing panel widget patterns
- Use existing theme system (AppSpacings, AppColors, etc.)
- Support both light and dark themes
- Use existing API client patterns
- Do not modify generated API client code
- Responsive design for different panel sizes

## 7. Implementation hints

### Widget Structure
```
SpaceModesSection/
├── space_modes_section.dart    # Main section widget
├── space_mode_button.dart      # Individual mode button
└── space_mode_icon.dart        # Mode icon mapping
```

### Mode Icon Mapping
```dart
IconData getModeIcon(ActivityMode mode) {
  switch (mode) {
    case ActivityMode.work:
      return MdiIcons.briefcase;
    case ActivityMode.relax:
      return MdiIcons.sofaSingle;
    case ActivityMode.sleep:
      return MdiIcons.bedKing;
    case ActivityMode.entertainment:
      return MdiIcons.televisionPlay;
    case ActivityMode.away:
      return MdiIcons.exitRun;
    default:
      return MdiIcons.lightbulbGroup;
  }
}
```

### API Integration
```dart
// Enabled configurations in saved display order
GET /api/v1/modules/spaces/spaces/{id}/activity-modes

// Persisted selection/result; data:null and data.selected_activity_mode:null are distinct valid states
GET /api/v1/modules/spaces/spaces/{id}/activity-modes/active

// Manual single submission with data.expected_revision
POST /api/v1/modules/spaces/spaces/{id}/activity-modes/{mode}/activate

// Clear exact server identity with data.activation_id; no device rollback
POST /api/v1/modules/spaces/spaces/{id}/activity-modes/deactivate
```

### Layout Suggestion
```
┌─────────────────────────────────────────┐
│ Office                            [☰]   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────── Modes ───────────┐        │
│  │ [💼Work] [😌Relax] [🛏Sleep] │        │
│  │      [🎬Entertainment]       │        │
│  └──────────────────────────────┘        │
│                                         │
│  ┌─────────── Lights ──────────┐        │
│  │ ...existing lighting section │        │
│  └──────────────────────────────┘        │
│                                         │
│  ┌─────────── Climate ─────────┐        │
│  │ ...existing climate section  │        │
│  └──────────────────────────────┘        │
│                                         │
└─────────────────────────────────────────┘
```

### Localization Keys
```json
{
  "space_modes_section_title": "Modes",
  "space_modes_activating": "Activating...",
  "space_modes_active": "Active",
  "space_modes_partial": "Partially applied",
  "space_mode_work": "Work",
  "space_mode_relax": "Relax",
  "space_mode_sleep": "Sleep",
  "space_mode_entertainment": "Entertainment",
  "space_mode_cooking": "Cooking",
  "space_mode_gaming": "Gaming",
  "space_mode_reading": "Reading",
  "space_mode_away": "Away"
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow existing panel widget patterns for consistency.
- Modes section should be prominently placed (above domain sections).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

## Implementation and acceptance boundary

Implemented above the actual room overview domain cards. Each mounted room section owns an independent, fenced
read model so retained routes cannot replace another room's selection. Enabled modes use saved order and localized
icons/names. Pending requests show loading only; persisted active/partial/failed/interrupted/deactivated/null states
remain distinct. Manual clears the exact server activation identity without restoring earlier device values.
Details describe per-domain command outcomes and do not claim physical convergence. An unconfirmed response stays
uncertain even if read-only reconciliation finds a saved selection. Socket/configuration/device/reconnect hints only
refetch; stale/busy/released sessions cannot send. Manual submissions opt out of network/token-refresh replay and have
no WebSocket actuation fallback or automatic conflict retry.

All six Panel ARBs and the seven pinned-generated localization files are updated. Generated-HTTP repository and actual
widget tests cover revision/identity inputs, single-send 401/500/timeout/missing/conflict responses, partial/null states,
late space/request responses, reconnect, retained routes, pending duplicate-tap prevention and a narrow Czech layout.
Ordinary room/cover transport and view regressions remain covered. These checked criteria record local UI implementation;
independent review, composed CI and alpha acceptance remain pending. VD1458 climate integration, security actuation,
scheduler/presence and post-alpha hardware qualification remain open. The referenced `/.ai-rules/GUIDELINES.md` was
unavailable; repository AGENTS.md and CONTRIBUTING.md were followed.
