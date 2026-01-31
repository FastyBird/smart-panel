# Tasks Overview

This page provides an overview of all tasks in the Smart Panel project, organized by type and status.

## Summary

| Status | Count |
|--------|-------|
| Done | 96 |
| In Progress | 8 |
| Planned | 27 |
| **Total** | **131** |

---

## Epics

### Completed

| ID | Title | Scope | Size |
|----|-------|-------|------|
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL | Display roles & House control | backend, admin, panel | large |
| EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2 | Display roles & House control v2 (refined specification) | backend, admin, panel | large |
| EPIC-INTENTS-ORCHESTRATION | Backend Intent Orchestration + Panel Anti-Jitter | backend, panel | large |
| EPIC-PANEL-SPACES-DECK-INTENTS | Panel App Spaces + Deck + Intents architecture | panel | large |
| EPIC-SCENES-MVP | Scenes module MVP (room-scoped scenes) | backend, admin, panel | large |
| EPIC-SCENES-PLUGIN-MVP | Scenes module (plugin-based) MVP | backend, admin, panel | large |
| EPIC-SPACES-FIRST-UX | Spaces-first UX (Spaces module + Space pages + onboarding + MVP intents) | backend, admin, panel | large |

### Planned

| ID | Title | Scope | Size |
|----|-------|-------|------|
| EPIC-APP-ONBOARDING | App Onboarding Wizard | backend, admin | large |
| EPIC-EXPAND-SMART-PANEL-DOMAINS | Expand Smart Panel Domains and Unified Room Modes | backend, admin, panel | large |

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
| FEATURE-MEDIA-DOMAIN-BACKEND-MVP-1 | Media Domain – Backend MVP #1 (Endpoints Read Model + API) | backend | medium |
| FEATURE-MEDIA-DOMAIN-BACKEND-REFACTOR | Media Domain – Backend Refactor & Runtime Specification | backend | large |
| FEATURE-MEDIA-DOMAIN-CONVERGENCE | Media Domain – Convergence Phase | backend | medium |
| FEATURE-MEDIA-DOMAIN-ROUTING-FALLBACK | Media Domain – Default Routings/Bindings Quality + Fallback Heuristics | backend | medium |
| FEATURE-MEDIA-FINALIZATION | Media Domain – Finalization (Docs, Onboarding, Guardrails) | backend, admin, panel | medium |
| FEATURE-MODULE-CONFIG | Module Configuration Support | backend, admin | large |
| FEATURE-MULTI-LOCATION-WEATHER | Multi-Location Weather Support | backend, admin, panel | large |
| FEATURE-PANEL-DASHBOARD-PAGES-AS-DECKITEM | Dashboard page rendering via DeckItem abstraction | panel | medium |
| FEATURE-PANEL-DECK-BUILDER | Deck Builder (system view + dashboard pages) | panel | large |
| FEATURE-PANEL-DECK-DOMAIN-MODELS | Domain models for Spaces, Displays, Pages, Deck items | panel | medium |
| FEATURE-PANEL-DECK-NAVIGATION-UI | Deck navigation UI with new deck model | panel | large |
| FEATURE-PANEL-DISPLAY-CONFIG-VALIDATION | Display Role and Home Mode config validation | panel | medium |
| FEATURE-PANEL-HYDRATION-PIPELINE | App Hydration pipeline | panel | large |
| FEATURE-PANEL-IDLE-MODE-SPACE-AWARE | Space-aware idle mode for panel | panel | medium |
| FEATURE-PANEL-INTENTS-CORE | Intents layer (navigation + device control + scene trigger) | panel | large |
| FEATURE-PANEL-REALTIME-SYSTEMVIEWS | Real-time updates for system views via WebSocket | panel | medium |
| FEATURE-PANEL-SCENES-INTEGRATION | Scenes invocation from system views | panel | medium |
| FEATURE-PANEL-SYSTEMVIEW-ENTRY | System View – Entry Overview | panel | large |
| FEATURE-PANEL-SYSTEMVIEW-MASTER | System View – Master Overview | panel | large |
| FEATURE-PANEL-SYSTEMVIEW-ROOM | System View – Room Overview | panel | large |
| FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS | Home Assistant Adoption Improvements | backend | large |
| FEATURE-PLUGIN-HA-AUTO-MAP | Automatic Entity Mapping for HA | backend | large |
| FEATURE-PLUGIN-SHELLY-V1 | Shelly Gen 1 Plugin | backend | large |
| FEATURE-PLUGIN-SHELLY-V1-UI | Shelly Gen 1 Plugin UI | admin, panel | medium |
| FEATURE-PLUGIN-WLED | WLED Plugin (superseded) | backend | medium |
| FEATURE-PLUGIN-ZIGBEE2MQTT | Zigbee2MQTT Plugin | backend, admin | large |
| FEATURE-PROPERTY-TIMESERIES | Property Timeseries Endpoint | backend | medium |
| FEATURE-SCENES-ADMIN-ROOM | Admin UI — Room scenes list + create/edit/apply | admin | medium |
| FEATURE-SCENES-ADMIN-UI | Scenes Admin UI (CRUD + action editor) | admin | medium |
| FEATURE-SCENES-BACKEND-CORE | Scenes backend module (core CRUD + apply) | backend | medium |
| FEATURE-SCENES-CORE-REGISTRY | Core Scenes module skeleton + type registry | backend | medium |
| FEATURE-SCENES-PANEL-QUICK-ACTIONS | Panel – show room scenes as quick actions | panel | medium |
| FEATURE-SCENES-PANEL-ROOM-ACTIONS | Panel UI — Room quick actions for Scenes | panel | medium |
| FEATURE-SCENES-PLUGIN-SIMPLE | Simple Scene type plugin (apply via Devices) | backend | medium |
| FEATURE-SECURITY-ACTIVE-ALERTS | Security Domain – Expose activeAlerts[] in DTO + endpoint | backend | medium |
| FEATURE-SECURITY-EVENT-TIMELINE | Security Domain – Event timeline (short history buffer) + API | backend | medium |
| FEATURE-SECURITY-ALARM-PROVIDER | Security Domain – Alarm Provider | backend | medium |
| FEATURE-SECURITY-DOMAIN-BACKEND | Security Domain – Backend Core | backend | small |
| FEATURE-SPACE-CLIMATE-MVP | MVP Climate controls for Space pages | backend, panel, admin | medium |
| FEATURE-SPACE-INTENTS-LIGHTING-MVP | MVP intent-based lighting for Space pages | backend, panel | medium |
| FEATURE-SPACE-INTENTS-LIGHTING-ROLES | Intent-based lighting with roles | backend, panel | medium |
| FEATURE-SPACE-LIGHTING-ROLES | Lighting roles for Space intents | backend, admin | medium |
| FEATURE-SPACE-MEDIA-DOMAIN | Add media domain intents for spaces | backend, admin, panel | medium |
| FEATURE-SPACE-SUGGESTIONS-MVP | Space suggestions based on device names | backend, panel, admin | medium |
| FEATURE-SPACE-TEMPLATES | Space templates for quick setup | backend, admin | medium |
| FEATURE-SPACE-UNDO-HISTORY | Lightweight undo for Space intents | backend, panel | medium |
| FEATURE-SPACEPAGE-EMPTY-STATES | Empty states for SpacePage sections | panel, backend | tiny |
| FEATURE-SPACEPAGE-QUICK-ACTIONS | SpacePage quick actions (pinned intents) | backend, admin, panel | small |
| FEATURE-SPACEPAGE-STATUS-BADGES | Status badges for SpacePage header | panel | small |
| FEATURE-SPACES-MODULE | Introduce Spaces module (rooms/zones) as first-class domain | backend, admin | medium |
| FEATURE-UNIFIED-EXTENSION-LOGS | Unified Extension Logs | backend, admin | medium |
| FEATURE-WINDOW-COVERING-DEVICE-PAGE | Window Covering Device Page | panel | medium |
| FEATURE-WLED-PLUGIN | WLED Device Plugin | backend, admin, panel | large |
| FEATURE-Z2M-CONVERTER-ARCHITECTURE | Zigbee2MQTT Modular Converter Architecture | backend | large |
| FEATURE-PANEL-DOMAIN-LIGHTS-PAGE | Lights domain page MVP | panel | medium |
| FEATURE-PANEL-ROOM-SYSTEM-PAGES | Panel system pages for Room role | panel | large |
| FEATURE-PANEL-SECURITY-OVERLAY | Panel app – Security overlay & intent rules (forced alerts UX) | panel | medium |
| FEATURE-PANEL-SECURITY-ENTRY-POINTS | Panel app – Entry points snapshot (doors/windows overview) | panel | medium |
| FEATURE-PANEL-SECURITY-SCREEN | Panel app – Security screen UI (status + active alerts list) | panel | medium |
| FEATURE-PANEL-SECURITY-ALERTS-GROUPING | Panel app – Alerts grouping + local acknowledge UX (session-only) | panel | medium |

