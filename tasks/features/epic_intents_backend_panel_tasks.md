# Task: Backend intent orchestration (core module) + UI anti-jitter integration
ID: EPIC-INTENTS-ORCHESTRATION
Type: feature
Scope: backend, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to provide stable, predictable real-time UI control for rooms/roles/scenes across multiple clients,
As a Smart Panel user (and admin),
I want the system to treat user actions as short-lived *intents* that are coordinated by the backend and broadcast to all UIs, preventing state jitter and enabling partial-failure visibility.

## 2. Context

- Current pain point: device state updates can arrive out-of-order (or fail), causing UI “jumping” (e.g., slider goes 50 → 20 → 50).
- Panel app is now refactored into **modules + plugins**; backend/admin also follow modular architecture.
- Commands are sent from UI → backend → platform (HA/Shelly/…); state updates can arrive asynchronously.
- Scenes module exists and executes multiple device commands.
- Display “system pages” (lighting/climate/…) require smooth UX; no legacy behavior or feature flags allowed.
- Persistence is NOT required: intents are short-lived and can be stored in-memory.

## 3. Scope

**In scope**

- New NestJS **core module**: `IntentsModule` with in-memory registry + TTL cleanup.
- Backend Socket.IO events for intent lifecycle: `intent.created`, `intent.completed`, `intent.expired`.
- Integrate intents into:
  - device commands (single device and role/group operations)
  - scenes execution (fan-out to device commands)
- Panel app: consume intent events and apply **optimistic overlay** to prevent jitter:
  - while an intent is active, ignore conflicting device-state updates for impacted targets/properties
  - show partial failure indicators at device level where feasible

**Out of scope**

- Persisting intents (DB/Influx) or audit logging.
- Multi-backend-instance coordination (Redis, etc.).
- Full admin app overlay integration (optional future task).
- Complex automation rules / scheduling.

## 4. Acceptance criteria

- [ ] Backend provides `IntentsModule` with in-memory intent registry, TTL expiration, and cleanup loop.
- [ ] Backend emits Socket.IO intent lifecycle events to all clients.
- [ ] Device command endpoints/services create intents and complete them with per-device results (success/failed/timeout/skipped).
- [ ] Scene execution creates a single scene intent and completes it with aggregated per-device results.
- [ ] Panel app applies intent overlay so UI controls do not “jump” due to out-of-order state updates while intent is active.
- [ ] Intents expire automatically (default TTL) and the UI returns to device-state-driven behavior.
- [ ] Unit tests exist for backend intent registry + TTL and for panel overlay conflict rules.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Prevent slider jitter during delayed updates
Given a room role with 2 lights and the user sets brightness to 50%  
When device A accepts and reports 50%  
And device B fails and reports 20%  
Then the UI remains at 50% while the intent is active  
And the UI shows “not synced” for device B in the role detail list  
And when the intent expires, real device state may be shown again if still divergent  

### Scenario: Scene run with partial failures
Given a scene that targets 3 devices  
When the scene is executed  
And 2 succeed, 1 times out  
Then the backend emits `intent.completed` with status `partial`  
And the UI indicates partial completion without resetting the user’s chosen target state immediately  

## 6. Technical constraints

- Follow existing module/service structure (NestJS modules; panel modules + plugins).
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.
- No legacy or feature flags; remove/avoid fallback behaviors.

## 7. Implementation hints (optional)

- Use `Map<string, IntentRecord>` in backend with `setInterval` cleanup.
- Model intent status as: `pending`, `completed_success`, `completed_partial`, `completed_failed`, `expired`.
- Keep TTL short: 3000ms for sliders, 5000ms for scenes (configurable).
- Panel overlay should prioritize intent over state updates for impacted property keys, but still allow unrelated updates.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Implement backend IntentsModule (in-memory registry + TTL)
ID: TECH-BE-INTENTS-MODULE
Type: technical
Scope: backend
Size: medium
Parent: EPIC-INTENTS-ORCHESTRATION
Status: planned

## 1. Business goal

In order to coordinate user actions as first-class intents,
As the backend,
I want a core IntentsModule that can create, track, expire, and complete intents in memory.

## 2. Context

