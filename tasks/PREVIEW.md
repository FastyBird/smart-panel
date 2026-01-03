# Tasks Overview

This page provides an overview of all tasks in the Smart Panel project, organized by type and status.

## Summary

| Status | Count |
|--------|-------|
| Done | 62 |
| Planned | 6 |
| **Total** | **68** |

---

## Epics

### Completed

| ID | Title | Scope | Size |
|----|-------|-------|------|
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL | Display roles & House control | backend, admin, panel | large |
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2 | Display roles & House control v2 (refined specification) | backend, admin, panel | large |
| EPIC-SCENES-MVP | Scenes module MVP (room-scoped scenes) | backend, admin, panel | large |
| EPIC-SCENES-PLUGIN-MVP | Scenes module (plugin-based) MVP | backend, admin, panel | large |
| EPIC-SPACES-FIRST-UX | Spaces-first UX (Spaces module + Space pages + onboarding + MVP intents) | backend, admin, panel | large |

### Planned

*No planned epics.*

---

## Features

### Completed

| ID | Title | Scope | Size |
|----|-------|-------|------|
| FEATURE-ADMIN-PLUGIN-SERVICES | Admin Plugin Services Management UI | admin | medium |
| FEATURE-CONFIG-CONSOLIDATION | Configuration Module Consolidation | backend, admin, panel | large |
| FEATURE-DASHBOARD-SPACE-PAGE | Add Space page type to Dashboard (space-first home screen) | backend, admin, panel | large |
| FEATURE-DEVICE-VALIDATION-CONSTRAINTS | Device Validation Constraints | backend, admin, panel | medium |
| FEATURE-DISPLAY-ROLES-MVP | Introduce display roles (room / master / entry) | backend, admin, panel | medium |
| FEATURE-DISPLAY-ROLES-MVP-V2 | Display roles v2 (refined specification) | backend, admin, panel | medium |
| FEATURE-HOUSE-MODES-MVP | Add House Modes (Home / Away / Night) for entry panels | backend, admin, panel | medium |
| FEATURE-HOUSE-MODES-MVP-V2 | House Modes v2 (refined specification) | backend, admin, panel | medium |
| FEATURE-HOUSE-OVERVIEW-PAGE | Add House Overview page for master panels | backend, admin, panel | medium |
| FEATURE-HOUSE-OVERVIEW-PAGE-V2 | House Overview v2 (refined specification) | backend, admin, panel | medium |
| FEATURE-LINUX-DEVICE-INSTALLATION | Linux Device Installation | backend, admin | large |
| FEATURE-MDNS-BACKEND-DISCOVERY | mDNS Backend Discovery | backend, panel | medium |
| FEATURE-MODULE-CONFIG | Module Configuration Support | backend, admin | large |
| FEATURE-MULTI-LOCATION-WEATHER | Multi-Location Weather Support | backend, admin, panel | large |
| FEATURE-PANEL-IDLE-MODE-SPACE-AWARE | Space-aware idle mode for panel | panel | medium |
| FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS | Home Assistant Adoption Improvements | backend | large |
| FEATURE-PLUGIN-HA-AUTO-MAP | Automatic Entity Mapping for HA | backend | large |
| FEATURE-PLUGIN-SHELLY-V1 | Shelly Gen 1 Plugin | backend | large |
| FEATURE-PLUGIN-SHELLY-V1-UI | Shelly Gen 1 Plugin UI | admin, panel | medium |
| FEATURE-PLUGIN-WLED | WLED Plugin (superseded) | backend | medium |
| FEATURE-PLUGIN-ZIGBEE2MQTT | Zigbee2MQTT Plugin | backend, admin | large |
| FEATURE-Z2M-CONVERTER-ARCHITECTURE | Zigbee2MQTT Modular Converter Architecture | backend | large |
| FEATURE-PROPERTY-TIMESERIES | Property Timeseries Endpoint | backend | medium |
| FEATURE-SCENES-ADMIN-ROOM | Admin UI — Room scenes list + create/edit/apply | admin | medium |
| FEATURE-SCENES-ADMIN-UI | Scenes Admin UI (CRUD + action editor) | admin | medium |
| FEATURE-SCENES-BACKEND-CORE | Scenes backend module (core CRUD + apply) | backend | medium |
| FEATURE-SCENES-CORE-REGISTRY | Core Scenes module skeleton + type registry | backend | medium |
| FEATURE-SCENES-PANEL-QUICK-ACTIONS | Panel – show room scenes as quick actions | panel | medium |
| FEATURE-SCENES-PANEL-ROOM-ACTIONS | Panel UI — Room quick actions for Scenes | panel | medium |
| FEATURE-SCENES-PLUGIN-SIMPLE | Simple Scene type plugin (apply via Devices) | backend | medium |
| FEATURE-SPACE-CLIMATE-MVP | MVP Climate controls for Space pages | backend, panel | medium |
| FEATURE-SPACE-INTENTS-LIGHTING-MVP | MVP intent-based lighting for Space pages | backend, panel | medium |
| FEATURE-SPACE-INTENTS-LIGHTING-ROLES | Intent-based lighting with roles | backend, panel | medium |
| FEATURE-SPACE-LIGHTING-ROLES | Lighting roles for Space intents | backend | medium |
| FEATURE-SPACE-SUGGESTIONS-MVP | Space suggestions based on device names | backend, admin | small |
| FEATURE-SPACE-TEMPLATES | Space templates for quick setup | backend, admin | small |
| FEATURE-SPACE-UNDO-HISTORY | Lightweight undo for Space intents | backend, panel | medium |
| FEATURE-SPACEPAGE-EMPTY-STATES | Empty states for SpacePage sections | panel | small |
| FEATURE-SPACEPAGE-QUICK-ACTIONS | SpacePage quick actions (pinned intents) | backend, admin, panel | small |
| FEATURE-SPACEPAGE-STATUS-BADGES | Status badges for SpacePage header | panel | small |
| FEATURE-SPACES-MODULE | Introduce Spaces module (rooms/zones) as first-class domain | backend, admin | medium |
| FEATURE-UNIFIED-EXTENSION-LOGS | Unified Extension Logs | backend, admin | medium |
| FEATURE-WLED-PLUGIN | WLED Device Plugin | backend, admin, panel | large |

