# Task: Companion LED Ring Support
ID: FEATURE-COMPANION-LED-RING
Type: feature
Scope: firmware
Size: small
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to provide ambient visual feedback around the companion knob display,
As a user,
I want an addressable LED ring around the round display that indicates the current value, mode, or status through color and brightness.

## 2. Context

- Many ESP32 round display boards include or support an external addressable LED ring (WS2812 / SK6812)
- The LED ring provides ambient feedback visible from a distance (e.g. blue glow for cooling, orange for heating)
- Controlled via the serial protocol from the panel
- ESPHome has native support for addressable LEDs (NeoPixelBus, FastLED)
- Optional hardware feature — companion should work without it
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

## 3. Scope

**In scope**
- ESPHome configuration for addressable LED ring (WS2812/SK6812)
- Serial protocol command for LED control: color, brightness, effect
- LED effects: solid color, arc indicator (partial ring lit to show value position), breathing, flash
- Domain-based default colors (climate=blue/orange, lights=warm white, etc.)
- Graceful handling when no LED ring hardware is present

**Out of scope**
- Complex LED animations (rainbow, chase, etc.)
- LED ring as primary UI element (it supplements the display, not replaces it)
- Per-LED individual control from the panel

## 4. Acceptance criteria

- [ ] LED ring lights up with domain-appropriate color when a screen is active
- [ ] Arc indicator effect: LEDs light up proportionally to current value (e.g. 50% brightness = half the ring lit)
- [ ] Serial command `{"cmd":"led","color":"#4FC3F7","brightness":80,"effect":"arc","value":50}` works
- [ ] Flash effect on click confirmation
- [ ] Breathing effect when companion is in "disconnected" state
- [ ] Component gracefully handles missing LED hardware (no errors, no output)
- [ ] LED configuration is optional in ESPHome YAML (generated only if enabled)

## 5. Example scenarios

### Scenario: Climate arc indicator

Given the companion is showing Climate screen at 22°C (range 16-30)
Then the LED ring shows a blue arc covering ~43% of the ring (proportional to value position)
When the temperature changes to 26°C, the arc extends to ~71%
When heating mode is active, the arc color changes to orange

## 6. Technical constraints

- Use ESPHome's native addressable LED platforms (no external libraries)
- LED updates should not block the main loop
- Keep LED brightness configurable (some setups may be too bright)
- Typical ring sizes: 12, 16, 24, or 32 LEDs

## 7. Implementation hints

```yaml
# ESPHome config for LED ring
light:
  - platform: neopixelbus
    id: led_ring
    type: GRB
    variant: WS2812
    pin: GPIO5
    num_leds: 24
    name: "Companion LED Ring"
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- This is a small, self-contained feature that extends the ESPHome component.
- Keep it simple — the LED ring is supplementary, not critical.
- For each acceptance criterion, either implement it or explain why it's skipped.
