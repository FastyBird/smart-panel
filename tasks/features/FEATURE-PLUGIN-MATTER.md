# Task: Matter plugin for standards-based device integration
ID: FEATURE-PLUGIN-MATTER
Type: feature
Scope: backend
Size: large
Parent: (none)
Status: planned
Created: 2025-11-14

## 1. Business goal

In order to support modern smart home devices using the Matter standard  
As a Smart Panel user  
I want the backend to provide a **Matter plugin** that can join a Matter fabric, discover devices, and map their endpoints and clusters to the Smart Panel device/channel/property model.

## 2. Context

- Matter is a cross-vendor standard for smart home devices.
- There exists a Node.js implementation of Matter that can be used as a basis (must be referenced as a dependency, not copy-pasted).
- Smart Panel already uses a plugin architecture for other ecosystems (Shelly, Home Assistant, etc.).
- This task is **large** and should be treated as an epic; implementation might require splitting into additional sub-tasks later.

## 3. Scope

### In scope (high level)

- New **Matter backend plugin**:
    - joining or creating a Matter fabric,
    - commissioning / onboarding Matter devices,
    - discovering endpoints and clusters.
- Mapping from Matter:
    - endpoints → Smart Panel Channels,
    - clusters/attributes → Smart Panel Properties.
- Support for core device categories, for example:
    - on/off switches,
    - dimmable lights,
    - color lights,
    - basic sensors (temperature, occupancy, etc.), where supported.
- State updates:
    - subscribe to or poll Matter attributes to keep property values in sync.
- Commands:
    - write Matter attributes and invoke commands to control devices.

### Out of scope (for this first epic-level task)

- Full UI for commissioning and managing Matter fabrics (can be separate UI/backend tasks).
- Support for every possible Matter cluster and device type.
- Multi-fabric / advanced fabric management.

## 4. Acceptance criteria (for initial version)

- [ ] A Matter plugin module exists and is integrated into the backend plugin system.
- [ ] The plugin can:
    - [ ] connect to a Matter fabric (or set up a basic one),
    - [ ] discover at least a small set of known Matter devices (e.g. test devices).
- [ ] For supported Matter device types:
    - [ ] Smart Panel Devices are created,
    - [ ] Channels represent endpoints,
    - [ ] Properties represent important clusters/attributes (on/off, level, color, selected sensor attributes).
- [ ] Property values stay synchronized with Matter attribute states.
- [ ] Commands from Smart Panel (on/off, brightness) are propagated to Matter devices.
- [ ] Core parts of the integration (wrapping the Matter library, mapping logic) are covered by **unit tests** where feasible.
- [ ] The plugin can be cleanly disabled via configuration without impacting other plugins.

## 5. Example scenarios

### Scenario: Integrating a Matter light

Given a Matter-compatible light is commissioned into the fabric  
And the Matter plugin is enabled and connected  
When the plugin synchronizes devices  
Then a Smart Panel Device is created for this Matter light  
And it has a channel with properties for on/off and brightness  
And when I toggle or dim the light via Smart Panel  
Then the Matter device responds accordingly  
And the property state stays in sync.

### Scenario: Handling unsupported clusters

Given a Matter device exposes clusters not yet supported by the mapping rules  
When the plugin processes this device  
Then it logs warnings but does not crash  
And still maps the supported clusters to properties where possible.

## 6. Technical constraints

- Use the existing Node.js Matter implementation as a dependency, not by copying source code.
- Keep Matter-specific logic inside the plugin; do not leak it into generic services.
- Respect the Matter device model:
    - endpoints,
    - clusters,
    - attributes/commands.
- Map Matter concepts onto Smart Panel device/channel/property in a way that can be extended later.

## 7. Implementation hints

- Start with a thin abstraction layer over the Matter library that:
    - handles commissioning/onboarding (even if minimal at first),
    - exposes discovered devices/endpoints/clusters in a normalized form.
- Implement a mapping layer:
    - Matter → Smart Panel,
    - Smart Panel commands → Matter attribute writes/commands.
- Begin with a very small set of supported device types (e.g. on/off light) and expand incrementally.
- Consider splitting this epic into smaller feature tasks once the initial design is clear (e.g. `FEATURE-MATTER-LIGHT`, `FEATURE-MATTER-SENSOR`, etc.).

## 8. AI instructions (for Junie / Claude)

- Treat this task as an **epic / high-level design task**.
- Read this file and `/.ai-rules/GUIDELINES.md` before coding.
- First, propose a **high-level architecture plan** for the Matter plugin, including:
    - how to wrap the Node Matter library,
    - how to model devices/endpoints/clusters,
    - how to map them into Smart Panel.
- Suggest how to break this epic into smaller feature tasks (e.g. separate tasks per device category).
- Do not start large-scale code changes without an agreed smaller sub-task; implementation will likely be done in follow-up tasks.
