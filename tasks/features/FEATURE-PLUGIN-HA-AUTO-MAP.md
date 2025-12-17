# Task: Automatic entity mapping for Home Assistant plugin
ID: FEATURE-PLUGIN-HA-AUTO-MAP
Type: feature
Scope: backend
Size: large
Parent: (none)
Status: done
Created: 2025-11-14

## 1. Business goal

In order to make Home Assistant integration as convenient as the Shelly integration  
As a Smart Panel user  
I want the Home Assistant plugin to automatically map **HA entities** to Smart Panel devices/channels/properties, instead of requiring manual creation and wiring for each entity.

## 2. Context

- A Home Assistant plugin already exists in the backend.
- Currently, adding HA entities requires manual steps:
    - creating devices,
    - creating channels,
    - creating properties,
    - mapping them to HA entities/attributes.
- Goal: achieve a similar experience to Shelly:
    - connect HA,
    - automatically see Smart Panel devices populated from HA entities.
- HA exposes:
    - device and entity registries,
    - state updates via WebSocket and/or HTTP.

## 3. Scope

### In scope

- Extend the existing Home Assistant plugin to:
    - fetch and use HA **device/entity registry** information,
    - automatically create Smart Panel Devices for HA devices,
    - automatically create Channels and Properties for their entities/attributes.
- Define mapping rules for common HA entity types, e.g.:
    - `light.*` (on/off, brightness, color),
    - `switch.*`,
    - `sensor.*` (temperature, humidity, power, etc.),
    - `climate.*` (for thermostat-like devices).
- State updates:
    - update Smart Panel properties whenever HA entity states change.
- Commands:
    - propagate Smart Panel property changes back to HA (e.g. toggle a light, change brightness).

### Out of scope

- Admin UI for customizing/influencing mapping rules (this can be a follow-up).
- Panel UI adaptations (tiles/device detail) for new types.
- Migration of any existing manually created mappings (can be manual or future task).

## 4. Acceptance criteria

- [x] On initial sync, the HA plugin:
    - [x] fetches device/entity registry from HA,
    - [x] creates Smart Panel Devices for HA devices,
    - [x] creates Channels/Properties for the associated entities.
- [x] Common entity types are correctly mapped:
    - [x] lights,
    - [x] switches,
    - [x] common sensors (temperature, humidity, power),
    - [x] climate devices (basic thermostat fields).
- [x] State changes in HA are reflected in Smart Panel property values.
- [x] Commands from Smart Panel are sent to HA and change entity state.
- [x] Mapping logic is covered by **unit tests** and is resilient to unknown/unsupported entity types.
- [x] Existing HA plugin configuration is kept compatible (no breaking changes).

## 5. Example scenarios

### Scenario: Auto-mapping of HA light entities

Given I have multiple `light.*` entities in Home Assistant  
And the HA plugin is configured and connected  
When the backend performs initial registry sync  
Then Smart Panel Devices are created for the corresponding HA devices  
And each light entity is mapped to a channel + properties for on/off and brightness  
And toggling a Smart Panel property toggles the light in HA.

### Scenario: Auto-mapping of HA sensors

Given I have `sensor.*` entities in HA (temperature, humidity, etc.)  
When initial sync runs  
Then Smart Panel sensor properties are created and reflect the HA state  
And further state updates from HA update the Smart Panel properties.

## 6. Technical constraints

- Build on top of the existing HA plugin structure:
    - re-use its WebSocket/HTTP communication layer where possible.
- Do not hardcode entity IDs; base mapping on entity domains (`light`, `sensor`, `switch`, `climate`, etc.) and attributes.
- Keep mapping rules configurable/extendable in code, even if no UI exists yet.
- Handle unknown or unsupported entity types gracefully:
  - skip mapping with structured warning (entity_id, domain, device_class),
  - emit a metric/counter for observability,
  - optionally enqueue a task to review new domains.

## 7. Implementation hints

- Introduce a mapping service that:
    - inspects HA entity metadata (domain, device class, unit, etc.),
    - decides which Smart Panel category/data type to use,
    - creates the appropriate Device/Channel/Properties via existing services.
- Consider organizing mapping rules by domain (e.g. `lightMapping`, `sensorMapping`, etc.).
- Start with a subset of entities and expand in future tasks.

## 8. AI instructions (for Junie / Claude)

- Read this file fully before coding.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
- Before implementing, propose a **5–10 step plan** that:
    - identifies existing HA plugin services,
    - introduces a mapping layer,
    - extends sync and updates,
    - adds tests.
- Implement incrementally and summarize file changes after each major step.
- Do not change admin or panel code in this task.
