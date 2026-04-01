# Smart Panel — Task Roadmap

> Last updated: 2026-04-01. Reflects actual codebase state.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| :white_check_mark: | Done — fully implemented and verified |
| :construction: | In Progress — partially implemented |
| :clipboard: | Planned — not yet started |

---

## 1. Energy Domain

> Full energy monitoring: ingestion, aggregation, grid flows, UI

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-ENERGY-MODULE-MVP](features/FEATURE-ENERGY-MODULE-MVP.md) | backend | :white_check_mark: Done |
| 2 | [FEATURE-ENERGY-AGGREGATION-API](features/FEATURE-ENERGY-AGGREGATION-API.md) | backend | :white_check_mark: Done |
| 3 | [FEATURE-ENERGY-RETENTION-OBSERVABILITY](features/FEATURE-ENERGY-RETENTION-OBSERVABILITY.md) | backend | :white_check_mark: Done |
| 4 | [FEATURE-ENERGY-GRID-FLOWS](features/FEATURE-ENERGY-GRID-FLOWS.md) | backend, admin, panel | :white_check_mark: Done |
| 5 | [FEATURE-ENERGY-GRID-FLOWS-HARDENING](features/FEATURE-ENERGY-GRID-FLOWS-HARDENING.md) | backend, admin, panel | :white_check_mark: Done |
| 6 | [FEATURE-ENERGY-HOME-SUMMARY-CACHING](features/FEATURE-ENERGY-HOME-SUMMARY-CACHING.md) | backend | :white_check_mark: Done |
| 7 | [FEATURE-PANEL-ENERGY-DOMAIN-PAGE](features/FEATURE-PANEL-ENERGY-DOMAIN-PAGE.md) | panel | :white_check_mark: Done |
| 8 | [FEATURE-PANEL-ENERGY-SCREEN](features/FEATURE-PANEL-ENERGY-SCREEN.md) | panel | :white_check_mark: Done (12/14) |
| 9 | [FEATURE-ADMIN-ENERGY-HEADER-WIDGET](features/FEATURE-ADMIN-ENERGY-HEADER-WIDGET.md) | backend, admin | :clipboard: Planned |

**Remaining work:** Admin header widget configuration for per-space energy display settings. Panel energy screen missing bottom nav/more sheet integration and widget test.

---

## 2. Media Domain

> Activity-first media control: endpoints, bindings, activation, UI

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-SPACE-MEDIA-DOMAIN-V2](features/FEATURE-SPACE-MEDIA-DOMAIN-V2.md) | backend, admin, panel | :white_check_mark: Done |
| 2 | [FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD](features/FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD.md) | backend | :white_check_mark: Done |
| 3 | [FEATURE-MEDIA-ADMIN-UI-MVP-1](features/FEATURE-MEDIA-ADMIN-UI-MVP-1.md) | admin | :white_check_mark: Done |
| 4 | [FEATURE-MEDIA-ADMIN-UI-MVP-2](features/FEATURE-MEDIA-ADMIN-UI-MVP-2.md) | admin | :white_check_mark: Done |
| 5 | [FEATURE-MEDIA-DOMAIN-PANEL-MVP](features/FEATURE-MEDIA-DOMAIN-PANEL-MVP.md) | panel | :white_check_mark: Done |
| 6 | [FEATURE-PANEL-MEDIA-DOMAIN-MVP](features/FEATURE-PANEL-MEDIA-DOMAIN-MVP.md) | panel | :white_check_mark: Done |
| 7 | [FEATURE-MEDIA-SIMULATOR-REGRESSION](features/FEATURE-MEDIA-SIMULATOR-REGRESSION.md) | backend | :white_check_mark: Done |
| 8 | [FEATURE-MEDIA-UX-POLISH](features/FEATURE-MEDIA-UX-POLISH.md) | backend, admin, panel | :white_check_mark: Done |

**All media domain tasks complete.**

---

## 3. Expand Smart Panel Domains (Epic)

> [EPIC-EXPAND-SMART-PANEL-DOMAINS](epics/EPIC-EXPAND-SMART-PANEL-DOMAINS.md) — Status: :construction: In Progress

### Phase 1: Domain Completion

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-SPACE-COVERS-DOMAIN](features/FEATURE-SPACE-COVERS-DOMAIN.md) | backend, admin, panel | :white_check_mark: Done (missing 2 unit tests) |
| 2 | FEATURE-SPACE-MEDIA-DOMAIN (via V2) | backend, admin, panel | :white_check_mark: Done |
| 3 | [FEATURE-SPACE-SECURITY-DOMAIN](features/FEATURE-SPACE-SECURITY-DOMAIN.md) | backend, admin, panel | :clipboard: Planned |

