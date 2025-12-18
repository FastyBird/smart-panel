# Task: Window Covering Device Page Implementation
ID: FEATURE-WINDOW-COVERING-DEVICE-PAGE
Type: feature
Scope: panel
Size: medium
Parent: (none)
Status: planned

## 1. Business Goal

In order to control window covering devices (blinds, curtains, rollers, outdoor blinds)
As a smart home user
I want to have a dedicated device detail page with intuitive controls and visual feedback

## 2. Context

### Existing Code References
- **Device View**: `apps/panel/lib/modules/devices/views/devices/window_covering.dart` - Already implemented
- **Channel View**: `apps/panel/lib/modules/devices/views/channels/window_covering.dart` - Already implemented
- **Placeholder Page**: `apps/panel/lib/features/dashboard/presentation/devices/window_covering.dart` - Has warning message to replace
- **Reference Implementation**: `apps/panel/lib/features/dashboard/presentation/devices/lighting.dart` - Full device page example with sliders and controls

### Device Specification (from `spec/devices/channels.json`)

**Required Properties:**
| Property | Type | Permissions | Values/Range | Description |
|----------|------|-------------|--------------|-------------|
| `status` | enum | ro | opened, closed, opening, closing, stopped | Current movement state |
| `position` | uchar | rw | 0-100% | Current position (0=closed, 100=open) |
| `type` | enum | ro | curtain, blind, roller, outdoor_blind | Type of window covering |
| `command` | enum | wo | open, close, stop | Control commands |

**Optional Properties:**
| Property | Type | Permissions | Values/Range | Description |
|----------|------|-------------|--------------|-------------|
| `obstruction` | bool | ro | true/false | Obstruction detected |
| `tilt` | float | rw | -90° to 90° | Tilt angle (for blinds) |
| `fault` | uchar | ro | 0-255 | Fault code |

### Existing Mixins Used
- `DeviceDeviceInformationMixin` - Device info display
- `DeviceBatteryMixin` - Battery status (optional)
- `DeviceElectricalEnergyMixin` - Energy consumption (optional)
- `DeviceElectricalPowerMixin` - Power monitoring (optional)

## 3. Scope

**In scope**
- Main window covering device detail page with visual representation
- Position control slider (vertical, 0-100%)
- Open/Close/Stop command buttons
- Animated window covering visual that reflects position
- Status indicator showing current state (opening, closing, stopped, etc.)
- Type-specific icons (curtain, blind, roller, outdoor_blind)
- Optional tilt control slider (when device supports it)
- Obstruction warning indicator (when detected)
- Fault indicator (when present)
- Battery status display (when available)
- Electrical energy/power tiles (when available)
- Localization strings for all UI elements

**Out of scope**
- Multiple window covering channels per device (single channel assumed)
- Custom scenes/presets for positions
- Scheduling functionality
- Backend/admin changes

## 4. Acceptance Criteria

### Core Functionality
- [ ] Replace the warning placeholder with a functional device detail page
- [ ] Display current position percentage prominently
- [ ] Provide a vertical slider to adjust position (0-100%)
- [ ] Include Open, Close, Stop command buttons
- [ ] Show current status (opened, closed, opening, closing, stopped)
- [ ] Display type-specific icon (curtain/blind/roller/outdoor_blind)

### Visual Feedback & Animation
- [ ] Animated window covering visual that updates with position changes
- [ ] Visual distinction between opening/closing states (animation or indicator)
- [ ] Smooth slider interaction with immediate visual feedback
- [ ] Status color coding (e.g., green for open, gray for closed, blue for moving)

### Optional Features (graceful degradation)
- [ ] Show tilt control slider only when device supports tilt
- [ ] Show obstruction warning only when obstruction property exists and is true
- [ ] Show fault indicator only when fault property exists and has non-zero value
- [ ] Show battery status tile when battery channel is available
- [ ] Show electrical energy/power tiles when those channels are available

### Localization
- [ ] Add all required localization strings to `app_en.arb` and `app_cs.arb`
- [ ] Localize status values (opened, closed, opening, closing, stopped)
- [ ] Localize type names (curtain, blind, roller, outdoor blind)
- [ ] Localize button labels and descriptions

## 5. Example Scenarios

### Scenario: User opens the blinds fully
Given the window covering device is displayed
And the current position is 30%
When the user drags the position slider to 100%
Then the command is sent to the device
And the visual shows the blinds opening
And the status shows "opening"
And when complete, the status shows "opened"