### In Progress

| ID | Title | Scope | Size | Parent |
|----|-------|-------|------|--------|
| FEATURE-MEDIA-ACTIVITY-ACTIVATION | Media Activity Activation | backend | large | FEATURE-SPACE-MEDIA-DOMAIN-V2 |
| FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD | Media Activity Bindings CRUD | backend | medium | FEATURE-SPACE-MEDIA-DOMAIN-V2 |
| FEATURE-MEDIA-ADMIN-UI-MVP-1 | Media Admin UI MVP #1 | admin | large | - |
| FEATURE-MEDIA-ADMIN-UI-MVP-2 | Media Admin UI MVP #2 | admin | large | FEATURE-MEDIA-ADMIN-UI-MVP-1 |
| FEATURE-MEDIA-DOMAIN-PANEL-MVP | Panel App – Media Domain MVP (Portrait UI) | panel | large | FEATURE-SPACE-MEDIA-DOMAIN-V2 |
| FEATURE-MEDIA-DRY-RUN-PREVIEW | Media Dry-Run Preview | backend, admin, panel | medium | - |
| FEATURE-MEDIA-SIMULATOR-REGRESSION | Media Simulator Regression Suite | backend | large | FEATURE-SPACE-MEDIA-DOMAIN-V2 |
| FEATURE-MEDIA-UX-POLISH | Media UX Polish | backend, admin, panel | large | FEATURE-SPACE-MEDIA-DOMAIN-V2 |
| FEATURE-PANEL-MEDIA-DOMAIN-MVP | Panel Media Domain MVP | panel | large | FEATURE-SPACE-MEDIA-DOMAIN-V2 |
| FEATURE-SPACE-COVERS-DOMAIN | Add covers domain intents for spaces | backend, admin, panel | medium | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACE-MEDIA-DOMAIN-V2 | Media domain intents for spaces v2 | backend, admin, panel | large | EPIC-EXPAND-SMART-PANEL-DOMAINS |

