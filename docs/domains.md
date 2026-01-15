# Smart Panel Domains

This document defines the domain architecture for the Smart Panel application. Domains group related device categories to enable intent-based smart home control.

## Overview

### Philosophy

The Smart Panel is designed as an **intelligent home control interface**, not just a device remote. The key principle is:

> Users don't want to control devices. They want to achieve outcomes.

Instead of asking "turn on the living room ceiling light to 60%, set the LED strip to warm white, close the blinds, and turn on the TV", users should be able to say "movie time" and have the system orchestrate all necessary changes.

### Panel Modes

The Smart Panel operates in three modes based on its physical location:

| Mode | Location | Primary Focus | Secondary Focus |
|------|----------|---------------|-----------------|
| **Room** | Bedrooms, offices, kitchens | Light, Climate, Media | Covers |
| **Entry** | Hallways, foyers, entrances | Security, Access | Light |
| **Master** | Living rooms, central areas | All domains | Full control |

### Domain Hierarchy

Domains are ordered by typical user priority:

```
┌─────────────────────────────────────────────────────────┐
│  1. LIGHTS      - Most frequently adjusted             │
│  2. CLIMATE     - Comfort is essential                 │
│  3. COVERS      - Often paired with lights             │
│  4. MEDIA       - Entertainment control                │
│  5. SECURITY    - Safety and access                    │
│  6. SENSORS     - Monitoring (read-only)               │
└─────────────────────────────────────────────────────────┘
```

---

## Domain Definitions

### Light Domain

Controls illumination and ambiance throughout the space.

**Identifier:** `lights`

**Device Categories:**
| Category | Description |
|----------|-------------|
| `lighting` | All lighting devices (bulbs, strips, fixtures) |

**Roles:**
| Role | Priority | Description | Typical Devices |
|------|----------|-------------|-----------------|
| `main` | 1 | Primary room illumination | Ceiling lights, chandeliers |
| `task` | 2 | Focused work lighting | Desk lamps, under-cabinet lights |
| `ambient` | 3 | Mood and atmosphere | Wall sconces, cove lighting |
| `accent` | 4 | Decorative highlights | Floor lamps, LED strips, spotlights |
| `night` | 5 | Low-level nighttime lighting | Night lights, pathway lights |
| `other` | 6 | Unassigned devices | Newly added lights |
| `hidden` | 99 | Excluded from UI | Utility closet lights |

**Capabilities tracked:**
- On/Off state
- Brightness (0-100%)
- Color temperature (warm to cool)
- RGB color
- White level

---

### Climate Domain

Controls indoor comfort including temperature, humidity, and air quality. For detailed implementation, see [Climate Domain Documentation](./climate-domain.md).

**Identifier:** `climate`

**Device Categories:**
| Category | Description | Primary Control |
|----------|-------------|-----------------|
| `thermostat` | Temperature control units | Yes |
| `air_conditioner` | Cooling systems | Yes |
| `heating_unit` | Heating systems | Yes |
| `air_humidifier` | Humidity addition | No |
| `air_dehumidifier` | Humidity removal | No |
| `air_purifier` | Air filtration | No |
| `fan` | Air circulation | No |

**Roles:**
| Role | Description | Intent Behavior |
|------|-------------|-----------------|
| `auto` | Supports both heating and cooling | Controlled in all modes |
| `heating_only` | Can only heat | Controlled only in HEAT mode |
| `cooling_only` | Can only cool | Controlled only in COOL mode |
| `sensor` | Monitoring only | Not controlled by intents |
| `hidden` | Excluded from UI | Not controlled by intents |

Note: Devices with no role assigned are treated as `auto`.

**Modes:**
| Mode | Description |
|------|-------------|
| `heat` | Active heating |
| `cool` | Active cooling |
| `auto` | Maintain temperature range with dual setpoints |
| `off` | Climate control disabled |

**Capabilities tracked:**
- Current temperature (averaged from all primary devices)
- Current humidity (averaged from devices with humidity sensors)
- Target temperature (single setpoint for HEAT/COOL modes)
- Heating/cooling setpoints (dual setpoints for AUTO mode)
- Mode (heat/cool/auto/off)
- Mixed state (when devices have different setpoints)

---

### Covers Domain

