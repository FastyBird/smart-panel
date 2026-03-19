# Task: Companion Screen Types Implementation
ID: FEATURE-COMPANION-SCREEN-TYPES
Type: feature
Scope: firmware, backend
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to provide appropriate visual controls for different smart home domains on the companion display,
As a user,
I want multiple screen types (arc slider, mode selector, status display, binary toggle) that render correctly on the round LCD and respond to rotary/button input.

## 2. Context

- Each screen type has a specific LVGL layout optimized for the 240x240 round display
- The ESPHome YAML generator produces LVGL config for each screen type
- The custom ESPHome component handles runtime updates for each type
- Screen types map to smart home domains (climate→arc, scenes→mode selector, etc.)
- Depends on `FEATURE-COMPANION-ESPHOME-GENERATOR` (YAML templates) and `FEATURE-COMPANION-ESPHOME-COMPONENT` (runtime updates)
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

## 3. Scope

**In scope**

### Arc Slider Screen
- Circular arc gauge around the display edge
- Center value + unit label (e.g. "22°C", "75%")
- Bottom label (entity name, e.g. "Living Room")
- Small icon above center label (domain icon)
- Rotation adjusts value within min/max range
- Click triggers primary action (toggle, cycle mode)
- Arc color configurable per domain

### Mode Selector Screen
- Centered label showing current selection
- Previous/next indicators (dots or arrows)
- Rotation cycles through options
- Click activates the selected option
- Option list (scenes, HVAC modes, etc.)

### Status Display Screen
- Multi-line info display (read-only)
- Rotation scrolls through info items
- No click action (or click navigates to next status page)
- Used for: weather, energy summary, system status

### Binary Toggle Screen
- Large icon centered (on/off state)
- State label below icon
- Click toggles state
- Rotation does nothing (or adjusts brightness if dimmable)
- Visual feedback animation on toggle

**Out of scope**
- Custom screen types designed by users
- Animated transitions between screens
- Complex multi-widget layouts

## 4. Acceptance criteria

- [ ] Arc slider renders correctly on 240x240 round display with arc, value label, entity label, and icon
- [ ] Arc slider responds to rotation within configured min/max bounds
- [ ] Arc slider click triggers configurable action (toggle, cycle_mode)
- [ ] Mode selector shows current option with navigation indicators
- [ ] Mode selector rotation cycles through options list
- [ ] Mode selector click sends activation event for selected option
- [ ] Status display shows read-only info with rotation scrolling
- [ ] Binary toggle shows on/off state with appropriate icons
- [ ] Binary toggle click sends toggle event
- [ ] All screen types update correctly when receiving serial protocol commands
- [ ] ESPHome YAML templates produce valid LVGL config for each screen type
- [ ] Screen types look visually polished on the round display (proper centering, readable fonts)

## 5. Example scenarios

### Scenario: Arc slider for thermostat

Given the companion shows an arc slider screen for "Living Room AC"
Then the display shows:
  - A colored arc from 7 o'clock to 5 o'clock position (value range 16-30)
  - "22°C" in large text at center
  - A thermometer icon above the value
  - "Living Room" label at the bottom
When the user rotates clockwise by 1 detent, the arc and label update to "23°C"

### Scenario: Mode selector for scenes

Given the companion shows a mode selector screen with options: Movie, Relax, Work
Then the display shows "Relax" as the current selection with dot indicators
When the user rotates clockwise, the selection changes to "Work"
When the user clicks the button, the "Work" scene is activated

## 6. Technical constraints

- LVGL widgets must fit within the 240x240 circular display area
- Font sizes must be readable on a 1.28" display (~50px for main value, ~16px for labels)
- Arc width should be ~20px for good visual balance
- Colors should be configurable per-screen for domain differentiation
- Animations should be smooth (use LVGL animation APIs)
- Memory usage must stay within ESP32-S3 limits

## 7. Implementation hints

### Arc Slider LVGL Layout
```
┌─────────────────────┐
│     ╭─── arc ───╮   │
│   ╭─╯           ╰─╮ │
│   │    [icon]      │ │
│   │    22°C        │ │
│   │                │ │
│   ╰─╮           ╭─╯ │
│     ╰───────────╯   │
│    Living Room       │
└─────────────────────┘
```

### Domain Color Scheme
- Climate: `#4FC3F7` (light blue)
- Lights: `#FFB74D` (warm orange)
- Media: `#CE93D8` (purple)
- Covers: `#81C784` (green)
- Scenes: `#FF8A65` (coral)
- Status: `#90A4AE` (grey)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Research LVGL widget APIs for arcs, labels, and animations.
- Both ESPHome YAML templates (backend) and runtime handling (firmware) need updating.
- For each acceptance criterion, either implement it or explain why it's skipped.
