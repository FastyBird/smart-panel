# Task: Companion Firmware Package & `panel_protocol` ESPHome Component
ID: FEATURE-COMPANION-ESPHOME-COMPONENT
Type: feature
Scope: sdk
Size: large
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1243

## 1. Business goal

In order to have the companion respond to real-time commands from the panel and send knob input back,
As a developer,
I want a firmware package with an ESPHome external component that speaks the companion serial protocol
(JSON lines over USB CDC) and connects it to LVGL widgets and the rotary encoder, compiled in CI.

## 2. Context

- The decisions D9 and D10 in `EPIC-COMPANION-DISPLAY` apply.
- Location: `packages/companion-firmware/`. Commit scope `sdk` (`packages/**`; there is no `firmware` scope).
  The directory has no `package.json`, so pnpm (`pnpm-workspace.yaml` includes `packages/**`) does not treat it as a
  workspace package.
- ESPHome loads custom code through `external_components`; the legacy `custom_component` mechanism is gone.
- The generator (#1242) references the component from the copy the backend ships in
  `apps/backend/static/companion-firmware/` (synced from this package at backend build time). The export YAML
  references this package by git tag.
- The ESP32-S3 USB-Serial/JTAG (or a USB-UART bridge on some boards) is the protocol channel. The ESPHome logger
  must not write to it.
- The other end of the protocol is `FEATURE-COMPANION-PANEL-SERIAL` (#1249/#1250).
- CI: `.github/workflows/ci-tests.yaml` has no firmware job yet.

## 3. Scope

**In scope**
- `packages/companion-firmware/` layout: `README.md`, `components/panel_protocol/` (`__init__.py`, `.h`, `.cpp`),
  `boards/reference.yaml` (substitutions for the reference board), `tests/ci-reference.yaml`
- Protocol v1 parsing (line buffering, max line length, malformed input ignored) and emitting
- Commands: `hello`, `ping`, `nav`, `screen`, `options`, `led` (forwarded to the LED ring hook, #1245)
- Events: `pong` (`proto`, `fw`, `build`, `mac`, `ip`), `rotate` (`delta`, `screen`), `press`, `double_press`,
  `long_press`, `down`, `up` (`screen`), matching the `button` channel event names in `docs/hardware-inputs.md`
- Local echo: rotation moves the active arc/selector immediately; the panel's `screen` command is authoritative
- Heartbeat: a "Disconnected" overlay after 5 s without `ping`
- YAML schema for the component (UART/USB CDC id, screen bindings by key)
- New CI job in `.github/workflows/ci-tests.yaml`: path-filtered on `packages/companion-firmware/**` and
  `apps/backend/src/plugins/devices-companion/**`. It installs the pinned ESPHome, caches PlatformIO, runs
  `esphome config` + `esphome compile tests/ci-reference.yaml`, and uploads the binary size as a job summary

**Out of scope**
- LVGL layout and visuals per screen type (#1244); the LED ring effects (#1245)
- WiFi/OTA (ESPHome core)
- Haptics

## 4. Acceptance criteria

- [ ] `packages/companion-firmware/components/panel_protocol` loads through `external_components: [{ source: { type: local, path: … } }]`
- [ ] Commands and events follow the epic's protocol v1. Unknown commands are ignored and reported once as `{"evt":"error","code":"unknown_cmd"}`
- [ ] Partial lines, CRLF/LF, and lines over the maximum length (e.g. 512 B) are handled without crashes or leaks
- [ ] `pong` reports the `build` substitution, the firmware version, the MAC and the current IP (empty when WiFi is off)
- [ ] Encoder detents emit `rotate` with signed `delta` (coalesced within the main-loop tick); the button emits `down`/`up` plus one of `press`/`double_press`/`long_press`, with timings configurable in YAML
- [ ] LVGL updates happen on the ESPHome main loop (no cross-task LVGL calls)
- [ ] The "Disconnected" overlay appears after 5 s without `ping` and clears on the next `ping`
- [ ] The logger is configured off the protocol port in the reference configs
- [ ] The CI job compiles `tests/ci-reference.yaml` with the pinned ESPHome on every relevant change and fails the build on compile errors
- [ ] A copy step (backend build script or `nest-cli.json` asset rule) places the component under the backend's `static/companion-firmware/` (it may land with #1242 if that PR comes first)

## 5. Example scenarios

### Scenario: Panel sends a climate update

Given the companion shows the `climate` screen
When the panel sends `{"cmd":"screen","screen":"climate","value":24,"min":16,"max":30,"step":0.5,"unit":"°C","label":"Living Room"}`
Then the arc animates to 24 and the center label shows "24 °C"

### Scenario: User rotates the knob

Given the companion is on the `lighting` screen
When the user turns the encoder one detent clockwise
Then the arc moves locally and the component sends `{"evt":"rotate","delta":1,"screen":"lighting"}`

### Scenario: Connection lost

Given regular pings arrive
When no ping arrives for 5 seconds
Then a semi-transparent "Disconnected" overlay is shown until pings resume

## 6. Technical constraints

- Compile with the pinned ESPHome version used by the backend toolchain (one version constant, documented in the package README)
- Use ESPHome's bundled JSON support (ArduinoJson); no extra libraries
- Keep RAM low (static buffers, no per-line heap churn)
- The framework (esp-idf vs arduino) is fixed in `boards/reference.yaml` after the spike; the component must not depend on Arduino-only APIs if esp-idf is chosen

## 7. Implementation hints

```cpp
class PanelProtocol : public Component, public uart::UARTDevice {
 public:
  void setup() override;
  void loop() override;
  void register_screen(const std::string &key, lv_obj_t *page, lv_obj_t *value_widget, lv_obj_t *label);
  void on_rotate(int delta);          // wired from rotary_encoder on_clockwise/on_anticlockwise
  void on_button(const char *event);  // wired from binary_sensor on_press/on_release/on_multi_click

 private:
  void process_line_(const char *line, size_t len);
  void send_event_(const char *evt, const char *screen, int delta = 0);
  char rx_buf_[512];
  size_t rx_len_{0};
  uint32_t last_ping_ms_{0};
  std::string active_screen_{"idle"};
};
```

```yaml
panel_protocol:
  uart_id: panel_link
  build: ${build_hash}
  screens:
    - key: climate
      page_id: page_climate
      value_id: arc_climate
      label_id: lbl_climate
```

## 8. AI instructions

- Read this file and the epic's protocol section; check the ESPHome docs for `external_components`, `lvgl`, `rotary_encoder` and the USB CDC/logger options of the pinned version; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; PR title e.g. `feat(sdk): add companion firmware package with panel_protocol component`. The PR also adds the CI job in `.github/workflows/ci-tests.yaml`.
- Verify locally with `esphome compile packages/companion-firmware/tests/ci-reference.yaml`.
- For each acceptance criterion, implement it or explain why it is skipped.