Controls window coverings, blinds, shades, and curtains.

**Identifier:** `covers`

**Device Categories:**
| Category | Description |
|----------|-------------|
| `window_covering` | Blinds, shades, curtains, shutters |

**Roles:**
| Role | Priority | Description | Typical Devices |
|------|----------|-------------|-----------------|
| `primary` | 1 | Main window coverings | Living room blinds, main curtains |
| `blackout` | 2 | Complete light blocking | Bedroom blackout shades |
| `sheer` | 3 | Light filtering | Sheer curtains, solar shades |
| `privacy` | 4 | Privacy without blackout | Bathroom blinds, frosted panels |
| `hidden` | 99 | Excluded from UI | Skylight covers |

**Capabilities tracked:**
- Position (0-100%, where 0=closed, 100=open)
- Tilt angle (for venetian blinds)

---

### Media Domain

Controls entertainment, audio, and visual devices.

**Identifier:** `media`

**Device Categories:**
| Category | Description |
|----------|-------------|
| `media` | General media players, streaming devices |
| `speaker` | Audio output devices |
| `television` | TVs and displays |

**Roles:**
| Role | Priority | Description | Typical Devices |
|------|----------|-------------|-----------------|
| `primary` | 1 | Main entertainment center | Living room TV, soundbar |
| `secondary` | 2 | Additional displays | Bedroom TV, kitchen display |
| `background` | 3 | Ambient audio | Multi-room speakers, ceiling speakers |
| `gaming` | 4 | Gaming systems | Consoles, gaming monitors |
| `hidden` | 99 | Excluded from UI | AV receivers (if auto-controlled) |

**Capabilities tracked:**
- Power state
- Volume level
- Mute state
- Current source/input

---

### Security Domain

Controls safety, access, and monitoring devices.

**Identifier:** `security`

**Device Categories:**
| Category | Description |
|----------|-------------|
| `alarm` | Alarm systems and panels |
| `camera` | Security cameras |
| `doorbell` | Video doorbells |
| `lock` | Smart locks |
| `door` | Door/window sensors |

**Roles:**
| Role | Priority | Description | Typical Devices |
|------|----------|-------------|-----------------|
| `access` | 1 | Entry point control | Front door lock, garage door |
| `perimeter` | 2 | Boundary monitoring | Door/window sensors |
| `monitoring` | 3 | Visual surveillance | Indoor/outdoor cameras |
| `alert` | 4 | Alarm and notification | Sirens, alarm panels |
| `hidden` | 99 | Excluded from UI | Backend controllers |

**Capabilities tracked:**
- Lock state (locked/unlocked)
- Alarm state (armed/disarmed/triggered)
- Sensor state (open/closed/motion)
- Camera feed availability

---

### Sensors Domain

Provides environmental monitoring and feedback. This domain is **read-only** - sensors inform the system but are not directly controlled.

**Identifier:** `sensors`

**Device Categories:**
| Category | Description |
|----------|-------------|
| `sensor` | All sensor types |

**Roles:**
| Role | Priority | Description | Typical Devices |
|------|----------|-------------|-----------------|
| `environment` | 1 | Environmental conditions | Temperature, humidity, pressure sensors |
| `motion` | 2 | Presence and movement | Motion detectors, occupancy sensors |
| `safety` | 3 | Safety hazards | Smoke, CO, water leak detectors |
| `energy` | 4 | Power consumption | Smart plugs with metering, energy monitors |
| `hidden` | 99 | Excluded from UI | System diagnostic sensors |

**Data provided:**
- Temperature readings
- Humidity levels
- Motion/presence detection
- Safety alerts
- Energy consumption

---

## Cross-Domain Intents

Intents orchestrate multiple domains simultaneously. Here are example intent definitions:

### Lifestyle Intents

| Intent | Light | Climate | Covers | Media | Security |
|--------|-------|---------|--------|-------|----------|
| **Morning** | Main 100%, warm | Comfort temp | Open primary | Background news | Disarm |
| **Working** | Main 80%, task 100% | 21°C, purifier on | Sheer position | Muted | - |
| **Movie** | Ambient 30%, accent on | 22°C | Close blackout | TV on, volume 40% | - |
| **Dinner** | Main 60%, warm | 22°C | Close privacy | Background music | - |
| **Sleep** | Night only, 10% | 19°C, fan low | Close all | Off | Arm night |
| **Away** | All off | Eco mode | Close all | Off | Arm away |

