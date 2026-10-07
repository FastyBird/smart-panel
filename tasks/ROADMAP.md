# Smart Panel — Task Roadmap

> Last updated: 2026-10-07. Reflects actual codebase state (audited against the code on 2026-10-07).

## GitHub tracking

Every open epic has a GitHub milestone and an epic issue whose sub-issues are titled as the PRs that close them.

| Epic | Milestone | Epic issue |
| ---- | --------- | ---------- |
| Remote access | Remote access | #897 |
| UniFi Protect | UniFi Protect | #1175 |
| Matter | Matter | #1191 |
| Space security domain and activity modes | Space modes and security | #1287 |
| Animated Buddy face | Buddy face | #1253 |
| Buddy hardening | Buddy hardening | #1264 |
| Buddy adaptive context retrieval | Buddy adaptive context | #1268 |
| Companion display | Companion display | #1236 |
| Interactive extension action sessions | Interactive extension sessions | #1303 |
| Panel app updates | Panel app updates | #1314 |
| Zigbee Herdsman plugin | Zigbee Herdsman | #1322 |
| Security hardening phase 2 | Security hardening phase 2 | #1330 |
| Virtual devices follow-ups | Virtual devices follow-ups | #1336 |
| Backup and restore follow-ups | Backup and restore follow-ups | #1346 |

Standalone open issues from the audit: #1353 (Dependabot advisories), #1355 and #1356 (panel signage rendering), #1357 (energy screen widget test), #1358 (extension actions and managed services docs), #1359 (intent failure badge).

---

## Legend

| Symbol             | Meaning                               |
| ------------------ | ------------------------------------- |
| :white_check_mark: | Done — fully implemented and verified |
| :construction:     | In Progress — partially implemented   |
| :clipboard:        | Planned — not yet started             |

---

## 1. Energy Domain

> Full energy monitoring: ingestion, aggregation, grid flows, UI