### Planned

| ID | Title | Scope | Size | Parent |
|----|-------|-------|------|--------|
| FEATURE-APP-UPDATES | Application Updates Mechanism | backend, admin | large | FEATURE-LINUX-DEVICE-INSTALLATION |
| FEATURE-LINUX-INSTALL-ENHANCEMENTS | Linux Installation Enhancements | backend, admin | medium | FEATURE-LINUX-DEVICE-INSTALLATION |
| FEATURE-PANEL-SENSOR-DEVICE-PAGE | Sensor Device Detail Page | panel | large | - |
| FEATURE-PLUGIN-MATTER | Matter Plugin | backend | large | - |
| FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS | Zigbee2MQTT Adoption Improvements | backend, admin | large | FEATURE-PLUGIN-ZIGBEE2MQTT |
| FEATURE-WINDOW-COVERING-DEVICE-PAGE | Window Covering Device Page | panel | medium | - |

---

## Technical

### Completed

| ID | Title | Scope | Size |
|----|-------|-------|------|
| TECH-ADMIN-SPACE-OVERVIEW | Admin Space overview enhancements | admin | small |
| TECH-DISPLAY-HOME-RESOLUTION | Display home page resolution logic | backend, panel | small |
| TECH-HOUSE-CONTROL-SMOKE-TESTS | Smoke tests for home resolution and house modes | backend, panel | small |
| TECH-INTENT-CATALOG | Central intent catalog | backend | small |
| TECH-SPACE-CONTEXT-SNAPSHOT | Capture Space context snapshots | backend | medium |
| TECH-SPACE-LAST-ACTIVITY-TRACKING | Track last activity per Space | backend | small |
| TECH-SPACES-ONBOARDING-WIZARD | Spaces onboarding and assignment wizard | admin, backend | medium |
| TECHNICAL-OPENAPI-SPECIFICATION | Backend as Source of Truth for OpenAPI | backend | large |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | Display Token Revocation & Multi-Backend | backend, admin, panel | large |
| TECHNICAL-SCENES-ACTION-VALIDATION | Scene action validation & typing | backend | small |
| TECH-EPIC-HOUSE-CONTROL-ALIGNMENT | Align implementation to v2 specification | backend, admin, panel | small |
| TECH-SCENES-OPENAPI-SYNC | Scenes — OpenAPI models + client sync tests | backend, admin, panel | small |

