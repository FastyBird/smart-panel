# Task: SpacePage quick actions (pinned intents)
ID: FEATURE-SPACEPAGE-QUICK-ACTIONS
Type: feature
Scope: backend, admin, panel
Size: small
Parent: EPIC-SPACES-FIRST-UX
Status: completed

## Description

Allow admins to configure which quick action buttons appear on a SpacePage. This enables customization of the lighting control buttons shown on the panel.

## Acceptance Criteria

- [x] Add QuickActionType enum with all available action types
- [x] Add quickActions field to SpacePageEntity (nullable array)
- [x] Update create/update DTOs to support quick_actions field
- [x] Create admin pages-space plugin with forms for configuring quick actions
- [x] Update panel SpacePageModel to parse quick_actions from API
- [x] Update panel SpacePage to render only configured quick actions
- [x] Default to standard lighting controls when no quick actions are configured

## Quick Action Types

- `lighting_off` - Turn off all lights
- `lighting_work` - Work mode (100% brightness)
- `lighting_relax` - Relax mode (50% brightness)
- `lighting_night` - Night mode (20% brightness)
- `brightness_up` - Increase brightness
- `brightness_down` - Decrease brightness
- `climate_up` - Increase temperature setpoint
- `climate_down` - Decrease temperature setpoint

## Implementation Details

### Backend
- Added QuickActionType enum to `spaces.constants.ts`
- Extended SpacePageEntity with quickActions column (simple-array)
- Updated CreateSpacePageDto and UpdateSpacePageDto with quick_actions field

### Admin
- Created `pages-space` plugin with full form support
- Added quick actions multi-select field with localized labels
- Integrated with dashboard pages module

### Panel
- Extended SpacePageModel with quickActions field
- Updated SpacePage to build quick action buttons dynamically
- Added brightness control button support
- Fallback to default lighting controls when empty