### Planned

| ID | Title | Scope | Size | Parent |
|----|-------|-------|------|--------|
| FEATURE-APP-UPDATES | Application Updates Mechanism | backend, admin | large | FEATURE-LINUX-DEVICE-INSTALLATION |
| FEATURE-EXTENSION-LOGS-FILTERS | Level and time range filters for extension logs | admin | small | FEATURE-UNIFIED-EXTENSION-LOGS |
| FEATURE-LINUX-INSTALL-ENHANCEMENTS | Linux Installation Enhancements | backend, admin | medium | FEATURE-LINUX-DEVICE-INSTALLATION |
| FEATURE-ONBOARDING-BACKEND | Onboarding status backend API | backend | small | EPIC-APP-ONBOARDING |
| FEATURE-ONBOARDING-INTEGRATIONS | Integrations discovery step | backend, admin | medium | EPIC-APP-ONBOARDING |
| FEATURE-ONBOARDING-WIZARD | Onboarding wizard UI | admin | medium | EPIC-APP-ONBOARDING |
| FEATURE-PANEL-SENSOR-DEVICE-PAGE | Sensor Device Detail Page | panel | large | - |
| FEATURE-PLUGIN-MATTER | Matter Plugin | backend | large | - |
| FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS | Zigbee2MQTT Adoption Improvements | backend, admin | large | FEATURE-PLUGIN-ZIGBEE2MQTT |
| FEATURE-SPACE-ACTIVITY-MODES | Add activity-based room modes | backend, admin, panel | large | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACE-MODE-ADMIN-UI | Admin UI for configuring space modes | admin | medium | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACE-MODE-PANEL-UI | Panel UI for activating space modes | panel | medium | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACE-OCCUPANCY-MODES | Occupancy-based mode triggers | backend, admin, panel | medium | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACE-SEASONAL-DEFAULTS | Seasonal baseline adjustments | backend, admin | small | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACE-SECURITY-DOMAIN | Add security domain intents for spaces | backend, admin, panel | medium | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACE-TIME-SCHEDULING | Time-based mode scheduling | backend, admin, panel | medium | EPIC-EXPAND-SMART-PANEL-DOMAINS |
| FEATURE-SPACEPAGE-CLIMATE-SECTION | Climate section for SpacePage | backend, panel | medium | FEATURE-DASHBOARD-SPACE-PAGE |
| FEATURE-WEATHER-PANEL-ENHANCEMENTS | Weather dashboard tile and location switching | panel | medium | FEATURE-MULTI-LOCATION-WEATHER |