### Phase 2: Unified Room Modes

| # | Task | Scope | Status |
|---|------|-------|--------|
| 4 | [FEATURE-SPACE-ACTIVITY-MODES](features/FEATURE-SPACE-ACTIVITY-MODES.md) | backend | :clipboard: Planned |
| 5 | [FEATURE-SPACE-MODE-ADMIN-UI](features/FEATURE-SPACE-MODE-ADMIN-UI.md) | admin | :clipboard: Planned |
| 6 | [FEATURE-SPACE-MODE-PANEL-UI](features/FEATURE-SPACE-MODE-PANEL-UI.md) | panel | :clipboard: Planned |

### Phase 3: Automation Triggers

| # | Task | Scope | Status |
|---|------|-------|--------|
| 7 | [FEATURE-SPACE-TIME-SCHEDULING](features/FEATURE-SPACE-TIME-SCHEDULING.md) | backend | :clipboard: Planned |
| 8 | [FEATURE-SPACE-OCCUPANCY-MODES](features/FEATURE-SPACE-OCCUPANCY-MODES.md) | backend | :clipboard: Planned |
| 9 | [FEATURE-SPACE-SEASONAL-DEFAULTS](features/FEATURE-SPACE-SEASONAL-DEFAULTS.md) | backend | :clipboard: Planned |

**Next up:** Security domain intents (Phase 1), then activity modes (Phase 2 prerequisite for unified room control).

---

## 4. Buddy Module (Epic)

> [EPIC-BUDDY-MODULE](epics/EPIC-BUDDY-MODULE.md) — Status: :white_check_mark: Done

All 4 phases complete: Observer + Text Chat, Proactive Intelligence, Voice Interaction, Multi-Channel.

No remaining active tasks in this epic.

---

## 4a. AI Buddy Face (Epic)

> [EPIC-AI-BUDDY-FACE](features/EPIC-AI-BUDDY-FACE.md) — Status: :clipboard: Planned

Give the AI buddy a visual personality with an animated face on the panel display.
The backend buddy module (LLM, STT, TTS, voice, chat) is already fully implemented.
This epic adds the missing visual face layer on top.

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-AI-ASSISTANT-PANEL-FACE-MVP](features/FEATURE-AI-ASSISTANT-PANEL-FACE-MVP.md) | panel | :clipboard: Planned |
| 2 | [FEATURE-AI-ASSISTANT-PANEL-FACE](features/FEATURE-AI-ASSISTANT-PANEL-FACE.md) | panel | :clipboard: Planned |

**Next up:** MVP face widget with 12 emotions, blink/look system, and buddy state integration.

---

## 4b. Buddy Module Hardening (Epic)

> [EPIC-BUDDY-HARDENING](epics/EPIC-BUDDY-HARDENING.md) — Status: :construction: In Progress

Reliability and correctness fixes identified during code review audit.

### Priority 1 — Critical fixes

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [TECH-BUDDY-SUGGESTION-PERSISTENCE](technical/TECH-BUDDY-SUGGESTION-PERSISTENCE.md) | backend | :clipboard: Planned |
| 2 | [TECH-BUDDY-TIMEZONE-SAFETY](technical/TECH-BUDDY-TIMEZONE-SAFETY.md) | backend | :clipboard: Planned |
| 3 | [TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT](technical/TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT.md) | backend | :white_check_mark: Done |

### Priority 2 — Medium fixes

| # | Task | Scope | Status |
|---|------|-------|--------|
| 4 | [TECH-BUDDY-MEMORY-LEAK-CLEANUP](technical/TECH-BUDDY-MEMORY-LEAK-CLEANUP.md) | backend | :white_check_mark: Done |
| 5 | [TECH-BUDDY-CONVERSATION-HARDENING](technical/TECH-BUDDY-CONVERSATION-HARDENING.md) | backend | :white_check_mark: Done |
| 6 | [TECH-BUDDY-SDK-ERROR-HANDLING](technical/TECH-BUDDY-SDK-ERROR-HANDLING.md) | backend | :clipboard: Planned |

### Priority 3 — Polish

| # | Task | Scope | Status |
|---|------|-------|--------|
| 7 | [TECH-BUDDY-PANEL-ROBUSTNESS](technical/TECH-BUDDY-PANEL-ROBUSTNESS.md) | panel | :clipboard: Planned |
| 8 | [TECH-BUDDY-ADMIN-POLISH](technical/TECH-BUDDY-ADMIN-POLISH.md) | admin | :clipboard: Planned |

