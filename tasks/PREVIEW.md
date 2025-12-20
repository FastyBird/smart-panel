# Tasks Overview

This page provides an overview of all tasks in the Smart Panel project, organized by type and status.

## Summary

| Status | Count |
|--------|-------|
| Done | 14 |
| Planned | 10 |
| **Total** | **24** |

---

## Features

### Completed

| ID | Title | Scope | Size |
|----|-------|-------|------|
| FEATURE-WLED-PLUGIN | WLED Device Plugin | backend, admin, panel | large |
| FEATURE-CONFIG-CONSOLIDATION | Configuration Module Consolidation | backend, admin, panel | large |
| FEATURE-LINUX-DEVICE-INSTALLATION | Linux Device Installation | backend, admin | large |
| FEATURE-MDNS-BACKEND-DISCOVERY | mDNS Backend Discovery | backend, panel | medium |
| FEATURE-MODULE-CONFIG | Module Configuration Support | backend, admin | large |
| FEATURE-MULTI-LOCATION-WEATHER | Multi-Location Weather Support | backend, admin, panel | large |
| FEATURE-PLUGIN-HA-AUTO-MAP | Automatic Entity Mapping for HA | backend | large |
| FEATURE-PLUGIN-SHELLY-V1 | Shelly Gen 1 Plugin | backend | large |
| FEATURE-PLUGIN-SHELLY-V1-UI | Shelly Gen 1 Plugin UI | admin, panel | medium |
| FEATURE-PROPERTY-TIMESERIES | Property Timeseries Endpoint | backend | medium |
| FEATURE-PLUGIN-WLED | WLED Plugin (superseded) | backend | medium |

### Planned

| ID | Title | Scope | Size | Parent |
|----|-------|-------|------|--------|
| FEATURE-WINDOW-COVERING-DEVICE-PAGE | Window Covering Device Page | panel | medium | - |
| FEATURE-ADMIN-PLUGIN-SERVICES | Admin Plugin Services Management UI | admin | medium | - |
| FEATURE-APP-UPDATES | Application Updates Mechanism | backend, admin | large | FEATURE-LINUX-DEVICE-INSTALLATION |
| FEATURE-LINUX-INSTALL-ENHANCEMENTS | Linux Installation Enhancements | backend, admin | medium | FEATURE-LINUX-DEVICE-INSTALLATION |
| FEATURE-PANEL-SENSOR-DEVICE-PAGE | Sensor Device Detail Page | panel | large | - |
| FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS | Home Assistant Adoption Improvements | backend | large | FEATURE-PLUGIN-HA-AUTO-MAP |
| FEATURE-PLUGIN-MATTER | Matter Plugin | backend | large | - |
| FEATURE-PLUGIN-ZIGBEE2MQTT | Zigbee2MQTT Plugin | backend | large | - |
| FEATURE-UNIFIED-EXTENSION-LOGS | Unified Extension Logs | backend, admin | medium | - |

---

## Technical

### Completed

| ID | Title | Scope | Size |
|----|-------|-------|------|
| TECHNICAL-BACKEND-OPENAPI-SOURCE | Backend as Source of Truth for OpenAPI | backend | large |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | Display Token Revocation & Multi-Backend | backend, admin, panel | large |

### Planned

*No planned technical tasks.*

---

## Chores

### Completed

| ID | Title | Scope |
|----|-------|-------|
| extensions-core-control | Extensions Core Control Implementation | backend, admin |

### Planned

*No planned chores.*

---

## Bugs

*No bugs currently tracked.*

---

## By Scope

### Backend

| ID | Type | Status |
|----|------|--------|
| FEATURE-WLED-PLUGIN | feature | done |
| FEATURE-CONFIG-CONSOLIDATION | feature | done |
| FEATURE-LINUX-DEVICE-INSTALLATION | feature | done |
| FEATURE-MDNS-BACKEND-DISCOVERY | feature | done |
| FEATURE-MODULE-CONFIG | feature | done |
| FEATURE-MULTI-LOCATION-WEATHER | feature | done |
| FEATURE-PLUGIN-HA-AUTO-MAP | feature | done |
| FEATURE-PLUGIN-SHELLY-V1 | feature | done |
| FEATURE-PROPERTY-TIMESERIES | feature | done |
| TECHNICAL-BACKEND-OPENAPI-SOURCE | technical | done |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | technical | done |
| extensions-core-control | chore | done |
| FEATURE-APP-UPDATES | feature | planned |
| FEATURE-LINUX-INSTALL-ENHANCEMENTS | feature | planned |
| FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS | feature | planned |
| FEATURE-PLUGIN-MATTER | feature | planned |
| FEATURE-PLUGIN-ZIGBEE2MQTT | feature | planned |
| FEATURE-UNIFIED-EXTENSION-LOGS | feature | planned |

