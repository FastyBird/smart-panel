# Epic: Extension Actions & Interactive Sessions

ID: EPIC-EXTENSION-ACTIONS
Type: epic
Scope: backend, admin
Size: large
Parent: (none)
Status: in-progress

## 1. Business goal

In order to make extension functionality accessible beyond the CLI,
As a Smart Panel administrator,
I want extensions to expose callable actions and interactive sessions that I can trigger from the admin UI, with proper parameter forms, progress feedback, and terminal-like interaction for complex operations.

## 2. Context

Currently, extensions like the Devices Simulator have powerful CLI commands (load scenarios, generate devices, simulate values, manage connections) that are only accessible via terminal. This limits usability for non-technical users and remote administration.

**Inspiration:** Home Assistant add-on control panels — add-ons can expose configuration, controls, and even full web panels through the HA UI.

**Existing code:**
- `apps/backend/src/modules/extensions/` — Extensions module with service lifecycle, discovery, metadata
- `apps/backend/src/plugins/simulator/` — Simulator plugin with 5 CLI commands
- `apps/admin/src/modules/extensions/` — Admin extensions module with detail view, logs, config
- `apps/backend/src/modules/websocket/` — WebSocket gateway for real-time events
- `packages/extension-sdk/` — SDK for third-party extensions

**Two complementary systems:**
1. **Immediate Actions (Phase 1)** — REST-based, flat form → execute → result. Done.
2. **Interactive Sessions (Phase 2+)** — WebSocket-based terminal sessions for multi-step flows, progress streaming, and conversational interaction.

The interactive session system is a **platform feature** reusable across:
- Simulator: complex scenario loading with preview/confirmation
- System module: app updates with progress
- Future marketplace: plugin install/uninstall with dependency resolution
- Database migrations with step-by-step feedback

## 3. Scope

**In scope**

- Extension action registration and execution framework
- Dynamic parameter resolution (options fetched at runtime)
- Admin UI for discovering, configuring, and executing actions
- WebSocket-based interactive session protocol
- Terminal-like UI component for interactive sessions
- Simulator plugin as first consumer of both systems

**Out of scope**

- Custom Vue panels loaded from extensions (separate feature)
- Action scheduling/cron (future enhancement)
- External webhook triggers for actions (future enhancement)
- Multi-user concurrent session management

## 4. Acceptance criteria

- [x] Extensions can register immediate actions with typed parameters
- [x] Admin UI renders dynamic forms and executes actions via REST
- [x] Simulator plugin exposes 6 actions (scenario, generate, simulate, auto-sim, connection state)
- [x] Dynamic parameter options resolved at fetch time (e.g., scenario list)
- [x] Dangerous actions require confirmation dialog
- [x] Extension SDK exports action types for third-party extensions
- [ ] Interactive session protocol defined and documented
- [ ] WebSocket session gateway implemented
- [ ] Terminal UI component renders prompts, collects input, shows progress
- [ ] Simulator complex operations use interactive sessions
- [ ] System module app updates use interactive sessions
- [ ] Session history/audit log for executed operations
- [ ] Action permissions based on user roles

## 5. Child tasks

### Phase 1: Immediate Actions (Done)

| ID | Title | Scope | Size | Status |
|----|-------|-------|------|--------|
| FEATURE-EXTENSION-ACTIONS-MVP | Extension actions with flat forms | backend, admin | medium | done |

### Phase 2: Interactive Session Infrastructure

| ID | Title | Scope | Size | Status |
|----|-------|-------|------|--------|
| FEATURE-INTERACTIVE-SESSION-PROTOCOL | WebSocket session protocol & gateway | backend | medium | planned |
| FEATURE-INTERACTIVE-SESSION-ADMIN-UI | Terminal UI component for sessions | admin | medium | planned |

### Phase 3: Interactive Session Consumers

| ID | Title | Scope | Size | Status |
|----|-------|-------|------|--------|
| FEATURE-INTERACTIVE-SIMULATOR-ACTIONS | Simulator complex operations as sessions | backend | small | planned |
| FEATURE-INTERACTIVE-SYSTEM-UPDATES | System updates via interactive sessions | backend, admin | medium | planned |

### Phase 4: Hardening & Polish

| ID | Title | Scope | Size | Status |
|----|-------|-------|------|--------|
| TECH-EXTENSION-ACTION-PERMISSIONS | Role-based action access control | backend | small | planned |
| TECH-EXTENSION-ACTION-AUDIT-LOG | Action execution history and audit trail | backend, admin | small | planned |
| FEATURE-EXTENSION-MARKETPLACE-SESSIONS | Marketplace install/uninstall via sessions | backend, admin | large | planned |

## 6. Technical constraints

- Follow existing module/service patterns
- WebSocket sessions must use the existing gateway infrastructure
- Session protocol must be stateless on the client side (reconnectable)
- Interactive session actions must gracefully degrade if WebSocket is unavailable
- Do not modify generated OpenAPI code
- Tests required for session protocol and gateway

## 7. AI instructions

- Read this file and all child task files before implementation
- Implement phases in order: Phase 2 → Phase 3 → Phase 4
- Phase 1 is already done (FEATURE-EXTENSION-ACTIONS-MVP)
- Start each task by replying with implementation plan
- Follow patterns from existing WebSocket module
- Keep changes scoped to each task
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
