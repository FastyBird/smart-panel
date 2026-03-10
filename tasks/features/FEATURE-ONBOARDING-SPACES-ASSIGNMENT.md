# Task: Enhanced spaces step with device assignment
ID: FEATURE-ONBOARDING-SPACES-ASSIGNMENT
Type: feature
Scope: admin
Size: medium
Parent: EPIC-ONBOARDING-DEVICE-SETUP
Status: done

## 1. Business goal

In order to organize my discovered devices into rooms during initial setup,
As a new user,
I want the spaces step to show my discovered devices and let me assign them to rooms.

## 2. Context

The current onboarding spaces step (`step-spaces.vue`) allows quick creation of rooms using category buttons and custom names. However, it does not show discovered devices or allow assignment.

This task enhances the spaces step to:
1. Suggest rooms based on discovered device names
2. Show discovered devices alongside room creation
3. Allow drag-and-drop or select-based device-to-room assignment
4. Use patterns from the existing spaces onboarding wizard (`view-spaces-onboarding.vue`)

**Existing code:**
- `apps/admin/src/modules/onboarding/components/step-spaces.vue` — current quick-add spaces step
- `apps/admin/src/modules/spaces/views/view-spaces-onboarding.vue` — full spaces wizard with device/display assignment
- `apps/admin/src/modules/devices/` — device stores and components

## 3. Scope

**In scope**

- Heuristic space suggestion based on device names
- Device list grouped by integration, showing unassigned devices
- Assignment UI: select space for each device (or drag-and-drop)
- Bulk assignment (select multiple devices → assign to space)
- "Unassigned devices" section
- Summary counts per space (X devices assigned)
- Preserve existing quick-add functionality

**Out of scope**

- Display-to-space assignment (can be added later)
- Device channel configuration
- Space page/dashboard auto-creation
- Device rename during assignment

## 4. Acceptance criteria

- [x] Spaces step shows discovered devices (from previous discovery step)
- [x] Devices without a clear room name appear in "Unassigned" section
- [x] Heuristic suggests spaces from device names (e.g., "Living Room Light" → "Living Room")
- [x] User can assign devices to spaces via dropdown or drag-and-drop
- [x] User can bulk-select devices and assign to a space
- [x] Each space card shows count of assigned devices
- [x] Quick-add category buttons still work alongside device assignment
- [x] Step works correctly even with no discovered devices (graceful degradation to current behavior)
- [x] Assignments are saved during `completeOnboarding()`

## 5. Example scenarios

### Scenario: Auto-suggested spaces from device names

Given discovery found devices named "Living Room Lamp", "Kitchen Light", "Bedroom Sensor"
When I reach the spaces step
Then I see suggested spaces: "Living Room", "Kitchen", "Bedroom"
And "Living Room Lamp" is pre-assigned to "Living Room"
And "Kitchen Light" is pre-assigned to "Kitchen"
And I can accept or modify these suggestions

### Scenario: Manual assignment

Given discovery found 5 devices with generic names (e.g., "Shelly1-AB12CD")
When I reach the spaces step
Then all devices appear in the "Unassigned" section
And I can create spaces manually and assign devices to them

### Scenario: No devices discovered

Given no devices were discovered (discovery was skipped)
When I reach the spaces step
Then the step behaves like the current quick-add spaces step
And there is no device assignment section

## 6. Technical constraints

- Reuse existing device store for device data
- Use `spacesToCreate` from onboarding composable for new spaces
- Device assignment should use existing bulk-assignment API from spaces module
- Keep UI responsive for large device counts (50+ devices)

## 7. Implementation hints

**Room name extraction heuristic:**
```typescript
const ROOM_TOKENS = [
  'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office',
  'Garage', 'Garden', 'Hallway', 'Dining Room', 'Basement',
  'Attic', 'Laundry', 'Nursery', 'Guest Room', 'Patio',
];

function suggestRoom(deviceName: string): string | null {
  const lower = deviceName.toLowerCase();
  return ROOM_TOKENS.find(room => lower.includes(room.toLowerCase())) ?? null;
}
```

**UI layout:**
- Left panel: spaces list with device counts
- Right panel: device list with space assignment dropdown
- Or: single list with drag-and-drop between space groups

## 8. AI instructions

- Read this file entirely before making any code changes
- Study existing `view-spaces-onboarding.vue` for assignment patterns
- Preserve backward compatibility with no-discovery flow
- Keep the UI simple — avoid over-engineering the first version
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