---

## Technical

### Completed

| ID | Title | Scope | Size |
|----|-------|-------|------|
| FEATURE-SECURITY-PROVIDER-REGISTRY | Security domain – provider registry + aggregation contract | backend | small |
| TECH-ADMIN-SPACE-OVERVIEW | Admin Space overview enhancements | admin | small |
| TECH-DISPLAY-HOME-RESOLUTION | Display home page resolution logic | backend, panel, admin | small |
| TECH-EPIC-HOUSE-CONTROL-ALIGNMENT | Align implementation to v2 specification | backend, admin, panel | small |
| TECH-HOUSE-CONTROL-SMOKE-TESTS | Smoke tests for home resolution and house modes | backend | small |
| TECH-INTENT-CATALOG | Central intent catalog | backend | small |
| TECH-PANEL-REMOVE-LEGACY-NAV | Remove legacy "first page" navigation assumptions | panel | medium |
| TECH-SCENES-OPENAPI-SYNC | Scenes — OpenAPI models + client sync tests | backend, admin, panel | small |
| TECH-SPACE-CONTEXT-SNAPSHOT | Capture Space context snapshots | backend | medium |
| TECH-SPACE-LAST-ACTIVITY-TRACKING | Track last activity per Space | backend | small |
| TECH-SPACES-ONBOARDING-WIZARD | Spaces onboarding and assignment wizard | admin, backend | medium |
| TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND | Display Token Revocation & Multi-Backend | backend, admin, panel | large |
| TECHNICAL-OPENAPI-SPECIFICATION | Backend as Source of Truth for OpenAPI | backend | large |
| TECHNICAL-SCENES-ACTION-VALIDATION | Scene action validation & typing | backend | small |
| TEST-PANEL-DECK-STARTUP-MATRIX | Integration tests for deck startup matrix | panel | medium |

### Planned

| ID | Title | Scope | Size | Parent |
|----|-------|-------|------|--------|
| TECH-ADMIN-MODULE-CONFIG-TESTS | Admin unit tests for module configuration | admin | small | FEATURE-MODULE-CONFIG |
| TECH-EXTENSIONS-CAN-REMOVE-OPENAPI | Add canRemove field to OpenAPI spec | backend | tiny | CHORE-EXTENSIONS-CORE-CONTROL |
| TECH-ONBOARDING-ROUTER-GUARDS | Router guards for onboarding flow | admin | small | EPIC-APP-ONBOARDING |
| TECH-PROPERTY-TIMESERIES-E2E | E2E test for property timeseries endpoint | backend | tiny | FEATURE-PROPERTY-TIMESERIES |

---

## Chores

### Completed

