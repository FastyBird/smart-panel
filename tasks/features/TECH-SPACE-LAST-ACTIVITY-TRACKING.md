# Task: Track last activity per Space
ID: TECH-SPACE-LAST-ACTIVITY-TRACKING
Type: technical
Scope: backend
Size: small
Parent: EPIC-SPACES-FIRST-UX
Status: completed

## Summary

Track when the last device activity occurred in each space by adding a `lastActivityAt` timestamp field to the Space entity that updates automatically when device properties change.

## Implementation

### Changes Made

1. **SpaceEntity** (`apps/backend/src/modules/spaces/entities/space.entity.ts`)
   - Added `lastActivityAt` field (nullable datetime)
   - Includes proper API decorators for OpenAPI documentation
   - Exposes as `last_activity_at` in snake_case for API responses

2. **SpaceActivityListener** (`apps/backend/src/modules/spaces/listeners/space-activity.listener.ts`)
   - New event listener that subscribes to `CHANNEL_PROPERTY_UPDATED` events
   - When a device property is updated, finds the device's space and updates `lastActivityAt`
   - Gracefully handles errors and edge cases (no channel, no space)

3. **SpacesModule** (`apps/backend/src/modules/spaces/spaces.module.ts`)
   - Registered the `SpaceActivityListener` as a provider

4. **Unit Tests** (`apps/backend/src/modules/spaces/listeners/space-activity.listener.spec.ts`)
   - Tests for successful activity tracking
   - Tests for edge cases (no space, no channel)
   - Tests for error handling

5. **Updated existing test mocks** to include the new `lastActivityAt` field

## API Response

The `last_activity_at` field is now included in all Space API responses:

```json
{
  "data": {
    "id": "uuid",
    "name": "Living Room",
    "last_activity_at": "2025-01-25T12:00:00Z",
    ...
  }
}
```

## Acceptance Criteria

- [x] Space entity has `lastActivityAt` timestamp field
- [x] Field updates when device properties change in the space
- [x] API exposes the field in space responses
- [x] Unit tests cover the activity tracking logic
- [x] OpenAPI spec is regenerated