- Intents are short-lived overlays (seconds), not long-term records.
- Backend already uses Socket.IO for real-time updates (per project architecture).

## 3. Scope

**In scope**

- `IntentsModule` + `IntentsService`:
  - `createIntent(input) -> IntentRecord`
  - `completeIntent(intentId, results, status)`
  - `expireIntent(intentId)`
  - `getIntent(intentId)`
  - `findActiveIntents(query)` (by deviceId/roomId/sceneId)
- TTL handling:
  - default TTL per intent type (slider vs scene)
  - periodic cleanup loop
- Minimal config options (e.g., via existing configuration patterns)

**Out of scope**

- Persistence and audit trails.

## 4. Acceptance criteria

- [ ] Intents are stored in-memory with TTL.
- [ ] Cleanup loop expires intents and triggers completion with status `expired`.
- [ ] Completing an intent stops expiration and marks final status.
- [ ] Unit tests cover create/expire/complete flows and TTL behavior.

## 6. Technical constraints

- No new dependencies unless unavoidable.
- Tests required.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Broadcast intent lifecycle over Socket.IO
ID: TECH-BE-INTENTS-SOCKET-EVENTS
Type: technical
Scope: backend
Size: small
Parent: EPIC-INTENTS-ORCHESTRATION
Status: planned

## 1. Business goal

In order for all clients to apply consistent UI overlays,
As the backend,
I want to broadcast intent lifecycle events over Socket.IO.

## 3. Scope

**In scope**

- Define Socket.IO events:
  - `intent.created`
  - `intent.completed`
  - `intent.expired`
- Define shared payload shape:
  - `intentId`, `type`, `scope`, `targets`, `value`, `status`, `ttlMs`, timestamps
  - `results[]` on completed
- Wire events to IntentsService actions.

**Out of scope**

- Admin UI changes (consumption) in this task.

## 4. Acceptance criteria

- [ ] When an intent is created, `intent.created` is emitted to all connected clients.
- [ ] When completed, `intent.completed` includes per-target results.
- [ ] When expired, `intent.expired` is emitted and includes intentId + final status `expired`.
- [ ] Tests verify gateway emits expected events (unit tests with mocked gateway).

## 6. Technical constraints

- Reuse existing Socket.IO gateway patterns.
- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Integrate intents into device command execution
ID: FEATURE-BE-DEVICES-INTENTS-INTEGRATION
Type: feature
Scope: backend
Size: large
Parent: EPIC-INTENTS-ORCHESTRATION
Status: planned

## 1. Business goal

In order to prevent UI jitter and provide partial-failure visibility for device controls,
As the backend,
I want device command execution to be wrapped in intents and return per-target results.

## 2. Context

- Devices module sends commands to integrations; responses may be async or fail.
- Device state updates can arrive before/after command completion.

## 3. Scope

**In scope**

- For relevant command entry points (toggle, setBrightness, setColorTemp, setColor, setWhite if supported):
  - Create an intent with:
    - `type` (e.g., `light.setBrightness`)
    - `value` (e.g., brightness 50)
    - `targets` (deviceIds)
    - `scope` (roomId/role where available; optional)
  - Execute commands per device with timeout handling
  - Collect results per device: success/failed/timeout/skipped
  - Complete intent with overall status: success/partial/failed
- Ensure failures do not crash request handlers.

**Out of scope**

- Persisting results.
- Advanced retry logic (single attempt is fine for MVP).

## 4. Acceptance criteria

- [ ] Backend creates intents for lighting role actions (bulk) and single device actions.
- [ ] Per-device results are captured and included in `intent.completed`.
- [ ] Overall intent status is computed correctly (all success -> success; mix -> partial; all fail -> failed).
- [ ] Timeouts produce `timeout` result for the device and still complete the intent.
- [ ] Unit tests cover success, partial failure, and timeout cases.

## 6. Technical constraints

- Reuse existing device command services.
- No new dependencies unless unavoidable.
- Add tests.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Integrate intents into scene execution
ID: FEATURE-BE-SCENES-INTENTS-INTEGRATION
Type: feature
Scope: backend
Size: medium
Parent: EPIC-INTENTS-ORCHESTRATION
Status: planned

## 1. Business goal

