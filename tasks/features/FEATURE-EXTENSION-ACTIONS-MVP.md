# Task: Extension Actions MVP — Immediate Actions with Flat Forms

ID: FEATURE-EXTENSION-ACTIONS-MVP
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-EXTENSION-ACTIONS
Status: done

## 1. Business goal

In order to access extension functionality without using the CLI,
As a Smart Panel administrator,
I want extensions to expose callable actions with parameter forms that I can trigger from the admin web interface.

## 2. Context

Extensions like the Devices Simulator have powerful CLI commands that are inaccessible from the admin UI. This task creates the foundation: a REST-based action system where extensions register actions with typed parameters, and the admin UI renders appropriate forms and executes them.

**Key design decisions:**
- **Flat forms** — All parameters presented upfront (no multi-step wizards)
- **Dynamic options** — SELECT parameters can resolve options at fetch time via `resolveOptions()` callback
- **Mode field** — Each action declares `mode: 'immediate' | 'interactive'`, preparing for future WebSocket sessions
- **Dangerous flag** — Actions marked `dangerous` trigger a confirmation dialog

**Implemented files:**

Backend:
- `apps/backend/src/modules/extensions/services/extension-action.interface.ts` — Core interfaces
- `apps/backend/src/modules/extensions/services/extension-action-registry.service.ts` — Central registry
- `apps/backend/src/modules/extensions/controllers/actions.controller.ts` — REST API
- `apps/backend/src/modules/extensions/models/action.model.ts` — Swagger models
- `apps/backend/src/modules/extensions/models/actions-response.model.ts` — Response wrappers
- `apps/backend/src/modules/extensions/dto/execute-action.dto.ts` — Request DTO
- `apps/backend/src/plugins/simulator/services/simulator-actions.service.ts` — Simulator actions

Admin:
- `apps/admin/src/modules/extensions/composables/useActions.ts` — API composable
- `apps/admin/src/modules/extensions/components/extension-actions.vue` — Actions UI
- `apps/admin/src/modules/extensions/views/view-extension-detail.vue` — Actions tab added

SDK:
- `packages/extension-sdk/src/action.types.ts` — Exported action types

## 3. Scope

**In scope**

- Backend action interface with immediate/interactive mode distinction
- Action registry service with dynamic option resolution
- REST endpoints for listing and executing actions
- Simulator plugin registers 6 actions
- Admin UI with dynamic form rendering per parameter type
- Actions tab on extension detail page
- Extension SDK type exports

**Out of scope**

- Interactive/WebSocket sessions (mode=interactive shown as disabled)
- Action permissions beyond existing admin role check
- Action execution history/audit log
- Custom Vue panels from extensions

## 4. Acceptance criteria

- [x] `IExtensionAction` interface supports immediate and interactive modes
- [x] `ExtensionActionRegistryService` registers, lists, and executes actions
- [x] `GET /extensions/:type/actions` returns action descriptors with resolved dynamic options
- [x] `POST /extensions/:type/actions/:actionId` executes immediate actions
- [x] Simulator plugin registers: Load Scenario, Generate Device, Simulate All, Start/Stop Auto-Sim, Set Connection State
- [x] Load Scenario action has dynamic dropdown from `ScenarioLoaderService.getAvailableScenarios()`
- [x] Admin UI renders string, number, boolean, select, multi_select parameter types
- [x] Dangerous actions show confirmation dialog
- [x] Actions tab appears on extension detail page when actions exist
- [x] Extension SDK exports action types for third-party extensions
- [x] All Swagger models properly documented

## 5. Technical constraints

- Follow existing controller/service/model patterns in extensions module
- Use `@Global()` module export for `ExtensionActionRegistryService`
- Dynamic options resolved at fetch time, not registration time
- Admin uses raw API calls (paths not yet in generated OpenAPI types)
- No new npm dependencies