### Planned

*No planned technical tasks.*

---

## Chores

### Completed

| ID | Title | Scope |
|----|-------|-------|
| CHORE-CODEBASE-TODO-CLEANUP | Codebase TODO Cleanup | backend, admin, panel |
| CHORE-EXTENSIONS-CORE-CONTROL | Extensions Core Control Implementation | backend, admin |
| CHORE-SCENES-APPLY-FEEDBACK | Apply scene feedback & idempotency | backend, panel |

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
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL | epic | done |
| EPIC-SCENES-MVP | epic | done |
| EPIC-SCENES-PLUGIN-MVP | epic | done |
| EPIC-SPACES-FIRST-UX | epic | done |
| FEATURE-CONFIG-CONSOLIDATION | feature | done |
| FEATURE-DASHBOARD-SPACE-PAGE | feature | done |
| FEATURE-DEVICE-VALIDATION-CONSTRAINTS | feature | done |
| FEATURE-DISPLAY-ROLES-MVP | feature | done |
| FEATURE-HOUSE-MODES-MVP | feature | done |
| FEATURE-HOUSE-OVERVIEW-PAGE | feature | done |
| FEATURE-LINUX-DEVICE-INSTALLATION | feature | done |
| FEATURE-MDNS-BACKEND-DISCOVERY | feature | done |
| FEATURE-MODULE-CONFIG | feature | done |
| FEATURE-MULTI-LOCATION-WEATHER | feature | done |
| FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS | feature | done |
| FEATURE-PLUGIN-HA-AUTO-MAP | feature | done |
| FEATURE-PLUGIN-SHELLY-V1 | feature | done |
| FEATURE-PLUGIN-ZIGBEE2MQTT | feature | done |
| FEATURE-Z2M-CONVERTER-ARCHITECTURE | feature | done |
| FEATURE-PROPERTY-TIMESERIES | feature | done |
| FEATURE-SCENES-BACKEND-CORE | feature | done |
| FEATURE-SCENES-CORE-REGISTRY | feature | done |
| FEATURE-SCENES-PLUGIN-SIMPLE | feature | done |
| FEATURE-SPACE-CLIMATE-MVP | feature | done |
| FEATURE-SPACE-INTENTS-LIGHTING-MVP | feature | done |
| FEATURE-SPACE-INTENTS-LIGHTING-ROLES | feature | done |
| FEATURE-SPACE-LIGHTING-ROLES | feature | done |
| FEATURE-SPACE-SUGGESTIONS-MVP | feature | done |
| FEATURE-SPACE-TEMPLATES | feature | done |
| FEATURE-SPACE-UNDO-HISTORY | feature | done |
| FEATURE-SPACEPAGE-QUICK-ACTIONS | feature | done |
| FEATURE-SPACES-MODULE | feature | done |
| FEATURE-UNIFIED-EXTENSION-LOGS | feature | done |
| FEATURE-WLED-PLUGIN | feature | done |
| TECH-DISPLAY-HOME-RESOLUTION | technical | done |
| TECH-INTENT-CATALOG | technical | done |
| TECH-SPACE-CONTEXT-SNAPSHOT | technical | done |
| TECH-SPACE-LAST-ACTIVITY-TRACKING | technical | done |
| TECH-SPACES-ONBOARDING-WIZARD | technical | done |
| TECHNICAL-OPENAPI-SPECIFICATION | technical | done |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | technical | done |
| CHORE-CODEBASE-TODO-CLEANUP | chore | done |
| CHORE-EXTENSIONS-CORE-CONTROL | chore | done |
| CHORE-SCENES-APPLY-FEEDBACK | chore | done |
| TECH-HOUSE-CONTROL-SMOKE-TESTS | technical | done |
| TECH-SCENES-OPENAPI-SYNC | technical | done |
| TECH-EPIC-HOUSE-CONTROL-ALIGNMENT | technical | done |
| TECHNICAL-SCENES-ACTION-VALIDATION | technical | done |
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2 | epic | done |
| FEATURE-DISPLAY-ROLES-MVP-V2 | feature | done |
| FEATURE-HOUSE-MODES-MVP-V2 | feature | done |
| FEATURE-HOUSE-OVERVIEW-PAGE-V2 | feature | done |
| FEATURE-APP-UPDATES | feature | planned |
| FEATURE-LINUX-INSTALL-ENHANCEMENTS | feature | planned |
| FEATURE-PLUGIN-MATTER | feature | planned |
| FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS | feature | planned |