**Done:** Timeout enforcement, memory leak cleanup, conversation hardening.
**Next up:** Suggestion persistence (P1), then timezone safety.

---

## 5. App Onboarding (Epic)

> [EPIC-APP-ONBOARDING](epics/EPIC-APP-ONBOARDING.md) — Status: :white_check_mark: Done

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-ONBOARDING-BACKEND](features/FEATURE-ONBOARDING-BACKEND.md) | backend | :white_check_mark: Done |
| 2 | [FEATURE-ONBOARDING-WIZARD](features/FEATURE-ONBOARDING-WIZARD.md) | admin | :white_check_mark: Done |
| 3 | [FEATURE-ONBOARDING-INTEGRATIONS](features/FEATURE-ONBOARDING-INTEGRATIONS.md) | admin | :white_check_mark: Done |

All onboarding tasks complete.

### 5b. Onboarding Device Setup (Epic)

> [EPIC-ONBOARDING-DEVICE-SETUP](epics/EPIC-ONBOARDING-DEVICE-SETUP.md) — Status: :white_check_mark: Done

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-ONBOARDING-DEVICE-DISCOVERY](features/FEATURE-ONBOARDING-DEVICE-DISCOVERY.md) | admin | :white_check_mark: Done |
| 2 | [FEATURE-ONBOARDING-INTEGRATION-CONFIG](features/FEATURE-ONBOARDING-INTEGRATION-CONFIG.md) | admin | :white_check_mark: Done |
| 3 | [FEATURE-ONBOARDING-SPACES-ASSIGNMENT](features/FEATURE-ONBOARDING-SPACES-ASSIGNMENT.md) | admin | :white_check_mark: Done |

All onboarding device setup tasks complete.

---

## 6. Space / Climate

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-SPACEPAGE-CLIMATE-SECTION](features/FEATURE-SPACEPAGE-CLIMATE-SECTION.md) | backend, panel | :white_check_mark: Done |

---

## 7. Security

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-SECURITY-SENSORS-PROVIDER](features/FEATURE-SECURITY-SENSORS-PROVIDER.md) | backend | :white_check_mark: Done |

---

## 8. Virtual Devices (Epic)

> [EPIC-VIRTUAL-DEVICES](features/EPIC-VIRTUAL-DEVICES.md) — Status: :clipboard: Planned

Split multi-channel devices into independent child devices and compose new logical devices from channels across multiple physical devices. Enables flexible room assignment, category remapping, and spec-compliant virtual devices.

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-DEVICE-SPLITTER-PLUGIN](features/FEATURE-DEVICE-SPLITTER-PLUGIN.md) | backend, admin, panel | :clipboard: Planned |
| 2 | [FEATURE-DEVICE-COMPOSITE-PLUGIN](features/FEATURE-DEVICE-COMPOSITE-PLUGIN.md) | backend, admin, panel | :clipboard: Planned |

**Next up:** Split device plugin first (provides `hidden` flag foundation), then combined device plugin.

---

## 9. Plugins

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS](features/FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS.md) | backend, admin | :white_check_mark: Done |
| 2 | [FEATURE-PLUGIN-MATTER](features/FEATURE-PLUGIN-MATTER.md) | backend, admin | :clipboard: Planned |
| 3 | [FEATURE-PLUGIN-ZIGBEE-HERDSMAN](features/FEATURE-PLUGIN-ZIGBEE-HERDSMAN.md) | backend, admin | :clipboard: Planned |

**Remaining work:** Matter plugin implementation. Direct Zigbee integration via zigbee-herdsman (6 phases: coordinator service, converters, device platform, adoption flow, admin UI, network management).

---

## 10. Extension Actions & Interactive Sessions (Epic)

> [EPIC-EXTENSION-ACTIONS](epics/EPIC-EXTENSION-ACTIONS.md) — Status: :construction: In Progress

Extensions expose callable actions and interactive terminal sessions from the admin UI. Inspired by HA add-on control panels.

### Phase 1: Immediate Actions (Done)

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-EXTENSION-ACTIONS-MVP](features/FEATURE-EXTENSION-ACTIONS-MVP.md) | backend, admin | :white_check_mark: Done |

### Phase 2: Interactive Session Infrastructure

