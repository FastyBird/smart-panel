# Task: Add House Modes (Home / Away / Night) for entry panels
ID: FEATURE-HOUSE-MODES-MVP
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-DISPLAY-ROLES-HOUSE-CONTROL
Status: done

## Summary

Implemented house modes (Home / Away / Night) as a global system setting that can be displayed and controlled by entry display panels.

## Implementation Details

### Backend (`apps/backend/src/modules/system/`)

- Added `HouseMode` enum to `system.constants.ts` with values: HOME, AWAY, NIGHT
- Added `HOUSE_MODE_CHANGED` event type for mode change notifications
- Updated `SystemConfigModel` to include `houseMode` field with default value HOME
- Updated `UpdateSystemConfigDto` to allow updating house mode via API
- Registered config model and DTO in Swagger extra models for OpenAPI documentation

### Admin (`apps/admin/src/modules/system/`)

- Added `HouseMode` enum to `system.constants.ts`
- Updated `config.schemas.ts` with `houseMode` field for form validation
- Updated `config.store.schemas.ts` with:
  - `houseMode` in `SystemConfigSchema` (internal state)
  - `house_mode` in `SystemConfigUpdateReqSchema` (API request)
  - `house_mode` in `SystemConfigResSchema` (API response)
- Added localization strings in `en-US.json`:
  - Field title: "House Mode"
  - Field description: "Current house mode setting"
  - Values: "Home", "Away", "Night"
  - Section heading and description for house mode settings

### Flutter Panel (`apps/panel/lib/modules/system/`)

- Added `HouseMode` enum to `types/configuration.dart` with:
  - Values: home, away, night
  - String value mapping
  - Utility methods for parsing
- Updated `SystemConfigModel` in `models/system.dart`:
  - Added `houseMode` field
  - Updated constructor and factory method
  - Updated `copyWith` method
  - Updated equality and hashCode

### OpenAPI

- Generated updated OpenAPI spec (`spec/api/v1/openapi.json`) with:
  - `ConfigModuleDataSystem.house_mode` field
  - `ConfigModuleUpdateSystem.house_mode` field
  - Enum values: home, away, night

## API Endpoints

House mode is managed through the existing config module endpoints:

- `GET /api/v1/config/modules/system-module` - Get current system config including house mode
- `PATCH /api/v1/config/modules/system-module` - Update system config with `house_mode` field

Example request to update house mode:
```json
{
  "data": {
    "type": "system-module",
    "house_mode": "away"
  }
}
```

## Events

- `SystemModule.HouseMode.Changed` - Emitted when house mode changes (via CONFIG_UPDATED)
