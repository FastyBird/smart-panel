# Task: Custom ESPHome Component for Companion Serial Protocol + LVGL
ID: FEATURE-COMPANION-ESPHOME-COMPONENT
Type: feature
Scope: firmware
Size: large
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to have the companion display respond to real-time commands from the panel and send input events back,
As a developer,
I want a custom ESPHome component that handles the serial protocol (JSON lines over USB/UART) and bridges it to LVGL widget updates and rotary encoder input events.

## 2. Context

- ESPHome supports custom components written in C++ with Python configuration
- ESPHome has native LVGL support for rendering UI on small displays
- The serial protocol uses JSON lines format for simplicity and debuggability
- The companion receives display update commands and sends input events
- This component runs on the ESP32-S3 alongside the generated LVGL screens
- Depends on the serial protocol definition from `EPIC-COMPANION-DISPLAY`
- Related: `FEATURE-COMPANION-PANEL-SERIAL` (the other end of the protocol)

## 3. Scope

**In scope**
- Custom ESPHome component (`panel_protocol`) in C++
- JSON line parsing for incoming commands from panel
- Command handlers: screen update (set value, label, color), page navigation, LED ring control
- Event emitters: rotation (delta), click, long_press, double_click with current page index
- LVGL widget update bridge (receive command → update the correct LVGL widget)
- Connection heartbeat (panel sends periodic ping, companion responds with pong + status)
- Reconnection handling (companion shows "disconnected" screen when no heartbeat)
- ESPHome YAML configuration schema for the component

**Out of scope**
- LVGL screen layout design (handled by YAML generator)
- WiFi communication (OTA is handled by ESPHome core)
- Complex haptic feedback patterns

## 4. Acceptance criteria

- [ ] Custom component registers as an ESPHome component with YAML configuration
- [ ] Parses JSON line commands from UART: `{"cmd":"screen","id":"...","value":22}`
- [ ] Updates LVGL arc widget value and label when screen update command received
- [ ] Updates LVGL page when navigation command received: `{"cmd":"nav","page":1}`
- [ ] Sends rotation events as JSON: `{"evt":"rotate","delta":1,"page":0}`
- [ ] Sends button events: `{"evt":"click","page":0}`, `{"evt":"long_press","page":0}`, `{"evt":"double_click","page":0}`
- [ ] Heartbeat mechanism: responds to `{"cmd":"ping"}` with `{"evt":"pong","fw":"1.0.0","page":0}`
- [ ] Shows "Disconnected" overlay when no heartbeat received for 5 seconds
- [ ] Component compiles successfully with ESPHome build system
- [ ] Works with GC9A01 round display (240x240) and standard rotary encoder

## 5. Example scenarios

### Scenario: Panel sends temperature update

Given the companion is showing the Climate arc screen (page 0)
When the panel sends `{"cmd":"screen","id":"arc_0","value":24,"label":"24°C"}`
Then the LVGL arc widget animates to the new value
And the center label updates to "24°C"

### Scenario: User rotates the knob

Given the companion is on page 1 (Lights)
When the user rotates the encoder clockwise by one detent
Then the component sends `{"evt":"rotate","delta":1,"page":1}` over serial

### Scenario: Connection lost

Given the companion is receiving regular heartbeats from the panel
When no heartbeat is received for 5 seconds
Then the companion shows a semi-transparent "Disconnected" overlay
And resumes normal display when heartbeats resume

## 6. Technical constraints

- Must compile within the ESPHome build system (PlatformIO + Arduino framework)
- JSON parsing should use ArduinoJson library (already available in ESPHome)
- LVGL API calls must happen on the LVGL task thread (use `lv_task_handler` or ESPHome's display loop)
- Serial buffer must handle partial JSON lines and line breaks
- Keep memory usage low (ESP32-S3 has ~512KB SRAM)
- Component should be self-contained in a single directory for easy inclusion

## 7. Implementation hints

### Component Structure
```
packages/companion-firmware/components/panel_protocol/
├── __init__.py            # ESPHome component registration + YAML schema
├── panel_protocol.h       # Header with class definition
└── panel_protocol.cpp     # Implementation
```

### Core Class
```cpp
class PanelProtocol : public Component, public UARTDevice {
public:
  void setup() override;
  void loop() override;

  void set_arc_widget(int page, lv_obj_t* arc, lv_obj_t* label);
  void set_page_container(lv_obj_t* pages);

private:
  void process_line(const std::string& line);
  void handle_screen_command(const JsonObject& doc);
  void handle_nav_command(const JsonObject& doc);
  void handle_ping_command();
  void send_event(const char* type, int page, int delta = 0);

  std::string rx_buffer_;
  uint32_t last_heartbeat_{0};
  int current_page_{0};
};
```

### YAML Configuration
```yaml
panel_protocol:
  uart_id: panel_uart
  pages:
    - arc_id: arc_0
      label_id: lbl_0
    - arc_id: arc_1
      label_id: lbl_1
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Research ESPHome custom component development and LVGL integration before implementation.
- This is firmware-level C++ code, not backend TypeScript.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Test compilation with `esphome compile` against a test YAML config.