### Admin

| ID | Type | Status |
|----|------|--------|
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL | epic | done |
| EPIC-SCENES-MVP | epic | done |
| EPIC-SCENES-PLUGIN-MVP | epic | done |
| EPIC-SPACES-FIRST-UX | epic | done |
| FEATURE-ADMIN-PLUGIN-SERVICES | feature | done |
| FEATURE-SCENES-ADMIN-ROOM | feature | done |
| FEATURE-SCENES-ADMIN-UI | feature | done |
| FEATURE-CONFIG-CONSOLIDATION | feature | done |
| FEATURE-DASHBOARD-SPACE-PAGE | feature | done |
| FEATURE-DEVICE-VALIDATION-CONSTRAINTS | feature | done |
| FEATURE-DISPLAY-ROLES-MVP | feature | done |
| FEATURE-HOUSE-MODES-MVP | feature | done |
| FEATURE-HOUSE-OVERVIEW-PAGE | feature | done |
| FEATURE-LINUX-DEVICE-INSTALLATION | feature | done |
| FEATURE-MODULE-CONFIG | feature | done |
| FEATURE-MULTI-LOCATION-WEATHER | feature | done |
| FEATURE-PLUGIN-SHELLY-V1-UI | feature | done |
| FEATURE-PLUGIN-ZIGBEE2MQTT | feature | done |
| FEATURE-SPACE-SUGGESTIONS-MVP | feature | done |
| FEATURE-SPACE-TEMPLATES | feature | done |
| FEATURE-SPACEPAGE-QUICK-ACTIONS | feature | done |
| FEATURE-SPACES-MODULE | feature | done |
| FEATURE-UNIFIED-EXTENSION-LOGS | feature | done |
| FEATURE-WLED-PLUGIN | feature | done |
| TECH-ADMIN-SPACE-OVERVIEW | technical | done |
| TECH-SPACES-ONBOARDING-WIZARD | technical | done |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | technical | done |
| CHORE-CODEBASE-TODO-CLEANUP | chore | done |
| CHORE-EXTENSIONS-CORE-CONTROL | chore | done |
| TECH-EPIC-HOUSE-CONTROL-ALIGNMENT | technical | done |
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2 | epic | done |
| FEATURE-DISPLAY-ROLES-MVP-V2 | feature | done |
| FEATURE-HOUSE-MODES-MVP-V2 | feature | done |
| FEATURE-HOUSE-OVERVIEW-PAGE-V2 | feature | done |
| TECH-SCENES-OPENAPI-SYNC | technical | done |
| FEATURE-APP-UPDATES | feature | planned |
| FEATURE-LINUX-INSTALL-ENHANCEMENTS | feature | planned |
| FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS | feature | planned |