| #   | Task                                                                                         | Scope                 | Status                  | Notes                                              |
| --- | -------------------------------------------------------------------------------------------- | --------------------- | ----------------------- | -------------------------------------------------- |
| 1   | [FEATURE-ENERGY-MODULE-MVP](features/FEATURE-ENERGY-MODULE-MVP.md)                           | backend               | :white_check_mark: Done |                                                    |
| 2   | [FEATURE-ENERGY-AGGREGATION-API](features/FEATURE-ENERGY-AGGREGATION-API.md)                 | backend               | :white_check_mark: Done |                                                    |
| 3   | [FEATURE-ENERGY-RETENTION-OBSERVABILITY](features/FEATURE-ENERGY-RETENTION-OBSERVABILITY.md) | backend               | :white_check_mark: Done |                                                    |
| 4   | [FEATURE-ENERGY-GRID-FLOWS](features/FEATURE-ENERGY-GRID-FLOWS.md)                           | backend, admin, panel | :white_check_mark: Done |                                                    |
| 5   | [FEATURE-ENERGY-GRID-FLOWS-HARDENING](features/FEATURE-ENERGY-GRID-FLOWS-HARDENING.md)       | backend, admin, panel | :white_check_mark: Done |                                                    |
| 6   | [FEATURE-ENERGY-HOME-SUMMARY-CACHING](features/FEATURE-ENERGY-HOME-SUMMARY-CACHING.md)       | backend               | :white_check_mark: Done |                                                    |
| 7   | [FEATURE-PANEL-ENERGY-DOMAIN-PAGE](features/FEATURE-PANEL-ENERGY-DOMAIN-PAGE.md)             | panel                 | :white_check_mark: Done |                                                    |
| 8   | [FEATURE-PANEL-ENERGY-SCREEN](features/FEATURE-PANEL-ENERGY-SCREEN.md)                       | panel                 | :white_check_mark: Done | Widget test missing (#1357)                     |
| 9   | [FEATURE-ADMIN-ENERGY-HEADER-WIDGET](features/FEATURE-ADMIN-ENERGY-HEADER-WIDGET.md)         | backend, admin        | :white_check_mark: Done | Shipped as space `status_widgets`                  |

**Remaining work:** energy screen widget test (#1357).

---

## 2. Media Domain

> Activity-first media control: endpoints, bindings, activation, UI

| #   | Task                                                                                     | Scope                 | Status                  |
| --- | ---------------------------------------------------------------------------------------- | --------------------- | ----------------------- |
| 1   | [FEATURE-SPACE-MEDIA-DOMAIN-V2](features/FEATURE-SPACE-MEDIA-DOMAIN-V2.md)               | backend, admin, panel | :white_check_mark: Done |
| 2   | [FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD](features/FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD.md) | backend               | :white_check_mark: Done |
| 3   | [FEATURE-MEDIA-ADMIN-UI-MVP-1](features/FEATURE-MEDIA-ADMIN-UI-MVP-1.md)                 | admin                 | :white_check_mark: Done |
| 4   | [FEATURE-MEDIA-ADMIN-UI-MVP-2](features/FEATURE-MEDIA-ADMIN-UI-MVP-2.md)                 | admin                 | :white_check_mark: Done |
| 5   | [FEATURE-MEDIA-DOMAIN-PANEL-MVP](features/FEATURE-MEDIA-DOMAIN-PANEL-MVP.md)             | panel                 | :white_check_mark: Done |
| 6   | [FEATURE-PANEL-MEDIA-DOMAIN-MVP](features/FEATURE-PANEL-MEDIA-DOMAIN-MVP.md)             | panel                 | :white_check_mark: Done |
| 7   | [FEATURE-MEDIA-SIMULATOR-REGRESSION](features/FEATURE-MEDIA-SIMULATOR-REGRESSION.md)     | backend               | :white_check_mark: Done |
| 8   | [FEATURE-MEDIA-UX-POLISH](features/FEATURE-MEDIA-UX-POLISH.md)                           | backend, admin, panel | :white_check_mark: Done |

**All media domain tasks complete.**

---

## 3. Expand Smart Panel Domains (Epic)

> [EPIC-EXPAND-SMART-PANEL-DOMAINS](epics/EPIC-EXPAND-SMART-PANEL-DOMAINS.md) — Status: :construction: In Progress

### Phase 1: Domain Completion

| #   | Task                                                                       | Scope                 | Status                  | Notes                                                    |
| --- | -------------------------------------------------------------------------- | --------------------- | ----------------------- | -------------------------------------------------------- |
| 1   | [FEATURE-SPACE-COVERS-DOMAIN](features/FEATURE-SPACE-COVERS-DOMAIN.md)     | backend, admin, panel | :white_check_mark: Done | 10/12 — missing 2 unit tests (position + command covers) |
| 2   | FEATURE-SPACE-MEDIA-DOMAIN (via V2)                                        | backend, admin, panel | :white_check_mark: Done |                                                          |
| 3   | [FEATURE-SPACE-SECURITY-DOMAIN](features/FEATURE-SPACE-SECURITY-DOMAIN.md) | backend, admin, panel | :clipboard: Planned     | #1288 … #1291                                    |

### Phase 2: Unified Room Modes

| #   | Task                                                                     | Scope   | Status              |
| --- | ------------------------------------------------------------------------ | ------- | ------------------- |
| 4   | [FEATURE-SPACE-ACTIVITY-MODES](features/FEATURE-SPACE-ACTIVITY-MODES.md) | backend | :clipboard: Planned |
| 5   | [FEATURE-SPACE-MODE-ADMIN-UI](features/FEATURE-SPACE-MODE-ADMIN-UI.md)   | admin   | :clipboard: Planned |
| 6   | [FEATURE-SPACE-MODE-PANEL-UI](features/FEATURE-SPACE-MODE-PANEL-UI.md)   | panel   | :clipboard: Planned |

### Phase 3: Automation Triggers

| #   | Task                                                                           | Scope   | Status              |
| --- | ------------------------------------------------------------------------------ | ------- | ------------------- |
| 7   | [FEATURE-SPACE-TIME-SCHEDULING](features/FEATURE-SPACE-TIME-SCHEDULING.md)     | backend | :clipboard: Planned |
| 8   | [FEATURE-SPACE-OCCUPANCY-MODES](features/FEATURE-SPACE-OCCUPANCY-MODES.md)     | backend | :clipboard: Planned |
| 9   | [FEATURE-SPACE-SEASONAL-DEFAULTS](features/FEATURE-SPACE-SEASONAL-DEFAULTS.md) | backend | :clipboard: Planned |

**Tracking:** epic #1287 — security domain SM-1 … SM-4, activity modes SM-5 … SM-9, triggers SM-10 … SM-15. Camera person detection as an occupancy input is #1221 (UniFi Protect epic). The feature files list the backend, admin and panel parts; the scope columns above show the primary surface.

**Next up:** Security domain (Phase 1), then activity modes (Phase 2 prerequisite for unified room control).

---

## 4. Buddy Module (Epic)

> [EPIC-BUDDY-MODULE](epics/EPIC-BUDDY-MODULE.md) — Status: :white_check_mark: Done

All 4 phases complete: Observer + Text Chat, Proactive Intelligence, Voice Interaction, Multi-Channel.

### Phase 3: Voice Interaction

| #   | Task                                                                                 | Scope          | Status                  |
| --- | ------------------------------------------------------------------------------------ | -------------- | ----------------------- |
| 1   | [FEATURE-BUDDY-VOICE-WAKE-WORD](features/FEATURE-BUDDY-VOICE-WAKE-WORD.md)           | backend, panel | :white_check_mark: Done |
| 2   | [FEATURE-BUDDY-VOICE-STT](features/FEATURE-BUDDY-VOICE-STT.md)                       | backend        | :white_check_mark: Done |
| 3   | [FEATURE-BUDDY-VOICE-TTS](features/FEATURE-BUDDY-VOICE-TTS.md)                       | backend        | :white_check_mark: Done |
| 4   | [FEATURE-BUDDY-VOICE-INTENT-ROUTING](features/FEATURE-BUDDY-VOICE-INTENT-ROUTING.md) | backend        | :white_check_mark: Done |

### Phase 4: Multi-Channel & Personality

| #   | Task                                                                               | Scope   | Status                  |
| --- | ---------------------------------------------------------------------------------- | ------- | ----------------------- |
| 5   | [FEATURE-BUDDY-CHANNEL-ADMIN-CHAT](features/FEATURE-BUDDY-CHANNEL-ADMIN-CHAT.md)   | admin   | :white_check_mark: Done |
| 6   | [FEATURE-BUDDY-CHANNEL-PERSONALITY](features/FEATURE-BUDDY-CHANNEL-PERSONALITY.md) | backend | :white_check_mark: Done |
| 7   | [FEATURE-BUDDY-CHANNEL-TELEGRAM](features/FEATURE-BUDDY-CHANNEL-TELEGRAM.md)       | backend | :white_check_mark: Done |
| 8   | [FEATURE-BUDDY-CHANNEL-DISCORD](features/FEATURE-BUDDY-CHANNEL-DISCORD.md)         | backend | :white_check_mark: Done |
| 9   | [FEATURE-BUDDY-CHANNEL-WHATSAPP](features/FEATURE-BUDDY-CHANNEL-WHATSAPP.md)       | backend | :white_check_mark: Done |

---

## 4a. AI Buddy Face (Epic)

> [EPIC-AI-BUDDY-FACE](epics/EPIC-AI-BUDDY-FACE.md) — Status: :clipboard: Planned

Give the AI buddy a visual personality with an animated face on the panel display.
The backend buddy module (LLM, STT, TTS, voice, chat) is already fully implemented.
This epic adds the missing visual face layer on top.

| #   | Task                                                                                   | Scope | Status              |
| --- | -------------------------------------------------------------------------------------- | ----- | ------------------- |
| 1   | [FEATURE-AI-ASSISTANT-PANEL-FACE-MVP](features/FEATURE-AI-ASSISTANT-PANEL-FACE-MVP.md) | panel | :clipboard: Planned |
| 2   | [FEATURE-AI-ASSISTANT-PANEL-FACE](features/FEATURE-AI-ASSISTANT-PANEL-FACE.md)         | panel | :clipboard: Planned |

**Tracking:** epic #1253 (BF-1 … BF-10).

**Next up:** MVP face widget with 14 emotions, blink/look system, and buddy state integration.

---

## 4b. Buddy Module Hardening (Epic)

> [EPIC-BUDDY-HARDENING](epics/EPIC-BUDDY-HARDENING.md) — Status: :construction: In Progress

Reliability and correctness fixes identified during code review audit.

### Priority 1 — Critical fixes

| #   | Task                                                                                            | Scope   | Status                  | Notes                                                          |
| --- | ----------------------------------------------------------------------------------------------- | ------- | ----------------------- | -------------------------------------------------------------- |
| 1   | [TECH-BUDDY-SUGGESTION-PERSISTENCE](technical/TECH-BUDDY-SUGGESTION-PERSISTENCE.md)             | backend | :white_check_mark: Done |                                                                |
| 2   | [TECH-BUDDY-TIMEZONE-SAFETY](technical/TECH-BUDDY-TIMEZONE-SAFETY.md)                           | backend | :white_check_mark: Done | 5/6 — formatTimeLabel skipped (timezone applied at extraction) |
| 3   | [TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT](technical/TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT.md) | backend | :white_check_mark: Done |                                                                |

### Priority 2 — Medium fixes

| #   | Task                                                                                | Scope   | Status                  | Notes                                                      |
| --- | ----------------------------------------------------------------------------------- | ------- | ----------------------- | ---------------------------------------------------------- |
| 4   | [TECH-BUDDY-MEMORY-LEAK-CLEANUP](technical/TECH-BUDDY-MEMORY-LEAK-CLEANUP.md)       | backend | :white_check_mark: Done | 2/4 — stale entry cleanup + LRU eviction not implemented   |
| 5   | [TECH-BUDDY-CONVERSATION-HARDENING](technical/TECH-BUDDY-CONVERSATION-HARDENING.md) | backend | :white_check_mark: Done |                                                            |
| 6   | [TECH-BUDDY-SDK-ERROR-HANDLING](technical/TECH-BUDDY-SDK-ERROR-HANDLING.md)         | backend | :white_check_mark: Done | 5/7 — SDK type interfaces skipped (dynamic import pattern) |

### Priority 3 — Polish

| #   | Task                                                                    | Scope | Status                  | Notes                                                     |
| --- | ----------------------------------------------------------------------- | ----- | ----------------------- | --------------------------------------------------------- |
| 7   | [TECH-BUDDY-PANEL-ROBUSTNESS](technical/TECH-BUDDY-PANEL-ROBUSTNESS.md) | panel | :clipboard: Planned     |                                                           |
| 8   | [TECH-BUDDY-ADMIN-POLISH](technical/TECH-BUDDY-ADMIN-POLISH.md)         | admin | :white_check_mark: Done | 4/5 — wizard split skipped (well-organized at 1084 lines) |

**Done:** Timeout enforcement, memory leak cleanup, conversation hardening, suggestion persistence, timezone safety, SDK error handling, admin polish.
**Remaining:** Panel robustness (P3), tracked in epic #1264 (#1265, #1266, #1267).

---

## 5. App Onboarding (Epic)

> [EPIC-APP-ONBOARDING](epics/EPIC-APP-ONBOARDING.md) — Status: :white_check_mark: Done

| #   | Task                                                                           | Scope   | Status                  |
| --- | ------------------------------------------------------------------------------ | ------- | ----------------------- |
| 1   | [FEATURE-ONBOARDING-BACKEND](features/FEATURE-ONBOARDING-BACKEND.md)           | backend | :white_check_mark: Done |
| 2   | [FEATURE-ONBOARDING-WIZARD](features/FEATURE-ONBOARDING-WIZARD.md)             | admin   | :white_check_mark: Done |
| 3   | [FEATURE-ONBOARDING-INTEGRATIONS](features/FEATURE-ONBOARDING-INTEGRATIONS.md) | admin   | :white_check_mark: Done |

All onboarding tasks complete.

### 5b. Onboarding Device Setup (Epic)

> [EPIC-ONBOARDING-DEVICE-SETUP](epics/EPIC-ONBOARDING-DEVICE-SETUP.md) — Status: :white_check_mark: Done

| #   | Task                                                                                       | Scope | Status                  |
| --- | ------------------------------------------------------------------------------------------ | ----- | ----------------------- |
| 1   | [FEATURE-ONBOARDING-DEVICE-DISCOVERY](features/FEATURE-ONBOARDING-DEVICE-DISCOVERY.md)     | admin | :white_check_mark: Done |
| 2   | [FEATURE-ONBOARDING-INTEGRATION-CONFIG](features/FEATURE-ONBOARDING-INTEGRATION-CONFIG.md) | admin | :white_check_mark: Done |
| 3   | [FEATURE-ONBOARDING-SPACES-ASSIGNMENT](features/FEATURE-ONBOARDING-SPACES-ASSIGNMENT.md)   | admin | :white_check_mark: Done |

All onboarding device setup tasks complete.

---

## 6. Space / Climate

| #   | Task                                                                               | Scope          | Status                  |
| --- | ---------------------------------------------------------------------------------- | -------------- | ----------------------- |
| 1   | [FEATURE-SPACEPAGE-CLIMATE-SECTION](features/FEATURE-SPACEPAGE-CLIMATE-SECTION.md) | backend, panel | :white_check_mark: Done |

---

## 7. Security

| #   | Task                                                                               | Scope   | Status                  |
| --- | ---------------------------------------------------------------------------------- | ------- | ----------------------- |
| 1   | [FEATURE-SECURITY-SENSORS-PROVIDER](features/FEATURE-SECURITY-SENSORS-PROVIDER.md) | backend | :white_check_mark: Done |

---

## 8. Virtual Devices (Epic)

> [EPIC-VIRTUAL-DEVICES](archive/EPIC-VIRTUAL-DEVICES.md) — Status: :white_check_mark: Done

Build a device from properties of other devices — splitting one physical device into several, or composing one logical device from several — so the result is indistinguishable from a native device. The two originally-planned plugins (`devices-split`, `devices-combined`) were superseded before implementation by a single `devices-virtual` plugin; see [`docs/superpowers/specs/2026-07-31-virtual-devices-design.md`](../docs/superpowers/specs/2026-07-31-virtual-devices-design.md).

| #   | Task                                                                                            | Scope                 | Status                  | Notes                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------- | --------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [FEATURE-DEVICE-VIRTUAL-PLUGIN](../docs/superpowers/specs/2026-07-31-virtual-devices-design.md) | backend, admin, panel | :white_check_mark: Done | Backend plugin, admin wizard and detail page with remap, `hidden` filtering across every picker, panel rendering. The six closed-loop categories stay blocked by the design's v1 boundary                 |
| 2   | [BUG-ENERGY-VIRTUAL-ROOM-ATTRIBUTION](bugs/BUG-ENERGY-VIRTUAL-ROOM-ATTRIBUTION.md)              | backend               | :white_check_mark: Done | A projected meter now has one accountable claimant and is billed to the device presenting it; the space readers scope by the recorded room, so moving or deleting a device no longer rewrites its history |
| 3   | [TECH-VIRTUAL-DEVICES-FOLLOWUPS](technical/TECH-VIRTUAL-DEVICES-FOLLOWUPS.md)                   | backend               | :construction: In Progress | 23 of 38 items open, none blocking; tracked in epic #1336                                                                                                                                         |

**Next up:** [controller support](../docs/superpowers/specs/2026-07-31-virtual-devices-design.md#controller-support), which unblocks the six closed-loop categories the v1 boundary excludes. It starts with a design rather than a task — a control loop touches safety, concurrency and the platform's command path — and the design spec now carries what that design has to answer, in what order the decisions unblock each other, which categories to take first, and what the deliverable is. [TECH-VIRTUAL-DEVICES-FOLLOWUPS](technical/TECH-VIRTUAL-DEVICES-FOLLOWUPS.md) is the other open thread, none of it blocking.

---

## 9. Plugins

| #   | Task                                                                                                 | Scope                 | Status                     |
| --- | ---------------------------------------------------------------------------------------------------- | --------------------- | -------------------------- |
| 1   | [FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS](features/FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS.md)     | backend, admin        | :white_check_mark: Done    |
| 2   | [FEATURE-PLUGIN-MATTER](features/FEATURE-PLUGIN-MATTER.md) — superseded by [EPIC-MATTER](#13b-matter-epic) | backend, admin        | Superseded                 |
| 3   | [FEATURE-PLUGIN-ZIGBEE-HERDSMAN](features/FEATURE-PLUGIN-ZIGBEE-HERDSMAN.md)                         | backend, admin        | :clipboard: Planned (PR #512 open) |
| 4   | [FEATURE-DEVICE-PLUGIN-ADOPTION-WIZARDS](features/FEATURE-DEVICE-PLUGIN-ADOPTION-WIZARDS.md)         | backend, admin, spec  | :white_check_mark: Done    |
| 5   | [FEATURE-PLUGIN-HOMEY](features/FEATURE-PLUGIN-HOMEY.md)                                             | backend, admin, panel | :white_check_mark: Done    |
| 6   | [FEATURE-SIMULATOR-DEVICE-GENERATION-WIZARD](features/FEATURE-SIMULATOR-DEVICE-GENERATION-WIZARD.md) | admin                 | :white_check_mark: Done    |

**Remaining work:** direct Zigbee integration via zigbee-herdsman, tracked in epic #1322. Open PR #512 holds a first
full implementation (~30k lines) that lands as the epic's smaller sub-issues. The Homey local MVP
is complete for SHS over HTTP; its documented Homey Pro, HTTPS, automatic-discovery, and thermostat-control limitations
remain outside the completed release claim.

---

## 10. Extension Actions & Interactive Sessions (Epic)

> [EPIC-EXTENSION-ACTIONS](epics/EPIC-EXTENSION-ACTIONS.md) — Status: :construction: In Progress

Extensions expose callable actions and interactive terminal sessions from the admin UI. Inspired by HA add-on control panels.

### Phase 1: Immediate Actions (Done)

| #   | Task                                                                       | Scope          | Status                  |
| --- | -------------------------------------------------------------------------- | -------------- | ----------------------- |
| 1   | [FEATURE-EXTENSION-ACTIONS-MVP](features/FEATURE-EXTENSION-ACTIONS-MVP.md) | backend, admin | :white_check_mark: Done |

### Phase 2: Interactive Session Infrastructure

| #   | Task                                                                                     | Scope   | Status              |
| --- | ---------------------------------------------------------------------------------------- | ------- | ------------------- |
| 2   | [FEATURE-INTERACTIVE-SESSION-PROTOCOL](features/FEATURE-INTERACTIVE-SESSION-PROTOCOL.md) | backend | :clipboard: Planned |
| 3   | [FEATURE-INTERACTIVE-SESSION-ADMIN-UI](features/FEATURE-INTERACTIVE-SESSION-ADMIN-UI.md) | admin   | :clipboard: Planned |

### Phase 3: Interactive Session Consumers

| #   | Task                                                                                       | Scope          | Status              |
| --- | ------------------------------------------------------------------------------------------ | -------------- | ------------------- |
| 4   | [FEATURE-INTERACTIVE-SIMULATOR-ACTIONS](features/FEATURE-INTERACTIVE-SIMULATOR-ACTIONS.md) | backend        | :clipboard: Planned |
| 5   | [FEATURE-INTERACTIVE-SYSTEM-UPDATES](features/FEATURE-INTERACTIVE-SYSTEM-UPDATES.md)       | backend, admin | :clipboard: Planned |

### Phase 4: Hardening & Marketplace

| #   | Task                                                                                         | Scope          | Status                  | Notes                                        |
| --- | -------------------------------------------------------------------------------------------- | -------------- | ----------------------- | -------------------------------------------- |
| 6   | [TECH-EXTENSION-ACTION-PERMISSIONS](technical/TECH-EXTENSION-ACTION-PERMISSIONS.md)          | backend        | :white_check_mark: Done |                                              |
| 7   | [TECH-EXTENSION-ACTION-AUDIT-LOG](technical/TECH-EXTENSION-ACTION-AUDIT-LOG.md)              | backend, admin | :white_check_mark: Done | Interactive session recording → #1310    |
| 8   | [FEATURE-EXTENSION-MARKETPLACE-SESSIONS](features/FEATURE-EXTENSION-MARKETPLACE-SESSIONS.md) | backend, admin | :clipboard: Planned     |                                              |

**Done:** Immediate actions, role-based permissions, audit trail with history UI.
**Tracking:** epic #1303 (IS-1 … IS-10).

**Next up:** Interactive session WebSocket protocol, then terminal UI component.

---

## 10a. System Notifications (Epic)

> [EPIC-NOTIFICATIONS-MODULE](archive/EPIC-NOTIFICATIONS-MODULE.md) — Status: :white_check_mark: Done

One place for the admin to see what needs attention — integration failures, service failures, available updates, failed logins, security alerts — with severity, an optional call to action, and a read/dismiss lifecycle, optionally forwarded to Discord, Slack, Telegram or a generic webhook.

### Phase 1: Backend Core

| #   | Task                                                                                         | Scope   | Status              |
| --- | -------------------------------------------------------------------------------------------- | ------- | -------------------- |
| 1   | [FEATURE-NOTIFICATIONS-BACKEND-CORE](archive/FEATURE-NOTIFICATIONS-BACKEND-CORE.md)         | backend | :white_check_mark: Done |
| 2   | [FEATURE-NOTIFICATIONS-BACKEND-API](archive/FEATURE-NOTIFICATIONS-BACKEND-API.md)           | backend | :white_check_mark: Done |
| 3   | [FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH](archive/FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH.md) | backend | :white_check_mark: Done |

### Phase 2: Admin

| #   | Task                                                                                   | Scope | Status              |
| --- | -------------------------------------------------------------------------------------- | ----- | -------------------- |
| 4   | [FEATURE-NOTIFICATIONS-ADMIN-BELL](archive/FEATURE-NOTIFICATIONS-ADMIN-BELL.md)       | admin | :white_check_mark: Done |
| 5   | [FEATURE-NOTIFICATIONS-ADMIN-PAGE](archive/FEATURE-NOTIFICATIONS-ADMIN-PAGE.md)       | admin | :white_check_mark: Done |
| 6   | [FEATURE-NOTIFICATIONS-ADMIN-LOCALES](archive/FEATURE-NOTIFICATIONS-ADMIN-LOCALES.md) | admin | :white_check_mark: Done |

### Phase 3: Emitters

| #   | Task                                                                                                   | Scope   | Status              |
| --- | ------------------------------------------------------------------------------------------------------ | ------- | -------------------- |
| 7   | [FEATURE-NOTIFICATIONS-EMITTERS-CORE](archive/FEATURE-NOTIFICATIONS-EMITTERS-CORE.md)                 | backend | :white_check_mark: Done |
| 8   | [FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS](archive/FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS.md) | backend | :white_check_mark: Done |

### Phase 4: Channels

| #   | Task                                                                                                       | Scope          | Status              |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------- | -------------------- |
| 9   | [FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD](archive/FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD.md) | backend, admin | :white_check_mark: Done |
| 10  | [FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM](archive/FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM.md)   | backend, admin | :white_check_mark: Done |

### Phase 5: Docs & SDK

| #   | Task                                                                         | Scope          | Status              |
| --- | ---------------------------------------------------------------------------- | -------------- | -------------------- |
| 11  | [FEATURE-NOTIFICATIONS-SDK-DOCS](archive/FEATURE-NOTIFICATIONS-SDK-DOCS.md) | backend, admin | :white_check_mark: Done |

**Delivered:** all eleven tasks merged on 2026-09-04 (PRs #921, #920, #922, #927, #929, #932, #935, #939, #943, #938, #940); GitHub epic #885.

---

## 11. Companion Display (Epic)

> [EPIC-COMPANION-DISPLAY](epics/EPIC-COMPANION-DISPLAY.md) — Status: :clipboard: Planned

ESP32-based knob with round LCD as a companion peripheral to the main panel display. Provides tactile rotary control for temperature, brightness, volume, and more.

### Phase 1: Backend Foundation

| #   | Task                                                                             | Scope   | Status              |
| --- | -------------------------------------------------------------------------------- | ------- | ------------------- |
| 1   | [FEATURE-COMPANION-BACKEND-PLUGIN](features/FEATURE-COMPANION-BACKEND-PLUGIN.md) | backend | :clipboard: Planned |
| 2   | [FEATURE-COMPANION-ADMIN-UI](features/FEATURE-COMPANION-ADMIN-UI.md)             | admin   | :clipboard: Planned |

### Phase 2: Firmware Generation & Provisioning

| #   | Task                                                                                   | Scope          | Status              |
| --- | -------------------------------------------------------------------------------------- | -------------- | ------------------- |
| 3   | [FEATURE-COMPANION-SCREEN-COMPILER](features/FEATURE-COMPANION-SCREEN-COMPILER.md)     | backend        | :clipboard: Planned |
| 4   | [FEATURE-COMPANION-ESPHOME-GENERATOR](features/FEATURE-COMPANION-ESPHOME-GENERATOR.md) | backend        | :clipboard: Planned |
| 5   | [FEATURE-COMPANION-PROVISIONING](features/FEATURE-COMPANION-PROVISIONING.md)           | backend, admin | :clipboard: Planned |

### Phase 3: Runtime Communication

| #   | Task                                                                                   | Scope    | Status              |
| --- | -------------------------------------------------------------------------------------- | -------- | ------------------- |
| 6   | [FEATURE-COMPANION-ESPHOME-COMPONENT](features/FEATURE-COMPANION-ESPHOME-COMPONENT.md) | sdk      | :clipboard: Planned |
| 7   | [FEATURE-COMPANION-PANEL-SERIAL](features/FEATURE-COMPANION-PANEL-SERIAL.md)           | panel    | :clipboard: Planned |

### Phase 4: Screen Types & Polish

| #   | Task                                                                         | Scope             | Status              |
| --- | ---------------------------------------------------------------------------- | ----------------- | ------------------- |
| 8   | [FEATURE-COMPANION-SCREEN-TYPES](features/FEATURE-COMPANION-SCREEN-TYPES.md) | sdk, backend      | :clipboard: Planned |
| 9   | [FEATURE-COMPANION-LED-RING](features/FEATURE-COMPANION-LED-RING.md)         | sdk               | :clipboard: Planned |

**Tracking:** epic #1236 (CD-1 … CD-16). The specs predate the managed extension services, the extensions registry and the space/deck panel.

**Next up:** reground the specs on the current architecture (#1237), then the backend plugin.

---

## 12. Device & Infrastructure

> Tasks from real-world device testing sessions — installation, updates, networking, storage resilience.

| #   | Task                                                                                               | Scope                 | Status                  | Notes                                      |
| --- | -------------------------------------------------------------------------------------------------- | --------------------- | ----------------------- | ------------------------------------------ |
| 1   | [FEATURE-INFLUXDB-MEMORY-FALLBACK](features/FEATURE-INFLUXDB-MEMORY-FALLBACK.md)                   | backend, admin        | :white_check_mark: Done |                                            |
| 2   | [FEATURE-IMAGE-UPDATE-MECHANISM](features/FEATURE-IMAGE-UPDATE-MECHANISM.md)                       | backend               | :white_check_mark: Done |                                            |
| 3   | [FEATURE-FLUTTER-PI-MDNS-DISCOVERY-SERVICE](features/FEATURE-FLUTTER-PI-MDNS-DISCOVERY-SERVICE.md) | backend, panel        | :white_check_mark: Done |                                            |
| 4   | [FEATURE-CAPTIVE-PORTAL-WIFI-SETUP](features/FEATURE-CAPTIVE-PORTAL-WIFI-SETUP.md)                 | backend               | :white_check_mark: Done |                                            |
| 5   | [FEATURE-PANEL-APP-UPDATES](features/FEATURE-PANEL-APP-UPDATES.md)                                 | backend, admin, panel | :clipboard: Planned     | Epic #1314                          |
| 6   | [FEATURE-SYSTEM-SERVICE-RESTART](features/FEATURE-SYSTEM-SERVICE-RESTART.md)                       | backend, admin        | :white_check_mark: Done | 8/9 — Raspbian device verification pending |
| 7   | [FEATURE-BACKUP-RESTORE](features/FEATURE-BACKUP-RESTORE.md)                                       | backend, admin        | :construction: In Progress | Shipped in #577, #621; follow-ups #1346 |
| 8   | [FEATURE-PERSONAL-ACCESS-TOKENS](features/FEATURE-PERSONAL-ACCESS-TOKENS.md)                       | backend, admin        | :white_check_mark: Done | #575                                       |

**Done:** Storage module, image updates, mDNS discovery, captive portal, service restart, backup and restore, personal access tokens.
**Remaining:** Panel display app OTA updates (#1314), backup follow-ups (#1346).

---

## 13. Remote Access (Epic)

> [EPIC-REMOTE-ACCESS](epics/EPIC-REMOTE-ACCESS.md) — Status: :construction: In Progress

Reach the installation from outside the LAN through a `remote-access` module and provider plugins (Tailscale first, then Cloudflare Tunnel and a WireGuard client). Design: `docs/superpowers/specs/2026-09-02-remote-access-design.md`. Plan and delegation map: `docs/superpowers/plans/2026-09-02-remote-access.md`. Tasks are tracked as GitHub sub-issues under the "Remote access" milestone.

| #   | Milestone                                                                          | Scope                              | Status              |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------- | ------------------- |
| 1   | Foundation + Tailscale MVP (RA-1 … RA-12): RA-1 … RA-11 merged, completion packages R1 … R3 (#1156, #1157, #1158) merged; RA-12 hardware gate #910 open | backend, admin, installer, website | :construction: In Progress |
| 2   | Cloudflare Tunnel plugin (RA-13, RA-14): code merged (#911, #912); lifecycle and hardware gate #1159 open | backend, admin                     | :construction: In Progress |
| 3   | WireGuard client plugin (#913) and fixed privileged helper (#914)                  | backend, admin, installer          | :clipboard: Planned |

**Next up:** completion plan `docs/superpowers/plans/2026-10-03-remote-access-completion.md` — R4 #910 (Tailscale hardware acceptance), R5 #1159 (Cloudflare), R6 #914, R7 #913, R8 #1354 (docs reconciliation).

---

## 13a. UniFi Protect & Camera Live View (Epic)

> [EPIC-UNIFI-PROTECT](epics/EPIC-UNIFI-PROTECT.md) — Status: :clipboard: Planned — GitHub #1175, milestone "UniFi Protect"

Adopt UniFi Protect cameras, doorbells, UP-Sense sensors and floodlights through the public Integration API, feed their detections into the security module, and show live video and snapshots in the admin and on the panel. Adds a reusable core `cameras` module with a go2rtc relay. Design: `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md`. Tasks UP-0 … UP-21 are tracked as GitHub sub-issues of #1175.

| #   | Milestone                                                                            | Scope                   | Status              |
| --- | ------------------------------------------------------------------------------------ | ----------------------- | ------------------- |
| 0   | Spike and spec extensions (UP-0, UP-1)                                               | backend, spec, cross    | :clipboard: Planned |
| 1   | Camera streaming core: cameras module, go2rtc relay, installer (UP-2 … UP-4)         | backend, installer      | :clipboard: Planned |
| 2   | Plugin backend: client, discovery, adoption, sync, control, streams (UP-5 … UP-10)   | backend                 | :clipboard: Planned |
| 3   | Admin live view and plugin wizard (UP-11, UP-12)                                     | admin                   | :clipboard: Planned |
| 4   | Panel snapshots and doorbell overlay (UP-13, UP-14); post-MVP live video (UP-15)     | panel, installer        | :clipboard: Planned |
| 5   | Per-type security rules, person detection as occupancy, optional alarm manager and full-access mode (UP-16 … UP-18, UP-21) | backend | :clipboard: Planned |
| 6   | Docs and hardware acceptance (UP-19, UP-20)                                          | website, docs           | :clipboard: Planned |

**Next up:** all design decisions are confirmed (2026-10-06); start UP-0 (spike on a real console, Pi 4 and Pi 5) and UP-1 (spec extensions) in parallel.

---

## 13b. Matter (Epic)

> [EPIC-MATTER](epics/EPIC-MATTER.md) — Status: :clipboard: Planned — GitHub #1191, milestone "Matter"

Expose Smart Panel devices to Apple Home, Google Home, Alexa, SmartThings and Home Assistant as a Matter bridge, then
commission Matter devices (e.g. IKEA Matter bulbs) into Smart Panel as a Matter controller — one `devices-matter`
plugin on matter.js. Analysis and design: `docs/superpowers/specs/2026-10-06-matter-integration-design.md`. Tasks are
tracked as GitHub sub-issues of #1191 (MT-1 … MT-20). Supersedes FEATURE-PLUGIN-MATTER.

| #   | Milestone                                                                                         | Scope                              | Status              |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------- |
| 0   | Compatibility spike and ADR (MT-1)                                                                | backend                            | :clipboard: Planned |
| 1   | Bridge MVP (MT-2 … MT-8): runtime, lights/plugs/sensors, admin wizard, networking, docs, acceptance | backend, admin, installer, website | :clipboard: Planned |
| 2   | Bridge coverage (MT-9 … MT-12): climate, covers, locks, fans, buttons, energy, vacuums, scenes    | backend, admin                     | :clipboard: Planned |
| 3   | Controller (MT-13 … MT-19): spec, platform, mapping, wizard, Thread routes, docs, IKEA acceptance  | backend, admin, installer, spec, website | :clipboard: Planned |
| 4   | Optional BLE commissioning of new Wi-Fi devices (MT-20)                                           | backend, installer                 | :clipboard: Planned |

**Next up:** MT-1, the compatibility spike; no production Matter code before its ADR is merged.

---

## 14. Technical Debt

| #   | Task                                                                                  | Scope          | Status                  |
| --- | ------------------------------------------------------------------------------------- | -------------- | ----------------------- |
| 1   | [TECH-ADMIN-MODULE-CONFIG-TESTS](technical/TECH-ADMIN-MODULE-CONFIG-TESTS.md)         | admin          | :white_check_mark: Done |
| 2   | [TECH-ELIMINATE-FORWARD-REF](technical/TECH-ELIMINATE-FORWARD-REF.md)                 | backend        | :white_check_mark: Done |
| 3   | [TECH-EXTENSIONS-CAN-REMOVE-OPENAPI](technical/TECH-EXTENSIONS-CAN-REMOVE-OPENAPI.md) | backend, admin | :white_check_mark: Done |
| 4   | [TECH-ONBOARDING-ROUTER-GUARDS](technical/TECH-ONBOARDING-ROUTER-GUARDS.md)           | admin          | :white_check_mark: Done |
| 5   | [TECH-PROPERTY-TIMESERIES-E2E](technical/TECH-PROPERTY-TIMESERIES-E2E.md)             | backend        | :white_check_mark: Done |
| 6   | [TECH-ADMIN-UNIFY-NUMBER-FORMATTING](technical/TECH-ADMIN-UNIFY-NUMBER-FORMATTING.md) | admin          | :white_check_mark: Done |
| 7   | [TECH-ADMIN-TS-STRICT-ENUMS](technical/TECH-ADMIN-TS-STRICT-ENUMS.md)                 | admin          | :white_check_mark: Done |
| 8   | [TECH-MCP-OAUTH-AUTHORIZATION](technical/TECH-MCP-OAUTH-AUTHORIZATION.md)             | backend, admin | :white_check_mark: Done |
| 9   | [TECH-SHELLY-NG-CONNECTION-HARDENING](technical/TECH-SHELLY-NG-CONNECTION-HARDENING.md) | backend      | :white_check_mark: Done |
| 10  | [TECH-STORAGE-MANAGED-SERVICES](technical/TECH-STORAGE-MANAGED-SERVICES.md)           | backend        | :white_check_mark: Done |
| 11  | [tech-admin-store-refresh-contract](technical/tech-admin-store-refresh-contract.md)   | admin          | :white_check_mark: Done |
| 12  | [tech-backend-ws-handshake-auth](technical/tech-backend-ws-handshake-auth.md)         | backend        | :white_check_mark: Done |
| 13  | [bug-admin-socket-wake-recovery](bugs/bug-admin-socket-wake-recovery.md)              | admin          | :white_check_mark: Done |
| 14  | [bug-backend-unauthorized-ws-client-admitted](bugs/bug-backend-unauthorized-ws-client-admitted.md) | backend | :white_check_mark: Done |
| 15  | [chore-dependabot-security-updates](chores/chore-dependabot-security-updates.md)      | cross          | :white_check_mark: Done |
| 16  | [TECH-SECURITY-HARDENING-PHASE2](technical/TECH-SECURITY-HARDENING-PHASE2.md)         | backend, admin, installer | :construction: In Progress |

**Remaining:** security hardening phase 2 (#1330); Dependabot advisories raised since July (#1353).

---

## 15. Other Planned Features

| #   | Task                                                                                 | Scope                 | Status                  |
| --- | ------------------------------------------------------------------------------------ | --------------------- | ----------------------- |
| 1   | [FEATURE-APP-UPDATES](features/FEATURE-APP-UPDATES.md)                               | backend, admin, panel | :white_check_mark: Done |
| 2   | [FEATURE-EXTENSION-LOGS-FILTERS](features/FEATURE-EXTENSION-LOGS-FILTERS.md)         | admin                 | :white_check_mark: Done |
| 3   | [FEATURE-LINUX-INSTALL-ENHANCEMENTS](features/FEATURE-LINUX-INSTALL-ENHANCEMENTS.md) | backend               | :white_check_mark: Done |
| 4   | [FEATURE-PANEL-SENSOR-DEVICE-PAGE](features/FEATURE-PANEL-SENSOR-DEVICE-PAGE.md)     | panel                 | :white_check_mark: Done |
| 5   | [FEATURE-WEATHER-PANEL-ENHANCEMENTS](features/FEATURE-WEATHER-PANEL-ENHANCEMENTS.md) | panel                 | :white_check_mark: Done |

---

## 16. Plans

| #   | Plan                                                                                    | Status                  |
| --- | --------------------------------------------------------------------------------------- | ----------------------- |
| 1   | [plan-epic-intents-backend](plans/plan-epic-intents-backend.md)                         | :white_check_mark: Done |
| 2   | [plan-extend-extensions-module-actions](plans/plan-extend-extensions-module-actions.md) | :white_check_mark: Done |
| 3   | [plan-pre-release-docs-update](plans/plan-pre-release-docs-update.md)                   | :white_check_mark: Done |
| 4   | [plan-mcp-module](plans/plan-mcp-module.md)                                             | :white_check_mark: Done |
| 5   | [plan-mcp-oauth-authorization](plans/plan-mcp-oauth-authorization.md)                   | :white_check_mark: Done |
| 6   | [plan-dev-testing-app](plans/plan-dev-testing-app.md)                                   | :white_check_mark: Done |
| 7   | [plan-property-actions-and-updater-recovery](plans/plan-property-actions-and-updater-recovery.md) | :white_check_mark: Done |
| 8   | [plan-spaces-plugin-system-signage](plans/plan-spaces-plugin-system-signage.md)         | :construction: In Progress |
| 9   | [plan-buddy-adaptive-context](plans/plan-buddy-adaptive-context.md)                     | :construction: In Progress |

---

## Summary

| Category                         | Done   | In Progress | Planned | Total   |
| -------------------------------- | ------ | ----------- | ------- | ------- |
| Energy                           | 9      | 0           | 0       | 9       |
| Media                            | 8      | 0           | 0       | 8       |
| Domains Epic                     | 2      | 0           | 7       | 9       |
| Buddy Epic (voice, channels)     | 9      | 0           | 0       | 9       |
| AI Buddy Face                    | 0      | 0           | 2       | 2       |
| Buddy Hardening                  | 7      | 0           | 1       | 8       |
| Onboarding Epic                  | 3      | 0           | 0       | 3       |
| Onboarding Device Setup          | 3      | 0           | 0       | 3       |
| Space/Climate                    | 1      | 0           | 0       | 1       |
| Security                         | 1      | 0           | 0       | 1       |
| Virtual Devices                  | 2      | 1           | 0       | 3       |
| Plugins                          | 4      | 0           | 1       | 5       |
| Extension Actions                | 3      | 0           | 5       | 8       |
| System Notifications             | 11     | 0           | 0       | 11      |
| Companion Display                | 0      | 0           | 9       | 9       |
| Device & Infrastructure          | 6      | 1           | 1       | 8       |
| Technical, bugs, chores          | 15     | 1           | 0       | 16      |
| Other Features                   | 5      | 0           | 0       | 5       |
| Plans                            | 7      | 2           | 0       | 9       |
| Remote Access (milestones)       | 0      | 2           | 1       | 3       |
| UniFi Protect (milestones)       | 0      | 0           | 7       | 7       |
| Matter Epic (milestones)         | 0      | 0           | 5       | 5       |
| **Total**                        | **96** | **7**       | **39**  | **142** |

The Remote access, UniFi Protect and Matter epics are counted per milestone row; superseded tasks are not counted.
