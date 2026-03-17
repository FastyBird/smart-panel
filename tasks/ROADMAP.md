# Smart Panel — Task Roadmap

> Auto-generated from task audit on 2026-03-13. Reflects actual codebase state.

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

> [EPIC-BUDDY-HARDENING](epics/EPIC-BUDDY-HARDENING.md) — Status: :clipboard: Planned

Reliability and correctness fixes identified during code review audit.

### Priority 1 — Critical fixes

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [TECH-BUDDY-SUGGESTION-PERSISTENCE](technical/TECH-BUDDY-SUGGESTION-PERSISTENCE.md) | backend | :clipboard: Planned |
| 2 | [TECH-BUDDY-TIMEZONE-SAFETY](technical/TECH-BUDDY-TIMEZONE-SAFETY.md) | backend | :clipboard: Planned |
| 3 | [TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT](technical/TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT.md) | backend | :clipboard: Planned |

### Priority 2 — Medium fixes

| # | Task | Scope | Status |
|---|------|-------|--------|
| 4 | [TECH-BUDDY-MEMORY-LEAK-CLEANUP](technical/TECH-BUDDY-MEMORY-LEAK-CLEANUP.md) | backend | :clipboard: Planned |
| 5 | [TECH-BUDDY-CONVERSATION-HARDENING](technical/TECH-BUDDY-CONVERSATION-HARDENING.md) | backend | :clipboard: Planned |
| 6 | [TECH-BUDDY-SDK-ERROR-HANDLING](technical/TECH-BUDDY-SDK-ERROR-HANDLING.md) | backend | :clipboard: Planned |

### Priority 3 — Polish

| # | Task | Scope | Status |
|---|------|-------|--------|
| 7 | [TECH-BUDDY-PANEL-ROBUSTNESS](technical/TECH-BUDDY-PANEL-ROBUSTNESS.md) | panel | :clipboard: Planned |
| 8 | [TECH-BUDDY-ADMIN-POLISH](technical/TECH-BUDDY-ADMIN-POLISH.md) | admin | :clipboard: Planned |

**Next up:** Suggestion persistence (P1), then timezone safety and timeout enforcement.

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

## 8. Plugins

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS](features/FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS.md) | backend, admin | :white_check_mark: Done |
| 2 | [FEATURE-PLUGIN-MATTER](features/FEATURE-PLUGIN-MATTER.md) | backend, admin | :clipboard: Planned |

**Remaining work:** Matter plugin implementation.

---

## 9. Technical Debt

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [TECH-ADMIN-MODULE-CONFIG-TESTS](technical/TECH-ADMIN-MODULE-CONFIG-TESTS.md) | admin | :white_check_mark: Done |
| 2 | [TECH-ELIMINATE-FORWARD-REF](technical/TECH-ELIMINATE-FORWARD-REF.md) | backend | :white_check_mark: Done |
| 3 | [TECH-EXTENSIONS-CAN-REMOVE-OPENAPI](technical/TECH-EXTENSIONS-CAN-REMOVE-OPENAPI.md) | backend, admin | :white_check_mark: Done |
| 4 | [TECH-ONBOARDING-ROUTER-GUARDS](technical/TECH-ONBOARDING-ROUTER-GUARDS.md) | admin | :white_check_mark: Done |
| 5 | [TECH-PROPERTY-TIMESERIES-E2E](technical/TECH-PROPERTY-TIMESERIES-E2E.md) | backend | :clipboard: Planned |

---

## 10. Other Planned Features

| # | Task | Scope | Status |
|---|------|-------|--------|
| 1 | [FEATURE-APP-UPDATES](features/FEATURE-APP-UPDATES.md) | backend, admin, panel | :white_check_mark: Done |
| 2 | [FEATURE-EXTENSION-LOGS-FILTERS](features/FEATURE-EXTENSION-LOGS-FILTERS.md) | admin | :clipboard: Planned |
| 3 | [FEATURE-LINUX-INSTALL-ENHANCEMENTS](features/FEATURE-LINUX-INSTALL-ENHANCEMENTS.md) | backend | :white_check_mark: Done |
| 4 | [FEATURE-PANEL-SENSOR-DEVICE-PAGE](features/FEATURE-PANEL-SENSOR-DEVICE-PAGE.md) | panel | :clipboard: Planned |
| 5 | [FEATURE-WEATHER-PANEL-ENHANCEMENTS](features/FEATURE-WEATHER-PANEL-ENHANCEMENTS.md) | panel | :clipboard: Planned |

---

## 11. Plans

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
| Buddy Hardening | 0 | 0 | 8 | 8 |
| Onboarding Epic | 3 | 0 | 0 | 3 |
| Onboarding Device Setup | 3 | 0 | 0 | 3 |
| Space/Climate | 1 | 0 | 0 | 1 |
| Security | 1 | 0 | 0 | 1 |
| Plugins | 1 | 0 | 1 | 2 |
| Technical | 4 | 0 | 1 | 5 |
| Other Features | 2 | 0 | 3 | 5 |
| Plans | 1 | 0 | 0 | 1 |
| **Total** | **43** | **0** | **21** | **64** |
