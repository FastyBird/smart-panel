# Task: Add House Overview page for master panels
ID: FEATURE-HOUSE-OVERVIEW-PAGE
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-DISPLAY-ROLES-HOUSE-CONTROL
Status: done

## Summary

Implemented the House Overview page plugin (`pages-house`) that provides a whole-house overview for master display panels.

## Implementation Details

### Backend (`apps/backend/src/plugins/pages-house/`)
- Created `HousePageEntity` extending `PageEntity` with:
  - `viewMode`: Display mode (simple or detailed)
  - `showWeather`: Toggle for weather display
- Created DTOs for create and update operations
- Implemented nested builder service for page creation
- Registered plugin in the app module

### Flutter Panel (`apps/panel/lib/modules/dashboard/`)
- Created `HousePageModel` with house-specific properties
- Created `HousePageView` extending `DashboardPageView`
- Added `house` to `PageType` enum
- Updated page mappers to handle house page type

### Admin (`apps/admin/src/plugins/pages-house/`)
- Created add and edit form components
- Created Zod schemas for validation
- Created store schemas for API communication
- Added localization files
- Registered plugin in the app main

### OpenAPI
- Generated updated OpenAPI spec with new house page endpoints
