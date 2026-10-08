# Task: Companion LED Ring Support
ID: FEATURE-COMPANION-LED-RING
Type: feature
Scope: sdk
Size: small
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1245

## 1. Business goal

In order to get ambient visual feedback around the companion knob,
As a user,
I want an optional addressable LED ring that shows the current value, mode or connection status through color and
brightness.

## 2. Context

- Optional hardware. It is enabled per device by `led_ring_count > 0` on the companion device (#1238); the generator
  (#1242) emits the `light` block only then. The companion must work without it.
- The panel drives it with the `led` protocol command (#1250); the firmware handles it in `panel_protocol` (#1243).
- ESPHome has native addressable LED platforms (`esp32_rmt_led_strip`, `neopixelbus`). Choose the one supported by
  the pinned ESPHome for ESP32-S3.
- The ring is **not** modelled as a `light` channel on the companion device in v1 (it is not user-controllable from
  the backend).

## 3. Scope

**In scope**
- `led` command: `color`, `brightness`, `effect` (`solid`, `arc`, `breathe`, `flash`), `value` (0-100 for `arc`)
- Default behaviours in firmware: `breathe` while disconnected, `flash` on click confirmation
- Generator support: LED pin and count from the hardware profile and the device's `led_ring_count`
- Graceful no-op when the ring is not configured

**Out of scope**
- Complex animations (rainbow, chase), per-LED control from the panel
- Exposing the ring as a device channel

## 4. Acceptance criteria

- [ ] `{"cmd":"led","color":"#4FC3F7","brightness":80,"effect":"arc","value":50}` lights half the ring
- [ ] `flash` runs on click; `breathe` runs while the "Disconnected" overlay is shown
- [ ] With no ring configured, `led` commands are accepted and ignored (no errors)
- [ ] The LED block appears in the generated YAML only when `led_ring_count > 0`; the CI test config covers both cases
- [ ] LED updates do not block the main loop; brightness is capped by a YAML option

## 5. Example scenarios

### Scenario: Climate arc indicator

Given the `climate` screen is at 22 °C in the range 16-30
Then the ring shows a blue arc over about 43 % of the LEDs
When the value changes to 26 °C, the arc grows to about 71 %
When heating is active, the panel sends an orange color

## 6. Technical constraints

- Native ESPHome LED platforms only; no external libraries
- Typical ring sizes are 12, 16, 24 and 32 LEDs; the count comes from the device, the pin from the hardware profile

## 7. Implementation hints

```yaml
light:
  - platform: esp32_rmt_led_strip   # or the platform the pinned ESPHome recommends for ESP32-S3
    id: led_ring
    pin: ${led_pin}
    num_leds: ${led_count}
    chipset: WS2812
    rgb_order: GRB
```

## 8. AI instructions

- Read this file and the epic's protocol section; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; PR title e.g. `feat(sdk): add optional companion LED ring`. If the generator change is not trivial, put it in a separate `feat(backend): …` PR.
- For each acceptance criterion, implement it or explain why it is skipped.