In order to provide consistent UI behavior and partial success reporting for scenes,
As a user,
I want scene execution to emit a single intent lifecycle with aggregated per-device results.

## 2. Context

- Scenes fan out into multiple device commands.
- Scenes should behave similarly to manual group controls.

## 3. Scope

**In scope**

- When a scene is executed:
  - Create a `scene.run` intent with `sceneId`, optional `roomId`, and target deviceIds.
  - Execute all scene actions.
  - Collect per-device results and complete intent accordingly.
- Emit intent events via Socket.IO.

**Out of scope**

- Advanced conditions/automations.
- Scene scheduling.

## 4. Acceptance criteria

- [ ] Executing a scene emits `intent.created` and later `intent.completed`.
- [ ] `intent.completed` contains per-device results and overall status.
- [ ] Scene intent TTL defaults to 5000ms unless completed earlier.
- [ ] Unit tests cover partial scene completion.

## 6. Technical constraints

- Reuse existing scenes execution pathway.
- No new dependencies.
- Add tests.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Panel intent overlay store (anti-jitter)
ID: FEATURE-PANEL-INTENT-OVERLAY-STORE
Type: feature
Scope: panel
Size: medium
Parent: EPIC-INTENTS-ORCHESTRATION
Status: planned

## 1. Business goal

In order to keep UI stable during asynchronous device state updates,
As a panel user,
I want the panel to apply an intent overlay that prevents controls from “jumping” while an intent is active.

## 2. Context

- Panel receives real-time property updates.
- Lighting role detail uses sliders (brightness/color/temp) where jitter is most visible.
- Backend will broadcast intent lifecycle events.

## 3. Scope

**In scope**

- Add `IntentOverlayStore` (or equivalent) that:
  - subscribes to Socket.IO intent events
  - tracks active intents by impacted targets and property keys
  - provides queries to UI/viewmodels:
    - `isLocked(targetId, key)`
    - `getOverlayValue(targetId, key)`
    - `getIntentForTarget(targetId)`
- Conflict rule:
  - while intent active for a given property key, ignore device updates for that key in UI rendering
  - allow unrelated properties to update
- TTL:
  - remove overlay on `intent.completed` or `intent.expired`

**Out of scope**

- Persisting overlay or cross-device “true reconciliation”.

## 4. Acceptance criteria

- [ ] When an intent is active, relevant sliders/toggles do not jump due to state updates.
- [ ] On `intent.completed`/`expired`, UI resumes normal state-driven behavior.
- [ ] Overlay supports bulk operations (multiple device targets).
- [ ] Unit tests cover conflict rules and expiry.

## 6. Technical constraints

- Reuse existing panel socket client patterns.
- No new dependencies.
- Add tests.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Panel UI integration for lighting role detail (use backend intents)
ID: FEATURE-PANEL-LIGHTING-ROLE-DETAIL-INTENTS
Type: feature
Scope: panel
Size: medium
Parent: EPIC-INTENTS-ORCHESTRATION
Status: planned

## 1. Business goal

In order to deliver a HomeKit-like smooth control experience,
As a panel user,
I want lighting role detail sliders and actions to be driven by backend intents and show partial failure state per device.

## 2. Context

- Lighting role detail contains group controls and per-device list.
- Devices may diverge; group control is intent-driven.

## 3. Scope

**In scope**

- On slider interaction (brightness/color/temp/white if supported):
  - send command request as intent-driven action (backend creates intent and broadcasts)
  - apply overlay immediately (optimistic) until backend intent arrives
- On `intent.completed`:
  - mark per-device “not synced” for failed/timeout devices (in role detail list)
  - do not revert slider value immediately
- On `intent.expired`:
  - clear overlay; allow state to show divergence again

**Out of scope**

- Automatic retries.
- Complex per-device reconciliation.

## 4. Acceptance criteria

- [ ] Slider interactions do not cause UI jitter even with out-of-order device updates.
- [ ] Partial failures are visible on device list items (badge/icon).
- [ ] Successful completion clears overlay cleanly.
- [ ] Expiration clears overlay and restores state-driven rendering.

## 6. Technical constraints

- Reuse existing lighting domain plugin architecture.
- No new dependencies.
- Add tests where applicable.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
