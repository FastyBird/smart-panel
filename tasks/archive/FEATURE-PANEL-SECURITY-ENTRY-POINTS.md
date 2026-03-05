# Task: Panel app – Entry points snapshot (doors/windows overview)
ID: FEATURE-PANEL-SECURITY-ENTRY-POINTS
Type: feature
Scope: panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to have an immediate snapshot of all door/window sensors on the Security screen
As a Smart Panel user
I want an Entry Points section that shows open/closed counts, a list of currently open points, and optional deep link to device detail

## 2. Context

- Security screen already shows armed/alarm status and active alerts (FEATURE-PANEL-SECURITY-SCREEN)
- Panel devices module provides `DevicesService` with `getDevicesByCategory()` and reactive updates via `ChangeNotifier`
- Door devices (`DeviceCategory.door`) have `ContactChannelView` with `detected` property (true = open)
- Sensor devices (`DeviceCategory.sensor`) may also have `ContactChannelView` for window/contact sensors
- `DeviceContactMixin` provides `hasContact`, `hasContactDetected`, `isContactDetected` helpers
- Real-time updates flow through WebSocket → repositories → DevicesService → notifyListeners

## 3. Scope

**In scope**

- Add Entry Points section to Security screen below status card
- Compute open/closed/unknown counts from device contact channel state
- Render sorted list of open entry points (top 4) with icons and labels
- Handle missing data gracefully (unknown states, no sensors)
- Live updates via existing DevicesService ChangeNotifier

**Out of scope**

- Filtering by zones/rooms editor
- Historical changes timeline
- Backend changes
- Push "arm escalation" logic

## 4. Acceptance criteria

- [x] Entry Points section visible on Security screen when door/sensor devices with contact channels exist
- [x] Open/Closed counts correct and stable
- [x] Open list shows correct items, sorted deterministically (room asc, name asc, id asc)
- [x] Works with live updates, no flicker (stable ValueKeys)
- [x] Graceful empty/no-sensors state ("No entry sensors configured")
- [x] Unknown states handled (not counted as closed)
- [x] Unit tests for state mapping, count computation, and sorting stability

## 5. Example scenarios

### Scenario: Some doors open

Given 2 doors are open and 3 are closed
When the user views the Security screen
Then the Entry Points section shows "Open: 2 Closed: 3" and lists the 2 open doors

### Scenario: All closed

Given all 5 entry points are closed
When the user views the Security screen
Then the Entry Points section shows "All entry points closed" with a calm icon

### Scenario: No sensors

Given no door/sensor devices with contact channels exist
When the user views the Security screen
Then the Entry Points section shows "No entry sensors configured"

## 6. Technical constraints

- Follow existing module/service structure in `modules/security/`
- Use `ChangeNotifier` + `Provider` pattern (consume `DevicesService`)
- Do not introduce new dependencies
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints

- Use `DevicesService.getDevicesByCategory()` for `door` and `sensor` categories
- Filter to devices that have a `ContactChannelView` (via `DeviceContactMixin.hasContact`)
- Map `isContactDetected` → `isOpen` (detected = true means open)
- If `hasContactDetected` is false → unknown (null)
- Add helper functions in `utils/entry_points.dart` for testability
- Reuse `SystemPagesTheme`, `AppSpacings`, `AppFontSize`, `AppBorderRadius` from system pages

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