### Event Intents

| Intent | Description | Domain Actions |
|--------|-------------|----------------|
| **Guest Arriving** | Someone at the door | Security: show camera, unlock option. Light: entry lights on |
| **Alarm Triggered** | Security alert | Light: all on 100%. Media: mute. Security: show cameras |
| **Goodnight** | End of day routine | Progressive shutdown across all domains |
| **Welcome Home** | Arrival detected | Disarm, lights on, climate to comfort |

---

## Categories Excluded from Domains

These device categories are not assigned to any domain due to their utility-focused nature:

| Category | Reason | Alternative |
|----------|--------|-------------|
| `generic` | No defined smart behavior | Direct device control |
| `outlet` | Purpose varies by what's plugged in | Scene-based control |
| `pump` | Outdoor/utility, scheduled operation | Automation rules |
| `valve` | Plumbing control, scheduled | Automation rules |
| `sprinkler` | Irrigation, weather-dependent | Automation rules |
| `robot_vacuum` | Scheduled cleaning cycles | Dedicated app |

These devices can be included in custom scenes or automations but don't fit the ambient, intent-based control model of the primary domains.

---

## Quick Reference

### Domain-to-Category Mapping

```
Domain      │ Categories
────────────┼──────────────────────────────────────────────────────────
lights      │ lighting
climate     │ thermostat, air_conditioner, heating_unit, air_humidifier,
            │ air_dehumidifier, air_purifier, fan
covers      │ window_covering
media       │ media, speaker, television
security    │ alarm, camera, doorbell, lock, door
sensors     │ sensor
────────────┴──────────────────────────────────────────────────────────
```

### Panel Mode Domain Visibility

| Domain | Room Mode | Entry Mode | Master Mode |
|--------|-----------|------------|-------------|
| Lights | Visible | Visible | Visible |
| Climate | Visible | Hidden | Visible |
| Covers | Visible | Hidden | Visible |
| Media | Visible | Hidden | Visible |
| Security | Collapsed | Primary | Visible |
| Sensors | Status bar | Status bar | Visible |

---

## Implementation Reference

### File Structure

```
apps/panel/lib/
├── modules/
│   ├── deck/
│   │   ├── types/
│   │   │   └── domain_type.dart              # DomainType enum
│   │   ├── services/
│   │   │   ├── room_domain_classifier.dart   # Category → Domain mapping
│   │   │   └── system_views_builder.dart     # Domain view creation
│   │   ├── models/
│   │   │   └── lighting/                     # Light domain state models
│   │   └── presentation/
│   │       └── domain_pages/
│   │           └── lights_domain_view.dart   # Light domain UI
│   ├── devices/
│   │   └── views/
│   │       └── devices/
│   │           └── lighting.dart             # LightingDeviceView
│   └── spaces/
│       ├── models/
│       │   └── light_targets/                # Light target models
│       └── views/
│           └── light_targets/                # Light target views
```

### Adding a New Domain

1. **Define domain type**
   - Add to `DomainType` enum in `domain_type.dart`
   - Set icon, label, and display order

2. **Map categories**
   - Update `classifyDeviceToDomain()` in `room_domain_classifier.dart`
   - Add count field to `DomainCounts` class

3. **Create target models** (if domain has roles)
   - Add model in `spaces/models/{domain}_targets/`
   - Add view in `spaces/views/{domain}_targets/`
   - Add repository and service methods

4. **Create domain page**
   - Add page in `deck/presentation/domain_pages/`
   - Register in `buildSystemViews()`

5. **Backend support**
   - Add API endpoints for target management
   - Add database entities for role assignments
   - Generate OpenAPI spec

### Device View Classes

Each domain may have specialized device view classes:

| Domain | View Class | Location |
|--------|------------|----------|
| Lights | `LightingDeviceView` | `devices/views/devices/lighting.dart` |
| Climate | `ThermostatDeviceView` | `devices/views/devices/thermostat.dart` |
| Media | (To be implemented) | - |
| Security | (To be implemented) | - |