### Panel

| ID | Type | Status |
|----|------|--------|
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL | epic | done |
| EPIC-SCENES-MVP | epic | done |
| EPIC-SCENES-PLUGIN-MVP | epic | done |
| EPIC-SPACES-FIRST-UX | epic | done |
| FEATURE-CONFIG-CONSOLIDATION | feature | done |
| FEATURE-DASHBOARD-SPACE-PAGE | feature | done |
| FEATURE-DEVICE-VALIDATION-CONSTRAINTS | feature | done |
| FEATURE-DISPLAY-ROLES-MVP | feature | done |
| FEATURE-HOUSE-MODES-MVP | feature | done |
| FEATURE-HOUSE-OVERVIEW-PAGE | feature | done |
| FEATURE-MDNS-BACKEND-DISCOVERY | feature | done |
| FEATURE-MULTI-LOCATION-WEATHER | feature | done |
| FEATURE-PANEL-IDLE-MODE-SPACE-AWARE | feature | done |
| FEATURE-PLUGIN-SHELLY-V1-UI | feature | done |
| FEATURE-SCENES-PANEL-QUICK-ACTIONS | feature | done |
| FEATURE-SCENES-PANEL-ROOM-ACTIONS | feature | done |
| FEATURE-SPACE-CLIMATE-MVP | feature | done |
| FEATURE-SPACE-INTENTS-LIGHTING-MVP | feature | done |
| FEATURE-SPACE-INTENTS-LIGHTING-ROLES | feature | done |
| FEATURE-SPACE-UNDO-HISTORY | feature | done |
| FEATURE-SPACEPAGE-EMPTY-STATES | feature | done |
| FEATURE-SPACEPAGE-QUICK-ACTIONS | feature | done |
| FEATURE-SPACEPAGE-STATUS-BADGES | feature | done |
| FEATURE-WLED-PLUGIN | feature | done |
| TECH-DISPLAY-HOME-RESOLUTION | technical | done |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | technical | done |
| TECH-HOUSE-CONTROL-SMOKE-TESTS | technical | done |
| TECH-SCENES-OPENAPI-SYNC | technical | done |
| CHORE-CODEBASE-TODO-CLEANUP | chore | done |
| CHORE-SCENES-APPLY-FEEDBACK | chore | done |
| TECH-EPIC-HOUSE-CONTROL-ALIGNMENT | technical | done |
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2 | epic | done |
| FEATURE-DISPLAY-ROLES-MVP-V2 | feature | done |
| FEATURE-HOUSE-MODES-MVP-V2 | feature | done |
| FEATURE-HOUSE-OVERVIEW-PAGE-V2 | feature | done |
| FEATURE-PANEL-SENSOR-DEVICE-PAGE | feature | planned |
| FEATURE-WINDOW-COVERING-DEVICE-PAGE | feature | planned |

---

## Task Dependencies