| # | Task | Scope | Status |
|---|------|-------|--------|
| 2 | [FEATURE-INTERACTIVE-SESSION-PROTOCOL](features/FEATURE-INTERACTIVE-SESSION-PROTOCOL.md) | backend | :clipboard: Planned |
| 3 | [FEATURE-INTERACTIVE-SESSION-ADMIN-UI](features/FEATURE-INTERACTIVE-SESSION-ADMIN-UI.md) | admin | :clipboard: Planned |

### Phase 3: Interactive Session Consumers

| # | Task | Scope | Status |
|---|------|-------|--------|
| 4 | [FEATURE-INTERACTIVE-SIMULATOR-ACTIONS](features/FEATURE-INTERACTIVE-SIMULATOR-ACTIONS.md) | backend | :clipboard: Planned |
| 5 | [FEATURE-INTERACTIVE-SYSTEM-UPDATES](features/FEATURE-INTERACTIVE-SYSTEM-UPDATES.md) | backend, admin | :clipboard: Planned |

### Phase 4: Hardening & Marketplace

| # | Task | Scope | Status |
|---|------|-------|--------|
| 6 | [TECH-EXTENSION-ACTION-PERMISSIONS](technical/TECH-EXTENSION-ACTION-PERMISSIONS.md) | backend | :clipboard: Planned |
| 7 | [TECH-EXTENSION-ACTION-AUDIT-LOG](technical/TECH-EXTENSION-ACTION-AUDIT-LOG.md) | backend, admin | :clipboard: Planned |
| 8 | [FEATURE-EXTENSION-MARKETPLACE-SESSIONS](features/FEATURE-EXTENSION-MARKETPLACE-SESSIONS.md) | backend, admin | :clipboard: Planned |

**Done:** Immediate actions with flat forms, dynamic parameters, simulator plugin with 6 actions, admin UI with Actions tab.
**Next up:** Interactive session WebSocket protocol, then terminal UI component.

---

## 11. Companion Display (Epic)

> [EPIC-COMPANION-DISPLAY](epics/EPIC-COMPANION-DISPLAY.md) — Status: :clipboard: Planned

ESP32-based knob with round LCD as a companion peripheral to the main panel display. Provides tactile rotary control for temperature, brightness, volume, and more.

### Phase 1: Backend Foundation

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-COMPANION-BACKEND-PLUGIN](features/FEATURE-COMPANION-BACKEND-PLUGIN.md) | backend | :clipboard: Planned |
| 2 | [FEATURE-COMPANION-ADMIN-UI](features/FEATURE-COMPANION-ADMIN-UI.md) | admin | :clipboard: Planned |

### Phase 2: Firmware Generation & Provisioning

| # | Task | Scope | Status |
|---|------|-------|--------|
| 3 | [FEATURE-COMPANION-SCREEN-COMPILER](features/FEATURE-COMPANION-SCREEN-COMPILER.md) | backend | :clipboard: Planned |
| 4 | [FEATURE-COMPANION-ESPHOME-GENERATOR](features/FEATURE-COMPANION-ESPHOME-GENERATOR.md) | backend | :clipboard: Planned |
| 5 | [FEATURE-COMPANION-PROVISIONING](features/FEATURE-COMPANION-PROVISIONING.md) | backend, admin | :clipboard: Planned |

### Phase 3: Runtime Communication

| # | Task | Scope | Status |
|---|------|-------|--------|
| 6 | [FEATURE-COMPANION-ESPHOME-COMPONENT](features/FEATURE-COMPANION-ESPHOME-COMPONENT.md) | firmware | :clipboard: Planned |
| 7 | [FEATURE-COMPANION-PANEL-SERIAL](features/FEATURE-COMPANION-PANEL-SERIAL.md) | panel | :clipboard: Planned |

### Phase 4: Screen Types & Polish

| # | Task | Scope | Status |
|---|------|-------|--------|
| 8 | [FEATURE-COMPANION-SCREEN-TYPES](features/FEATURE-COMPANION-SCREEN-TYPES.md) | firmware, backend | :clipboard: Planned |
| 9 | [FEATURE-COMPANION-LED-RING](features/FEATURE-COMPANION-LED-RING.md) | firmware | :clipboard: Planned |

**Next up:** Backend plugin with data model and CRUD API (Phase 1).

---

## 12. Device & Infrastructure

