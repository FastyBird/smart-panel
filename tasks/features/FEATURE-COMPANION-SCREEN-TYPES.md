# Task: Companion Screen Types Implementation
ID: FEATURE-COMPANION-SCREEN-TYPES
Type: feature
Scope: sdk, backend
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1244

## 1. Business goal

In order to get suitable visual controls for each space domain on the companion,
As a user,
I want the screen types (arc slider, mode selector, status display, binary toggle, idle) to render well on the
240×240 round LCD and respond to the knob.

## 2. Context

- The decisions D8 and D10 in `EPIC-COMPANION-DISPLAY` apply. Screen keys and types come from the compiler (#1239);
  values, labels, ranges and options are pushed at runtime by the panel (#1250). The firmware only bakes in the
  layout per screen type.
- Two surfaces:
  - `packages/companion-firmware` (`sdk`): LVGL behaviour in the `panel_protocol` component (value/option binding,
    local echo, animations) and a visual test config per type
  - `apps/backend/src/plugins/devices-companion/services/esphome-generator.service.ts` (`backend`): the LVGL page
    YAML each type emits
- Depends on #1242 (generator) and #1243 (component).

## 3. Scope

**In scope**

### Arc slider (`lighting`, `climate`, `covers`, `media`)
- 270° arc around the edge, large value + unit in the center, target label at the bottom, domain icon above
- Rotation moves within min/max by `step` (local echo); click/long-press per `clickAction`/`targets`
- Per-domain arc color

### Mode selector (`overview` with scenes, climate mode cycling overlay)
- Current option centered, previous/next hints, position dots
- Rotation changes the selection; click activates

### Status display (`overview` without scenes, `sensors`, `energy`)
- One reading per view (label, value, unit); rotation browses; click does nothing

### Binary toggle (reserved; see #1239)
- Large state icon and label; click toggles; toggle animation

### Idle (built-in)
- Clock/label pushed by the panel; shown for deck items without a companion screen and before the first `nav`

**Out of scope**
- User-designed screens, animated transitions between screens, multi-widget layouts

## 4. Acceptance criteria

- [ ] Each type has a generator emitter in `esphome-generator.service.ts` and a firmware binding in `panel_protocol`
- [ ] The arc slider renders arc, value + unit, label and icon inside the round safe area; rotation respects min/max/step
- [ ] Mode selector and status display handle 1..N options/readings (N ≤ 16) with wrap-around rules documented
- [ ] Binary toggle and idle screens exist and compile even if v1 compiles no `binary_toggle`
- [ ] All types update from `screen`/`options` commands without a re-flash
- [ ] `packages/companion-firmware/tests/` has a config with every type, compiled by the CI job from #1243
- [ ] Backend unit tests cover the YAML emitted per type; photos of each type on the reference board are attached to the PR

## 5. Example scenarios

### Scenario: Arc slider for the thermostat

Given the `climate` screen shows 22 °C in the range 16-30
Then the arc runs from about the 7 o'clock to the 5 o'clock position, "22 °C" is centered, a thermometer icon sits above it and "Living Room" below
When the user rotates one detent clockwise, the arc and label show 22.5 °C immediately

### Scenario: Scene selector on overview

Given the `overview` screen lists Movie, Relax, Work with Relax selected
When the user rotates clockwise, Work is selected
When the user clicks, the panel triggers the Work scene

## 6. Technical constraints

- Fit the 240×240 circular area; main value about 48 px, labels about 16 px, arc width about 20 px
- Fonts and icons limited to the glyphs used (flash/RAM budget on ESP32-S3)
- Animations through LVGL APIs, without blocking the main loop
- Domain colors as generator substitutions, not hard-coded in C++

## 7. Implementation hints

- Domain colors: climate `#4FC3F7`, lighting `#FFB74D`, media `#CE93D8`, covers `#81C784`, overview/scenes `#FF8A65`, status `#90A4AE`
- Keep per-type LVGL YAML emitters as small pure functions; share the arc/label base

## 8. AI instructions

- Read this file and the epic's Decisions; check the pinned ESPHome LVGL widget docs; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`. The work touches `packages/` and `apps/backend/`: use `feat(sdk): …` and keep the backend emitter changes small, or split them into a `feat(backend): …` PR if review prefers.
- For each acceptance criterion, implement it or explain why it is skipped.