| ID | Title | Scope |
|----|-------|-------|
| CHORE-CODEBASE-TODO-CLEANUP | Codebase TODO Cleanup | backend, admin, panel |
| CHORE-EXTENSIONS-CORE-CONTROL | Extensions Core Control Implementation | backend, admin |
| CHORE-PANEL-DOCS-SPACES-DECK-INTENTS | Panel App documentation for Spaces + Deck + System Views + Intents | panel |
| CHORE-SCENES-APPLY-FEEDBACK | Apply scene feedback & idempotency | backend, panel |
| PLAN-SPACES-FIRST-UX | Implementation Plan: Spaces-first UX Epic | backend, admin, panel |

### Planned

*No planned chores.*

---

## Bugs

*No bugs currently tracked.*

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

EPIC-INTENTS-ORCHESTRATION (done)

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
├── TECH-ADMIN-SPACE-OVERVIEW (done)
└── PLAN-SPACES-FIRST-UX (done)

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

EPIC-APP-ONBOARDING (planned)
├── FEATURE-ONBOARDING-BACKEND (planned)
├── TECH-ONBOARDING-ROUTER-GUARDS (planned)
├── FEATURE-ONBOARDING-WIZARD (planned)
└── FEATURE-ONBOARDING-INTEGRATIONS (planned)

EPIC-PANEL-SPACES-DECK-INTENTS (done)
├── FEATURE-PANEL-DECK-DOMAIN-MODELS (done)
├── FEATURE-PANEL-DECK-BUILDER (done)
├── FEATURE-PANEL-HYDRATION-PIPELINE (done)
├── TECH-PANEL-REMOVE-LEGACY-NAV (done)
├── FEATURE-PANEL-SYSTEMVIEW-ROOM (done)
├── FEATURE-PANEL-SYSTEMVIEW-MASTER (done)
├── FEATURE-PANEL-SYSTEMVIEW-ENTRY (done)
├── FEATURE-PANEL-INTENTS-CORE (done)
├── FEATURE-PANEL-DECK-NAVIGATION-UI (done)
├── FEATURE-PANEL-DISPLAY-CONFIG-VALIDATION (done)
├── FEATURE-PANEL-REALTIME-SYSTEMVIEWS (done)
├── FEATURE-PANEL-SCENES-INTEGRATION (done)
├── FEATURE-PANEL-DASHBOARD-PAGES-AS-DECKITEM (done)
├── TEST-PANEL-DECK-STARTUP-MATRIX (done)
└── CHORE-PANEL-DOCS-SPACES-DECK-INTENTS (done)

FEATURE-PANEL-ROOM-SYSTEM-PAGES (done)
├── FEATURE-PANEL-DOMAIN-LIGHTS-PAGE (done)
├── FEATURE-PANEL-DOMAIN-CLIMATE-PAGE (planned)
├── FEATURE-PANEL-DOMAIN-SENSORS-PAGE (planned)
└── FEATURE-PANEL-QUICK-SCENES-FEEDBACK (planned)