### Admin

| ID | Type | Status |
|----|------|--------|
| FEATURE-WLED-PLUGIN | feature | done |
| FEATURE-CONFIG-CONSOLIDATION | feature | done |
| FEATURE-LINUX-DEVICE-INSTALLATION | feature | done |
| FEATURE-MODULE-CONFIG | feature | done |
| FEATURE-MULTI-LOCATION-WEATHER | feature | done |
| FEATURE-PLUGIN-SHELLY-V1-UI | feature | done |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | technical | done |
| extensions-core-control | chore | done |
| FEATURE-ADMIN-PLUGIN-SERVICES | feature | planned |
| FEATURE-APP-UPDATES | feature | planned |
| FEATURE-LINUX-INSTALL-ENHANCEMENTS | feature | planned |
| FEATURE-UNIFIED-EXTENSION-LOGS | feature | planned |

### Panel

| ID | Type | Status |
|----|------|--------|
| FEATURE-WLED-PLUGIN | feature | done |
| FEATURE-CONFIG-CONSOLIDATION | feature | done |
| FEATURE-MDNS-BACKEND-DISCOVERY | feature | done |
| FEATURE-MULTI-LOCATION-WEATHER | feature | done |
| FEATURE-PLUGIN-SHELLY-V1-UI | feature | done |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | technical | done |
| FEATURE-WINDOW-COVERING-DEVICE-PAGE | feature | planned |
| FEATURE-PANEL-SENSOR-DEVICE-PAGE | feature | planned |

---

## Task Dependencies

```
FEATURE-LINUX-DEVICE-INSTALLATION (done)
├── FEATURE-APP-UPDATES (planned)
└── FEATURE-LINUX-INSTALL-ENHANCEMENTS (planned)

FEATURE-PLUGIN-HA-AUTO-MAP (done)
└── FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS (planned)

FEATURE-PLUGIN-SHELLY-V1 (done)
└── FEATURE-PLUGIN-SHELLY-V1-UI (done)
```

---

## Directory Structure

```
tasks/
├── PREVIEW.md              # This file
├── README.md               # Task format documentation
├── _template.md            # Template for new tasks
├── bugs/                   # Bug reports
├── chores/                 # Maintenance tasks
│   └── extensions-core-control.md
├── features/               # Feature implementations
│   ├── FEATURE-ADMIN-PLUGIN-SERVICES.md
│   ├── FEATURE-APP-UPDATES.md
│   ├── FEATURE-CONFIG-CONSOLIDATION.md
│   ├── FEATURE-LINUX-DEVICE-INSTALLATION.md
│   ├── FEATURE-LINUX-INSTALL-ENHANCEMENTS.md
│   ├── FEATURE-MDNS-BACKEND-DISCOVERY.md
│   ├── FEATURE-MODULE-CONFIG.md
│   ├── FEATURE-MULTI-LOCATION-WEATHER.md
│   ├── FEATURE-PANEL-SENSOR-DEVICE-PAGE.md
│   ├── FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS.md
│   ├── FEATURE-PLUGIN-HA-AUTO-MAP.md
│   ├── FEATURE-PLUGIN-MATTER.md
│   ├── FEATURE-PLUGIN-SHELLY-V1-UI.md
│   ├── FEATURE-PLUGIN-SHELLY-V1.md
│   ├── FEATURE-PLUGIN-WLED.md
│   ├── FEATURE-PLUGIN-ZIGBEE2MQTT.md
│   ├── FEATURE-PROPERTY-TIMESERIES.md
│   ├── FEATURE-UNIFIED-EXTENSION-LOGS.md
│   ├── FEATURE-WINDOW-COVERING-DEVICE-PAGE.md
│   └── FEATURE-WLED-PLUGIN.md
└── technical/              # Technical refactors
    ├── TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND.md
    └── TECHNICAL-OPENAPI-SPECIFICATION.md
```

---

*Last updated: 2024-12-20*