### Scenario: User stops movement mid-way
Given the window covering is currently opening
When the user taps the Stop button
Then the stop command is sent
And the status shows "stopped"
And the visual freezes at the current position

### Scenario: Device has tilt support
Given the window covering device supports tilt (is a blind type)
When the device page is displayed
Then a tilt slider is shown below the main controls
And the user can adjust tilt from -90° to 90°

### Scenario: Obstruction detected
Given the window covering device has obstruction detection
And an obstruction is detected
When the device page is displayed
Then a warning indicator shows "Obstruction detected"

## 6. Technical Constraints

- Follow the existing module/service structure in `apps/panel/lib/features/dashboard/`
- Use `ColoredSlider` widget for position control (vertical orientation)
- Use `PropertyValueHelper` pattern from lighting page for API calls
- Use `ScreenService` and `VisualDensityService` for responsive scaling
- Follow existing theme patterns (`AppSpacings`, `AppColors`, `AppFontSize`)
- Do not modify generated code in `apps/panel/lib/spec/` or `apps/panel/lib/api/`
- Use Material Design Icons (`material_design_icons_flutter`)
- Support both light and dark themes

## 7. Implementation Hints

### Widget Structure
```
WindowCoveringDeviceDetailPage (StatefulWidget)
├── AppTopBar
├── Body
│   ├── Left Section (info + tiles)
│   │   ├── WindowCoveringStatus (position %, status text)
│   │   ├── WindowCoveringCommandButtons (Open/Stop/Close)
│   │   ├── WindowCoveringTiltControl (optional)
│   │   ├── WindowCoveringWarnings (obstruction, fault)
│   │   └── WindowCoveringTiles (battery, energy, power)
│   └── Right Section (visual + slider)
│       ├── WindowCoveringVisual (animated graphic)
│       └── PositionSlider (vertical ColoredSlider)
```

### Icon Mapping
```dart
WindowCoveringTypeValue.curtain -> MdiIcons.curtains
WindowCoveringTypeValue.blind -> MdiIcons.blindsHorizontal
WindowCoveringTypeValue.roller -> MdiIcons.rollerShade
WindowCoveringTypeValue.outdoorBlind -> MdiIcons.blindsHorizontalClosed
```

### Status Icon/Color Mapping
```dart
opened -> MdiIcons.arrowExpandVertical / green
closed -> MdiIcons.arrowCollapseVertical / gray
opening -> MdiIcons.arrowUp / blue (animated)
closing -> MdiIcons.arrowDown / blue (animated)
stopped -> MdiIcons.pause / orange
```

### Animation Approach
- Use `AnimatedContainer` or `TweenAnimationBuilder` for smooth position changes
- Consider using `CustomPainter` for the window covering visual
- Show pulsing or rotating animation during opening/closing states

### Reference Files
- `apps/panel/lib/features/dashboard/presentation/devices/lighting.dart` - UI patterns
- `apps/panel/lib/core/widgets/colored_slider.dart` - Slider widget
- `apps/panel/lib/modules/devices/views/devices/window_covering.dart` - Data access

## 8. AI Instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope` (panel only).
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Ensure graceful handling of optional properties (not all devices have tilt, obstruction, etc.)
- Test with both light and dark theme in mind
- Use existing patterns from the lighting device page as reference

## 9. Implementation Steps

1. **Add localization strings** - Add all required translations to `app_en.arb` and `app_cs.arb`
2. **Create WindowCoveringVisual widget** - Animated visual representation of the window covering
3. **Create WindowCoveringPositionSlider** - Vertical slider for position control
4. **Create WindowCoveringCommandButtons** - Open/Stop/Close buttons
5. **Create WindowCoveringStatus widget** - Position percentage and status display
6. **Create WindowCoveringTiltControl** - Optional tilt slider (conditional render)
7. **Create WindowCoveringWarnings** - Obstruction and fault indicators
8. **Create WindowCoveringTiles** - Battery and electrical info tiles
9. **Assemble WindowCoveringDeviceDetailPage** - Main page combining all components
10. **Test and refine** - Verify all acceptance criteria are met

## 10. Localization Keys to Add

```
window_covering_status_opened
window_covering_status_closed
window_covering_status_opening
window_covering_status_closing
window_covering_status_stopped
window_covering_type_curtain
window_covering_type_blind
window_covering_type_roller
window_covering_type_outdoor_blind
window_covering_command_open
window_covering_command_close
window_covering_command_stop
window_covering_position_label
window_covering_position_description
window_covering_tilt_label
window_covering_tilt_description
window_covering_obstruction_warning
window_covering_fault_warning
```