EPIC-EXPAND-SMART-PANEL-DOMAINS (planned)
├── Phase 1: Domain Completion
│   ├── FEATURE-SPACE-COVERS-DOMAIN (in-progress)
│   ├── FEATURE-SPACE-MEDIA-DOMAIN (done)
│   ├── FEATURE-SPACE-MEDIA-DOMAIN-V2 (in-progress)
│   │   ├── FEATURE-MEDIA-DOMAIN-BACKEND-MVP-1 (done)
│   │   ├── FEATURE-MEDIA-DOMAIN-BACKEND-REFACTOR (done)
│   │   ├── FEATURE-MEDIA-DOMAIN-CONVERGENCE (done)
│   │   ├── FEATURE-MEDIA-DOMAIN-ROUTING-FALLBACK (done)
│   │   ├── FEATURE-MEDIA-ACTIVITY-ACTIVATION (in-progress)
│   │   ├── FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD (in-progress)
│   │   ├── FEATURE-MEDIA-SIMULATOR-REGRESSION (in-progress)
│   │   ├── FEATURE-MEDIA-UX-POLISH (in-progress)
│   │   ├── FEATURE-MEDIA-DOMAIN-PANEL-MVP (in-progress)
│   │   └── FEATURE-PANEL-MEDIA-DOMAIN-MVP (in-progress)
│   ├── FEATURE-PANEL-SECURITY-OVERLAY (done)
│   ├── FEATURE-PANEL-SECURITY-SCREEN (done)
│   ├── FEATURE-PANEL-SECURITY-ENTRY-POINTS (done)
│   ├── FEATURE-PANEL-SECURITY-ALERTS-GROUPING (done)
│   ├── FEATURE-SPACE-SECURITY-DOMAIN (planned)
│   ├── FEATURE-SECURITY-DOMAIN-BACKEND (done)
│   ├── FEATURE-SECURITY-PROVIDER-REGISTRY (done)
│   ├── FEATURE-SECURITY-ALARM-PROVIDER (done)
│   ├── FEATURE-SECURITY-ACTIVE-ALERTS (done)
│   └── FEATURE-SECURITY-EVENT-TIMELINE (done)
├── Phase 2: Unified Room Modes
│   ├── FEATURE-SPACE-ACTIVITY-MODES (planned)
│   ├── FEATURE-SPACE-MODE-ADMIN-UI (planned)
│   └── FEATURE-SPACE-MODE-PANEL-UI (planned)
└── Phase 3: Automation Triggers
    ├── FEATURE-SPACE-TIME-SCHEDULING (planned)
    ├── FEATURE-SPACE-OCCUPANCY-MODES (planned)
    └── FEATURE-SPACE-SEASONAL-DEFAULTS (planned)

FEATURE-MEDIA-ADMIN-UI-MVP-1 (in-progress)
└── FEATURE-MEDIA-ADMIN-UI-MVP-2 (in-progress)

Standalone
├── FEATURE-MEDIA-FINALIZATION (done)
├── FEATURE-MEDIA-DRY-RUN-PREVIEW (in-progress)
├── FEATURE-MULTI-LOCATION-WEATHER (done)
│   └── FEATURE-WEATHER-PANEL-ENHANCEMENTS (planned)
├── FEATURE-UNIFIED-EXTENSION-LOGS (done)
│   └── FEATURE-EXTENSION-LOGS-FILTERS (planned)
├── FEATURE-DASHBOARD-SPACE-PAGE (done)
│   └── FEATURE-SPACEPAGE-CLIMATE-SECTION (planned)
├── FEATURE-MODULE-CONFIG (done)
│   └── TECH-ADMIN-MODULE-CONFIG-TESTS (planned)
├── FEATURE-PROPERTY-TIMESERIES (done)
│   └── TECH-PROPERTY-TIMESERIES-E2E (planned)
└── CHORE-EXTENSIONS-CORE-CONTROL (done)
    └── TECH-EXTENSIONS-CAN-REMOVE-OPENAPI (planned)
