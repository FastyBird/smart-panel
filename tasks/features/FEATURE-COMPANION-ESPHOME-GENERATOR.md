# Task: Companion ESPHome YAML Generator & Build Pipeline
ID: FEATURE-COMPANION-ESPHOME-GENERATOR
Type: feature
Scope: backend
Size: large
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to generate firmware for companion displays without manual ESPHome configuration,
As a system administrator,
I want the system to take compiled screen definitions and produce a complete ESPHome YAML config with LVGL screens, then compile it into flashable firmware.

## 2. Context

- Depends on `FEATURE-COMPANION-SCREEN-COMPILER` for compiled screen definitions
- ESPHome supports LVGL natively for building UIs on small displays
- ESPHome supports GC9A01 round displays and rotary encoders out of the box
- The generator produces YAML from templates, then calls `esphome compile` to build the binary
- A custom ESPHome component handles the serial protocol (separate task: `FEATURE-COMPANION-ESPHOME-COMPONENT`)
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

## 3. Scope

**In scope**
- YAML template system for ESPHome configs (Jinja2-style or string templates)
- Templates for each screen type (arc_slider, mode_selector, status_display, binary_toggle)
- Base template with hardware config (ESP32-S3, GC9A01, rotary encoder, WiFi, OTA)
- Generator service that merges compiled screens into a complete YAML config
- Firmware builder service that invokes `esphome compile` and produces a .bin file
- Build progress tracking (for admin UI progress indicator)
- Storing generated YAML and compiled firmware per companion

**Out of scope**
- Custom ESPHome component development (separate task)
- OTA upload to device (separate task: `FEATURE-COMPANION-PROVISIONING`)
- Supporting multiple ESP32 board variants (target one reference board for v1)

## 4. Acceptance criteria

- [ ] Base YAML template exists with ESP32-S3, GC9A01 display, rotary encoder, WiFi, OTA, and serial config
- [ ] Arc slider YAML template produces valid LVGL arc + label widgets
- [ ] Mode selector YAML template produces valid LVGL roller or button matrix widgets
- [ ] Status display YAML template produces valid LVGL label widgets
- [ ] Generator merges all screen templates into a single valid ESPHome YAML
- [ ] Generated YAML includes WiFi credentials from server configuration
- [ ] Generated YAML includes the custom serial protocol component reference
- [ ] Firmware builder calls `esphome compile` and captures output for progress tracking
- [ ] Compiled .bin file is stored and associated with the companion display
- [ ] Build errors are captured and reported to the admin
- [ ] Unit tests verify generated YAML structure for each screen type

## 5. Example scenarios

### Scenario: Generate YAML for a 3-screen companion

Given a companion display has compiled screens:
  - Screen 0: arc_slider (Climate, 16-30°C)
  - Screen 1: arc_slider (Lights, 0-100%)
  - Screen 2: mode_selector (Scenes: Movie, Relax, Work)
When the generator runs
Then it produces a valid ESPHome YAML with:
  - 3 LVGL pages
  - Rotary encoder mapped to page navigation + value adjustment
  - Button mapped to click actions
  - Serial protocol component for runtime updates

## 6. Technical constraints

- ESPHome must be installed on the server (or available as a Docker container)
- Generated YAML must pass `esphome config` validation
- Build process may take 60-120 seconds (must be async with progress tracking)
- WiFi credentials should come from server config, not hardcoded
- Store firmware binaries in a managed directory with version tracking
- Templates should be maintainable and readable

## 7. Implementation hints

### Template Structure
```
packages/companion-firmware/
├── templates/
│   ├── base.yaml.j2              # Hardware, WiFi, OTA, serial
│   ├── screens/
│   │   ├── arc_slider.yaml.j2
│   │   ├── mode_selector.yaml.j2
│   │   ├── status_display.yaml.j2
│   │   └── binary_toggle.yaml.j2
│   └── components/
│       └── panel_protocol/       # Custom component reference
└── output/                       # Generated configs + binaries
    └── {companion-id}/
        ├── config.yaml
        └── firmware.bin
```

### Build Pipeline
```typescript
async deploy(companionId: string): Promise<BuildResult> {
  const screens = await this.screenCompiler.compile(companionId);
  const yaml = await this.esphomeGenerator.generate(companionId, screens);
  await this.writeYamlToFile(companionId, yaml);
  const result = await this.firmwareBuilder.compile(companionId);
  return result; // { success, binaryPath, buildLog }
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Research ESPHome LVGL YAML syntax before writing templates.
- Keep changes scoped to backend and the firmware templates package.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
