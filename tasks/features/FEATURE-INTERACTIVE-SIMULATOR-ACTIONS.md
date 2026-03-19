# Task: Simulator Complex Operations as Interactive Sessions

ID: FEATURE-INTERACTIVE-SIMULATOR-ACTIONS
Type: feature
Scope: backend
Size: small
Parent: EPIC-EXTENSION-ACTIONS
Status: planned

## 1. Business goal

In order to have the full CLI experience for complex simulator operations in the admin UI,
As a Smart Panel administrator,
I want the simulator's scenario loading and batch operations to use interactive sessions with preview, confirmation, and progress streaming.

## 2. Context

Phase 1 (FEATURE-EXTENSION-ACTIONS-MVP) registered simulator actions as immediate (flat form). Some operations benefit from richer interaction:

- **Load Scenario**: Show preview of rooms/devices/scenes to be created → confirm → stream creation progress
- **Batch simulation**: Show device list → select devices → stream simulation progress per device

The interactive session protocol (FEATURE-INTERACTIVE-SESSION-PROTOCOL) and terminal UI (FEATURE-INTERACTIVE-SESSION-ADMIN-UI) must be completed first.

**Existing code:**
- `apps/backend/src/plugins/simulator/services/simulator-actions.service.ts` — Current immediate actions
- `apps/backend/src/plugins/simulator/commands/scenario.command.ts` — CLI flow to replicate
- `apps/backend/src/plugins/simulator/services/scenario-executor.service.ts` — Has `preview()` method

## 3. Scope

**In scope**

- Register interactive session handlers for:
  - `load-scenario-interactive` — Scenario selection → preview → options → execution with progress
  - `batch-simulate-interactive` — Device multi-select → simulation with per-device progress
  - `batch-populate-interactive` — Device multi-select → value population with progress
- Use `ScenarioExecutorService.preview()` to show what will be created before confirming
- Stream per-device progress during batch operations
- Keep existing immediate actions as-is (users can choose simple or interactive mode)

**Out of scope**

- Replacing immediate actions (both modes coexist)
- New scenario operations (only wrapping existing functionality)
- Interactive device generation wizard

## 4. Acceptance criteria

- [ ] `load-scenario-interactive` handler: sends scenario list prompt → shows preview (rooms, devices, scenes counts) → sends options prompts (truncate, rooms, scenes, roles) → streams creation progress → reports result
- [ ] `batch-simulate-interactive` handler: sends device multi-select prompt → streams per-device simulation progress → reports total
- [ ] `batch-populate-interactive` handler: sends device multi-select prompt → streams per-device population progress → reports total
- [ ] Existing immediate actions remain functional and unchanged
- [ ] Interactive handlers properly use `ISessionContext` for prompts and progress
- [ ] Error in one device doesn't stop batch operation (reports partial success)

## 5. Technical constraints

- Depends on FEATURE-INTERACTIVE-SESSION-PROTOCOL being implemented first
- Must implement `IInteractiveSessionHandler` interface
- Reuse existing services (ScenarioLoaderService, ScenarioExecutorService, SimulationService)
- Do not duplicate business logic from services — only orchestrate via session

## 6. AI instructions

- Read this file entirely before making any code changes
- Implement FEATURE-INTERACTIVE-SESSION-PROTOCOL and FEATURE-INTERACTIVE-SESSION-ADMIN-UI first
- Study the CLI commands for the exact conversation flow to replicate
- Keep handlers thin — delegate to existing services
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