> Tasks from real-world device testing sessions — installation, updates, networking, storage resilience.

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-INFLUXDB-FALLBACK](features/influxdb-memory-fallback.md) | backend, admin | :white_check_mark: Done |
| 2 | [FEATURE-IMAGE-UPDATE](features/image-update-mechanism.md) | backend | :white_check_mark: Done |
| 3 | [FEATURE-FLUTTERPI-MDNS](features/flutter-pi-mdns-discovery-service.md) | backend, panel | :white_check_mark: Done |
| 4 | [FEATURE-CAPTIVE-PORTAL](features/captive-portal-wifi-setup.md) | backend | :white_check_mark: Done |
| 5 | [FEATURE-PANEL-APP-UPDATES](features/FEATURE-PANEL-APP-UPDATES.md) | backend, admin, panel | :clipboard: Planned |
| 6 | [FEATURE-SYSTEM-SERVICE-RESTART](features/FEATURE-SYSTEM-SERVICE-RESTART.md) | backend, admin | :clipboard: Planned |

**Done:** Storage module refactored with plugin architecture and in-memory fallback, image-based update mechanism for Raspbian, mDNS discovery proxy for flutter-pi, captive portal WiFi provisioning.
**Remaining:** Panel display app OTA updates. Service-only soft restart (vs full system reboot).

---

## 13. Technical Debt

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [TECH-ADMIN-MODULE-CONFIG-TESTS](technical/TECH-ADMIN-MODULE-CONFIG-TESTS.md) | admin | :white_check_mark: Done |
| 2 | [TECH-ELIMINATE-FORWARD-REF](technical/TECH-ELIMINATE-FORWARD-REF.md) | backend | :white_check_mark: Done |
| 3 | [TECH-EXTENSIONS-CAN-REMOVE-OPENAPI](technical/TECH-EXTENSIONS-CAN-REMOVE-OPENAPI.md) | backend, admin | :white_check_mark: Done |
| 4 | [TECH-ONBOARDING-ROUTER-GUARDS](technical/TECH-ONBOARDING-ROUTER-GUARDS.md) | admin | :white_check_mark: Done |
| 5 | [TECH-PROPERTY-TIMESERIES-E2E](technical/TECH-PROPERTY-TIMESERIES-E2E.md) | backend | :white_check_mark: Done |

---

## 14. Other Planned Features

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-APP-UPDATES](features/FEATURE-APP-UPDATES.md) | backend, admin, panel | :white_check_mark: Done |
| 2 | [FEATURE-EXTENSION-LOGS-FILTERS](features/FEATURE-EXTENSION-LOGS-FILTERS.md) | admin | :white_check_mark: Done |
| 3 | [FEATURE-LINUX-INSTALL-ENHANCEMENTS](features/FEATURE-LINUX-INSTALL-ENHANCEMENTS.md) | backend | :white_check_mark: Done |
| 4 | [FEATURE-PANEL-SENSOR-DEVICE-PAGE](features/FEATURE-PANEL-SENSOR-DEVICE-PAGE.md) | panel | :white_check_mark: Done |
| 5 | [FEATURE-WEATHER-PANEL-ENHANCEMENTS](features/FEATURE-WEATHER-PANEL-ENHANCEMENTS.md) | panel | :clipboard: Planned |

---

## 15. Plans

| # | Plan | Status |
|---|------|--------|
| 1 | [plan-epic-intents-backend](plans/plan-epic-intents-backend.md) | :white_check_mark: Done |

---

## Summary

| Category | Done | In Progress | Planned | Total |
|----------|------|-------------|---------|-------|
| Energy | 8 | 0 | 1 | 9 |
| Media | 8 | 0 | 0 | 8 |
| Domains Epic | 2 | 0 | 7 | 9 |
| Buddy Epic | 9 | 0 | 0 | 9 |
| AI Buddy Face | 0 | 0 | 2 | 2 |
| Buddy Hardening | 3 | 0 | 5 | 8 |
| Onboarding Epic | 3 | 0 | 0 | 3 |
| Onboarding Device Setup | 3 | 0 | 0 | 3 |
| Space/Climate | 1 | 0 | 0 | 1 |
| Security | 1 | 0 | 0 | 1 |
| Virtual Devices | 0 | 0 | 2 | 2 |
| Companion Display | 0 | 0 | 9 | 9 |
| Plugins | 1 | 0 | 2 | 3 |
| Extension Actions | 1 | 0 | 7 | 8 |
| Device & Infrastructure | 4 | 0 | 2 | 6 |
| Technical | 5 | 0 | 0 | 5 |
| Other Features | 4 | 0 | 1 | 5 |
| Plans | 1 | 0 | 0 | 1 |
| **Total** | **54** | **0** | **38** | **92** |