```

---

## Directory Structure

```
tasks/
├── PREVIEW.md              # This file
├── README.md               # Task format documentation
├── _template.md            # Template for new tasks
├── bugs/                   # Bug reports
├── features/               # Feature implementations
│   ├── CHORE-SCENES-APPLY-FEEDBACK.md
│   ├── EPIC-APP-ONBOARDING.md
│   ├── EPIC-DISPLAY-ROLES-HOUSE-CONTROL.md
│   ├── EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2.md
│   ├── EPIC-EXPAND-SMART-PANEL-DOMAINS.md
│   ├── EPIC-INTENTS-BACKEND-PANEL-TASKS.md
│   ├── EPIC-SCENES-MVP.md
│   ├── EPIC-SCENES-PLUGIN-MVP.md
│   ├── EPIC-SPACES-FIRST-UX.md
│   ├── EPIC_PANEL_APP_SPACES_DEK_INTENTS.md
│   ├── FEATURE-ADMIN-PLUGIN-SERVICES.md
│   ├── FEATURE-APP-UPDATES.md
│   ├── FEATURE-CONFIG-CONSOLIDATION.md
│   ├── FEATURE-DASHBOARD-SPACE-PAGE.md
│   ├── FEATURE-DEVICE-VALIDATION-CONSTRAINTS.md
│   ├── FEATURE-DISPLAY-ROLES-MVP.md
│   ├── FEATURE-DISPLAY-ROLES-MVP-V2.md
│   ├── FEATURE-EXTENSION-LOGS-FILTERS.md
│   ├── FEATURE-HOUSE-MODES-MVP.md
│   ├── FEATURE-HOUSE-MODES-MVP-V2.md
│   ├── FEATURE-HOUSE-OVERVIEW-PAGE.md
│   ├── FEATURE-HOUSE-OVERVIEW-PAGE-V2.md
│   ├── FEATURE-LINUX-DEVICE-INSTALLATION.md
│   ├── FEATURE-LINUX-INSTALL-ENHANCEMENTS.md
│   ├── FEATURE-MDNS-BACKEND-DISCOVERY.md
│   ├── FEATURE-MEDIA-ACTIVITY-ACTIVATION.md
│   ├── FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD.md
│   ├── FEATURE-MEDIA-ADMIN-UI-MVP-1.md
│   ├── FEATURE-MEDIA-ADMIN-UI-MVP-2.md
│   ├── FEATURE-MEDIA-DOMAIN-BACKEND-MVP-1.md
│   ├── FEATURE-MEDIA-DOMAIN-BACKEND-REFACTOR.md
│   ├── FEATURE-MEDIA-DOMAIN-CONVERGENCE.md
│   ├── FEATURE-MEDIA-DOMAIN-PANEL-MVP.md
│   ├── FEATURE-MEDIA-DOMAIN-ROUTING-FALLBACK.md
│   ├── FEATURE-MEDIA-DRY-RUN-PREVIEW.md
│   ├── FEATURE-MEDIA-FINALIZATION.md
│   ├── FEATURE-MEDIA-SIMULATOR-REGRESSION.md
│   ├── FEATURE-MEDIA-UX-POLISH.md
│   ├── FEATURE-MODULE-CONFIG.md
│   ├── FEATURE-MULTI-LOCATION-WEATHER.md
│   ├── FEATURE-ONBOARDING-BACKEND.md
│   ├── FEATURE-ONBOARDING-INTEGRATIONS.md
│   ├── FEATURE-ONBOARDING-WIZARD.md
│   ├── FEATURE-PANEL-IDLE-MODE-SPACE-AWARE.md
│   ├── FEATURE-PANEL-MEDIA-DOMAIN-MVP.md
│   ├── FEATURE-PANEL-SECURITY-ALERTS-GROUPING.md
│   ├── FEATURE-PANEL-SECURITY-ENTRY-POINTS.md
│   ├── FEATURE-PANEL-SECURITY-OVERLAY.md
│   ├── FEATURE-PANEL-SECURITY-SCREEN.md
│   ├── FEATURE-PANEL-SENSOR-DEVICE-PAGE.md
│   ├── FEATURE-PLUGIN-HA-ADOPTION-IMPROVEMENTS.md
│   ├── FEATURE-PLUGIN-HA-AUTO-MAP.md
│   ├── FEATURE-PLUGIN-MATTER.md
│   ├── FEATURE-PLUGIN-SHELLY-V1.md
│   ├── FEATURE-PLUGIN-SHELLY-V1-UI.md
│   ├── FEATURE-PLUGIN-WLED.md
│   ├── FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS.md
│   ├── FEATURE-PLUGIN-ZIGBEE2MQTT.md
│   ├── FEATURE-PROPERTY-TIMESERIES.md
│   ├── FEATURE-SCENES-ADMIN-ROOM.md
│   ├── FEATURE-SCENES-ADMIN-UI.md
│   ├── FEATURE-SCENES-BACKEND-CORE.md
│   ├── FEATURE-SCENES-CORE-REGISTRY.md
│   ├── FEATURE-SCENES-PANEL-QUICK-ACTIONS.md
│   ├── FEATURE-SCENES-PANEL-ROOM-ACTIONS.md
│   ├── FEATURE-SCENES-PLUGIN-SIMPLE.md
│   ├── FEATURE-SECURITY-ACTIVE-ALERTS.md
│   ├── FEATURE-SECURITY-ALARM-PROVIDER.md
│   ├── FEATURE-SECURITY-DOMAIN-BACKEND.md
│   ├── FEATURE-SECURITY-EVENT-TIMELINE.md
│   ├── FEATURE-SECURITY-PROVIDER-REGISTRY.md
│   ├── FEATURE-SPACE-ACTIVITY-MODES.md
│   ├── FEATURE-SPACE-CLIMATE-MVP.md
│   ├── FEATURE-SPACE-COVERS-DOMAIN.md
│   ├── FEATURE-SPACE-INTENTS-LIGHTING-MVP.md
│   ├── FEATURE-SPACE-INTENTS-LIGHTING-ROLES.md
│   ├── FEATURE-SPACE-LIGHTING-ROLES.md
│   ├── FEATURE-SPACE-MEDIA-DOMAIN.md
│   ├── FEATURE-SPACE-MEDIA-DOMAIN-V2.md
│   ├── FEATURE-SPACE-MODE-ADMIN-UI.md
│   ├── FEATURE-SPACE-MODE-PANEL-UI.md
│   ├── FEATURE-SPACE-OCCUPANCY-MODES.md
│   ├── FEATURE-SPACE-SEASONAL-DEFAULTS.md
│   ├── FEATURE-SPACE-SECURITY-DOMAIN.md
│   ├── FEATURE-SPACE-SUGGESTIONS-MVP.md
│   ├── FEATURE-SPACE-TEMPLATES.md
│   ├── FEATURE-SPACE-TIME-SCHEDULING.md
│   ├── FEATURE-SPACE-UNDO-HISTORY.md
│   ├── FEATURE-SPACEPAGE-CLIMATE-SECTION.md
│   ├── FEATURE-SPACEPAGE-EMPTY-STATES.md
│   ├── FEATURE-SPACEPAGE-QUICK-ACTIONS.md
│   ├── FEATURE-SPACEPAGE-STATUS-BADGES.md
│   ├── FEATURE-SPACES-MODULE.md
│   ├── FEATURE-UNIFIED-EXTENSION-LOGS.md
│   ├── FEATURE-WEATHER-PANEL-ENHANCEMENTS.md
│   ├── FEATURE-WINDOW-COVERING-DEVICE-PAGE.md
│   ├── FEATURE-WLED-PLUGIN.md
│   ├── FEATURE-Z2M-CONVERTER-ARCHITECTURE.md
│   ├── PANEL-ROOM-SYSTEM-PAGES-EPIC-AND-TASKS.md
│   ├── PLAN-SPACES-FIRST-UX.md
│   ├── TECH-ADMIN-SPACE-OVERVIEW.md
│   ├── TECH-DISPLAY-HOME-RESOLUTION.md
│   ├── TECH-EPIC-HOUSE-CONTROL-ALIGNMENT.md
│   ├── TECH-HOUSE-CONTROL-SMOKE-TESTS.md
│   ├── TECH-INTENT-CATALOG.md
│   ├── TECH-ONBOARDING-ROUTER-GUARDS.md
│   ├── TECH-SCENES-OPENAPI-SYNC.md
│   ├── TECH-SPACE-CONTEXT-SNAPSHOT.md
│   ├── TECH-SPACE-LAST-ACTIVITY-TRACKING.md
│   └── TECH-SPACES-ONBOARDING-WIZARD.md
└── technical/              # Technical refactors
    ├── TECH-ADMIN-MODULE-CONFIG-TESTS.md
    ├── TECH-EXTENSIONS-CAN-REMOVE-OPENAPI.md
    ├── TECH-PROPERTY-TIMESERIES-E2E.md
    ├── TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND.md
    ├── TECHNICAL-OPENAPI-SPECIFICATION.md
    └── TECHNICAL-SCENES-ACTION-VALIDATION.md
```

---

*Last updated: 2026-01-30*