```
EPIC-DISPLAY-ROLES-HOUSE-CONTROL (done)
├── FEATURE-DISPLAY-ROLES-MVP (done)
├── FEATURE-HOUSE-MODES-MVP (done)
├── FEATURE-HOUSE-OVERVIEW-PAGE (done)
└── TECH-DISPLAY-HOME-RESOLUTION (done)

EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2 (done)
├── FEATURE-DISPLAY-ROLES-MVP-V2 (done)
├── FEATURE-HOUSE-MODES-MVP-V2 (done)
├── FEATURE-HOUSE-OVERVIEW-PAGE-V2 (done)
├── TECH-HOUSE-CONTROL-SMOKE-TESTS (done)
└── TECH-EPIC-HOUSE-CONTROL-ALIGNMENT (done)

EPIC-SPACES-FIRST-UX (done)
├── FEATURE-SPACES-MODULE (done)
├── TECH-SPACES-ONBOARDING-WIZARD (done)
├── FEATURE-DASHBOARD-SPACE-PAGE (done)
├── FEATURE-SPACE-INTENTS-LIGHTING-MVP (done)
├── FEATURE-SPACE-LIGHTING-ROLES (done)
├── FEATURE-SPACE-INTENTS-LIGHTING-ROLES (done)
├── FEATURE-SPACE-CLIMATE-MVP (done)
├── FEATURE-SPACE-UNDO-HISTORY (done)
├── FEATURE-SPACEPAGE-QUICK-ACTIONS (done)
├── FEATURE-SPACEPAGE-STATUS-BADGES (done)
├── FEATURE-SPACEPAGE-EMPTY-STATES (done)
├── FEATURE-SPACE-TEMPLATES (done)
├── FEATURE-SPACE-SUGGESTIONS-MVP (done)
├── FEATURE-PANEL-IDLE-MODE-SPACE-AWARE (done)
├── TECH-SPACE-LAST-ACTIVITY-TRACKING (done)
├── TECH-SPACE-CONTEXT-SNAPSHOT (done)
├── TECH-INTENT-CATALOG (done)
└── TECH-ADMIN-SPACE-OVERVIEW (done)

FEATURE-LINUX-DEVICE-INSTALLATION (done)
├── FEATURE-APP-UPDATES (planned)
└── FEATURE-LINUX-INSTALL-ENHANCEMENTS (planned)

FEATURE-PLUGIN-HA-AUTO-MAP (done)
└── FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS (done)

FEATURE-PLUGIN-SHELLY-V1 (done)
└── FEATURE-PLUGIN-SHELLY-V1-UI (done)

FEATURE-PLUGIN-ZIGBEE2MQTT (done)
├── FEATURE-Z2M-CONVERTER-ARCHITECTURE (done)
└── FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS (planned)

EPIC-SCENES-MVP (done)
├── FEATURE-SCENES-BACKEND-CORE (done)
├── FEATURE-SCENES-ADMIN-UI (done)
├── FEATURE-SCENES-PANEL-QUICK-ACTIONS (done)
├── TECHNICAL-SCENES-ACTION-VALIDATION (done)
├── TECH-SCENES-OPENAPI-SYNC (done)
└── CHORE-SCENES-APPLY-FEEDBACK (done)

EPIC-SCENES-PLUGIN-MVP (done)
├── FEATURE-SCENES-CORE-REGISTRY (done)
├── FEATURE-SCENES-PLUGIN-SIMPLE (done)
├── FEATURE-SCENES-ADMIN-ROOM (done)
└── FEATURE-SCENES-PANEL-ROOM-ACTIONS (done)
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
│   ├── CHORE-CODEBASE-TODO-CLEANUP.md
│   └── CHORE-EXTENSIONS-CORE-CONTROL.md
├── features/               # Feature implementations
│   ├── CHORE-SCENES-APPLY-FEEDBACK.md
│   ├── EPIC-DISPLAY-ROLES-HOUSE-CONTROL.md
│   ├── EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2.md
│   ├── EPIC-SCENES-MVP.md
│   ├── EPIC-SCENES-PLUGIN-MVP.md
│   ├── EPIC-SPACES-FIRST-UX.md
│   ├── FEATURE-ADMIN-PLUGIN-SERVICES.md
│   ├── FEATURE-APP-UPDATES.md
│   ├── FEATURE-CONFIG-CONSOLIDATION.md
│   ├── FEATURE-DASHBOARD-SPACE-PAGE.md
│   ├── FEATURE-DEVICE-VALIDATION-CONSTRAINTS.md
│   ├── FEATURE-DISPLAY-ROLES-MVP.md
│   ├── FEATURE-DISPLAY-ROLES-MVP-V2.md
│   ├── FEATURE-HOUSE-MODES-MVP.md
│   ├── FEATURE-HOUSE-MODES-MVP-V2.md
│   ├── FEATURE-HOUSE-OVERVIEW-PAGE.md
│   ├── FEATURE-HOUSE-OVERVIEW-PAGE-V2.md
│   ├── FEATURE-LINUX-DEVICE-INSTALLATION.md
│   ├── FEATURE-LINUX-INSTALL-ENHANCEMENTS.md
│   ├── FEATURE-MDNS-BACKEND-DISCOVERY.md
│   ├── FEATURE-MODULE-CONFIG.md
│   ├── FEATURE-MULTI-LOCATION-WEATHER.md
│   ├── FEATURE-PANEL-IDLE-MODE-SPACE-AWARE.md
│   ├── FEATURE-PANEL-SENSOR-DEVICE-PAGE.md
│   ├── FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS.md
│   ├── FEATURE-PLUGIN-HA-AUTO-MAP.md
│   ├── FEATURE-PLUGIN-MATTER.md
│   ├── FEATURE-PLUGIN-SHELLY-V1-UI.md
│   ├── FEATURE-PLUGIN-SHELLY-V1.md
│   ├── FEATURE-PLUGIN-WLED.md
│   ├── FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS.md
│   ├── FEATURE-PLUGIN-ZIGBEE2MQTT.md
│   ├── FEATURE-Z2M-CONVERTER-ARCHITECTURE.md
│   ├── FEATURE-PROPERTY-TIMESERIES.md
│   ├── FEATURE-SCENES-ADMIN-ROOM.md
│   ├── FEATURE-SCENES-ADMIN-UI.md
│   ├── FEATURE-SCENES-BACKEND-CORE.md
│   ├── FEATURE-SCENES-CORE-REGISTRY.md
│   ├── FEATURE-SCENES-PANEL-QUICK-ACTIONS.md
│   ├── FEATURE-SCENES-PANEL-ROOM-ACTIONS.md
│   ├── FEATURE-SCENES-PLUGIN-SIMPLE.md
│   ├── FEATURE-SPACE-CLIMATE-MVP.md
│   ├── FEATURE-SPACE-INTENTS-LIGHTING-MVP.md
│   ├── FEATURE-SPACE-INTENTS-LIGHTING-ROLES.md
│   ├── FEATURE-SPACE-LIGHTING-ROLES.md
│   ├── FEATURE-SPACE-SUGGESTIONS-MVP.md
│   ├── FEATURE-SPACE-TEMPLATES.md
│   ├── FEATURE-SPACE-UNDO-HISTORY.md
│   ├── FEATURE-SPACEPAGE-EMPTY-STATES.md
│   ├── FEATURE-SPACEPAGE-QUICK-ACTIONS.md
│   ├── FEATURE-SPACEPAGE-STATUS-BADGES.md
│   ├── FEATURE-SPACES-MODULE.md
│   ├── FEATURE-UNIFIED-EXTENSION-LOGS.md
│   ├── FEATURE-WINDOW-COVERING-DEVICE-PAGE.md
│   ├── FEATURE-WLED-PLUGIN.md
│   ├── PLAN-SPACES-FIRST-UX.md
│   ├── TECH-ADMIN-SPACE-OVERVIEW.md
│   ├── TECH-DISPLAY-HOME-RESOLUTION.md
│   ├── TECH-EPIC-HOUSE-CONTROL-ALIGNMENT.md
│   ├── TECH-HOUSE-CONTROL-SMOKE-TESTS.md
│   ├── TECH-INTENT-CATALOG.md
│   ├── TECH-SCENES-OPENAPI-SYNC.md
│   ├── TECH-SPACE-CONTEXT-SNAPSHOT.md
│   ├── TECH-SPACE-LAST-ACTIVITY-TRACKING.md
│   └── TECH-SPACES-ONBOARDING-WIZARD.md
└── technical/              # Technical refactors
    ├── TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND.md
    ├── TECHNICAL-OPENAPI-SPECIFICATION.md
    └── TECHNICAL-SCENES-ACTION-VALIDATION.md
```

---

*Last updated: 2026-01-03*
