# Task: WLED plugin for addressable LED controllers
ID: FEATURE-PLUGIN-WLED
Type: feature
Scope: backend
Size: medium
Parent: (none)
Status: done (superseded by FEATURE-WLED-PLUGIN)
Created: 2025-11-14

## 1. Business goal

In order to control existing WLED-based LED controllers from the Smart Panel  
As a Smart Panel user  
I want a backend plugin that can discover and control **WLED** devices (on/off, brightness, color, basic effects) and map them to the standard device/channel/property model.

## 2. Context

- WLED devices expose a well-known HTTP/JSON and UDP API for control and state.
- WLED is already used in the installation and should be controllable from the Smart Panel.
- The Node.js package **`wled-client`** is available and can be used as a typed client for talking to WLED:
    - It should be used as the **primary communication layer** wherever it fits the needs of this plugin.
    - If some features are not covered by `wled-client`, the plugin may use direct HTTP calls to the WLED JSON API as a fallback.
- This task focuses only on **backend integration**:
    - discovery and configuration,
    - mapping WLED state and controls,
    - sending commands.

UI representation (tiles, color pickers, effect selection) will be done in separate tasks.

## 3. Scope

### In scope

- New **WLED backend plugin** within the Smart Panel backend.
- Plugin registration & configuration:
    - enable/disable,
    - list of WLED hosts (manual configuration for the first iteration),
    - optional auto-discovery can be marked as TODO (e.g. via mDNS or future scheduler).
- Device mapping:
    - each configured WLED instance becomes a **Device**,
    - channels for:
        - primary light output,
        - optional segments or effects (only if it does not overcomplicate the MVP).
- Property mapping (minimum examples):
    - on/off (boolean),
    - brightness (0–100% or 0–255 mapped consistently with panel conventions),
    - primary color (RGB or HSV, mapped to panel color model),
    - selected effect (string/enum),
    - optionally effect speed/intensity if it can be mapped cleanly.
- Commands:
    - toggle on/off,
    - set brightness,
    - set color,
    - select an effect.
- Periodic state refresh or subscription/push (depending on WLED and `wled-client` capabilities).

### Out of scope

- Complex WLED features (presets, playlists, macros, playlists scheduling).
- Full support for every advanced effect parameter.
- Admin/panel UI for configuring effects and advanced options.

These can be addressed in follow-up tasks.

## 4. Acceptance criteria

- [ ] New WLED plugin module exists and is wired into the backend plugin system (consistent naming, e.g. `plugins/wled`).
- [ ] Plugin can be **enabled/disabled** via configuration.
- [ ] When enabled and configured with at least one WLED host:
    - [ ] a corresponding **Device** is created for each configured host,
    - [ ] channels and properties are created for on/off, brightness, color, and a basic effect selector (at minimum).
- [ ] Property values reflect the actual state of the WLED device:
    - [ ] after initial sync,
    - [ ] after commands are sent from the Smart Panel backend.
- [ ] Commands sent via the Smart Panel API (on/off, brightness, color, basic effect) are applied to the underlying WLED instance.
- [ ] All new services have **unit tests** for at least:
    - [ ] WLED API client / adapter,
    - [ ] mapping functions (WLED → properties, properties → WLED commands).
- [ ] No breaking changes to other plugins or devices.

## 5. Example scenarios

### Scenario: Turning a WLED strip on/off

Given I have a WLED controller configured in the plugin  
When the backend starts  
Then a Device is created for that WLED instance  
And when I toggle the corresponding on/off property via API  
Then the WLED LED strip turns on/off  
And the property state is updated accordingly.

### Scenario: Changing color and brightness

Given the WLED device is online  
When I set brightness and color properties via the API  
Then the physical LED strip changes to the requested brightness and color  
And the backend reflects the final state.

### Scenario: Selecting a basic effect

Given the WLED device supports effects  
When I change the effect property via the API (using a supported subset)  
Then the chosen effect is applied on the strip  
And the backend reflects the current effect.

## 6. Technical constraints

- Follow the same overall structure as other plugins:
    - plugin module,
    - service(s) for communication,
    - mapping services,
    - config handling.
- Prefer using the **`wled-client`** library as the primary interface to WLED:
    - encapsulate it in a dedicated adapter/service so that the rest of the plugin does not depend on library-specific details,
    - if `wled-client` lacks specific endpoints/operations, supplement it with direct HTTP calls to the official WLED JSON API as a fallback.
- Do not embed WLED-specific logic into generic devices services; keep it within the plugin.
- Respect the core devices model:
    - use appropriate categories (e.g. `light`, `effects`, etc.),
    - use correct data types for color, brightness, on/off, effect selection.
- Network / IO:
    - implement non-blocking, async communication,
    - avoid tight polling loops; if polling is used, keep intervals reasonable and configurable,
    - apply client-side debouncing/rate limiting for rapid property changes (e.g. color/brightness) to prevent device overload.

## 7. Implementation hints

- Start with a small, typed **WLED client adapter service** that wraps `wled-client` and (if needed) additional HTTP calls:
    - methods for reading current state,
    - methods for applying state (on/off, brightness, color, effect).
- Create a **mapping layer** that:
    - converts WLED state → Device/Channel/Property values,
    - converts property commands → WLED API calls via the adapter.
- For the first iteration, manual configuration of WLED hosts is sufficient:
    - later tasks can add mDNS/auto-discovery behavior.
- Consider using a simple periodic refresh mechanism:
    - e.g. poll every N seconds for state from each configured WLED host,
    - or rely on `wled-client` capabilities if it supports subscriptions/events.
- Align color model and value ranges with existing light/LED plugins so that the panel and admin can reuse existing UI components.

## 8. AI instructions

- Read this file fully before coding.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
- Before changing code, propose a **5–10 step implementation plan**, including:
    - WLED client adapter,
    - plugin wiring,
    - mapping,
    - tests.
- Explicitly state how `wled-client` will be used and whether any direct HTTP calls are needed.
- Implement the feature in incremental, reviewable steps and summarize file changes after each major step.
- Do not modify admin or panel code in this task.
- Treat WLED support as a plugin that can be cleanly enabled/disabled.
