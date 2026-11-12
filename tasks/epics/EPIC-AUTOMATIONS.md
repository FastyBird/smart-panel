# Task: Automations with a visual flow editor

This epic is tracked in the GitHub milestone "Automations" (epic #1555).

ID: EPIC-AUTOMATIONS
Type: epic
Scope: backend, admin, panel, sdk, website, docs
Size: large
Parent: (none)
Status: planned
Created: 2026-11-10
GitHub: #1555

## 1. Business goal

In order to have my home react on its own to presence, light, time, temperature and alarms,
As an administrator of a Smart Panel installation,
I want to draw automations on a canvas by placing When / And / Then blocks and wiring them, the way Homey Advanced
Flow does, and have the Smart Panel backend run them.

## 2. Context

- Analysis and design: [`docs/superpowers/specs/2026-11-10-automations-design.md`](../../docs/superpowers/specs/2026-11-10-automations-design.md).
  It records what exists today, the prior art, the product decisions, the graph model, trigger and run semantics,
  the canvas library comparison and the delivery phases. Decisions confirmed on 2026-11-10: JSON for the stored
  graph and API with YAML for templates and import/export, and server-side enforcement of the safety restriction on
  every action path. The remaining decisions were settled by the AU-0 spike and are recorded in
  [`docs/adr/0003-automations-spike-and-decisions.md`](../../docs/adr/0003-automations-spike-and-decisions.md),
  which the implementing issues must follow. The spike code is kept in `docs/work/automations-spike/`.
- No automation engine exists today. Scenes are action lists run on demand; space mode schedules and occupancy
  (`plugins/spaces-home-control`) are fixed-purpose and stay as they are. Automations use them as actions,
  triggers and conditions.
- Reference implementations: `apps/backend/src/modules/scenes` + `plugins/scenes-local` (module registration,
  plugin-contributed types, executor), `plugins/spaces-home-control/services/space-mode-scheduler.service.ts`
  (managed service, minute tick, DST helpers), `apps/admin/src/modules/scenes` + `plugins/scenes-local` (admin
  module, plugin forms), `modules/notifications` (emitting), `modules/tools` (Buddy/MCP tools).
- Reference scenario used for acceptance throughout:
  "When the occupancy sensor detects a person and the light level is low, turn on the light; if it is night, at low
  brightness. Once the sensor no longer detects a person, turn the light off."

## 3. Scope

**In scope (phases 0–2, the usable feature)**

- Core `automations` module in the backend: entity, migration, CRUD API, graph validation, node type registry,
  engine as a managed service, state tracker, run walker with modes, loop and overload guards, safety policy.
- Built-in cards: device value, button, time, sun, device connection, scene, house mode, security triggers;
  value, time window, day/night, house mode and security conditions; set value, run scene, notify, set house mode
  and automation control actions; Delay, Wait until, Any, All.
- Space cards contributed by `spaces-home-control`: occupancy and activity mode triggers, conditions and actions.
- Admin `automations` module: list, canvas editor on Vue Flow, node configuration forms, validation display, test
  run, live trace, run history, templates.
- A reusable device → channel → property picker and value input in the admin devices module.
- `automation` intent origin, and Buddy ignoring automated actions when learning habits.

**In scope (phases 3–4, after the usable feature)**

- Panel: list of a space's automations with an enable switch.
- Website documentation and `docs/automations-architecture.md`.
- Buddy and MCP tools; Buddy suggesting automations.
- Node type contract in the extension SDK; YAML import and export.

**Out of scope**

- Expression language, variables and passing values between cards.
- Loops and cycles in a graph; durable runs that resume after a restart.
- Safety-reducing actions (disarm, unlock, open) from automations.
- Presence by phone or geofencing, calendars and holidays.
- Importing Homey Flows or Home Assistant automations.
- Replacing space mode schedules, occupancy configuration or the hard-coded house mode actions.
- Editing automations on the panel; editing at phone width in the admin.

## 4. Acceptance criteria

- [x] The open decisions of the design are confirmed and recorded in ADR 0003 and the design doc (AU-0).
- [ ] The reference scenario is drawn on one canvas, saved, survives a reload unchanged, and runs correctly against
      the simulator: dimmed light at night, full light by day, light off after occupancy clears.
- [ ] Triggers fire on transitions and threshold crossings only, never on repeated reports or at startup.
- [ ] A property with no value, an invalid value or an offline device makes a condition take the `no` output and
      cancels a pending "for" timer.
- [x] Device writes from automations go through `PropertyCommandService` with the `automation` intent origin; Buddy
      does not learn them as user habits.
- [x] An automation cannot unlock, disarm or open, directly or through a scene, including a scene edited after the
      automation was saved.
- [ ] A runaway automation is suspended and the administrator is notified.
- [ ] A finished or interrupted run can be inspected node by node in the admin. (Backend done with AU-13: runs
      and traces are recorded and served; the admin view is AU-14.)
- [ ] Deleting a referenced device, property, scene or space marks the automation invalid and shows the broken node.
- [ ] Only `owner` and `admin` can create, edit or run automations.
- [ ] Unit and e2e tests cover the engine semantics; the editor has a Playwright test for the reference scenario.
- [ ] User documentation is published.

## 5. Tasks

Sub-issues of #1555. PR titles are the issue titles unless stated otherwise. The issue bodies carry the full
acceptance criteria; the notes below are the summary.

| ID | Issue | Phase | Task | Depends on |
|---|---|---|---|---|
| AU-0 | #1556 | 0 | Spike: Vue Flow in the admin build, engine walk prototype, open decisions | — |
| AU-1 | #1557 | 1 | `feat(backend): add automations module with entity, migration and CRUD API` | AU-0 |
| AU-2 | #1558 | 1 | `feat(backend): add automation node type registry and graph validation` | AU-1 |
| AU-3 | #1559 | 1 | `feat(backend): track device state transitions for automation triggers` | AU-2 |
| AU-4 | #1560 | 1 | `feat(backend): run automation graphs with modes, delays and guards` | AU-2 |
| AU-5 | #1561 | 1 | `feat(backend): add device, time, scene and notification automation cards` | AU-3, AU-4 |
| AU-6 | #1562 | 1 | `feat(backend): block safety-reducing actions from automations` | AU-4 |
| AU-7 | #1563 | 1 | `feat(backend): mark automation commands with their own intent origin` | AU-5 |
| AU-8 | #1564 | 1 | `refactor(admin): extract device property picker and value input` | — |
| AU-9 | #1566 | 1 | `feat(admin): add automations module with list and stores` | AU-1 |
| AU-10 | #1567 | 1 | `feat(admin): add the automation canvas editor` | AU-0, AU-2, AU-9 |
| AU-11 | #1568 | 1 | `feat(admin): add configuration forms for the first automation cards` | AU-5, AU-8, AU-10 |
| AU-12 | #1569 | 1 | `test(cross): cover the reference automation scenario end to end` | AU-5, AU-11 |
| AU-13 | #1570 | 2 | `feat(backend): record automation runs and traces` | AU-4 |
| AU-14 | #1571 | 2 | `feat(admin): test automations and show live and past runs` | AU-10, AU-13 |
| AU-15 | #1572 | 2 | `feat(backend): add any, all and wait-until automation blocks` | AU-4 |
| AU-16 | #1573 | 2 | `feat(cross): add sunrise and sunset automation cards` | AU-5 |
| AU-17 | #1574 | 2 | `feat(backend): add button, connection, house mode and security automation cards` | AU-5 |
| AU-18 | #1575 | 2 | `feat(backend): add space occupancy and activity mode automation cards` | AU-5 |
| AU-19 | #1584 | 2 | `feat(admin): add forms for phase 2 automation cards` | AU-11, AU-15 … AU-18 |
| AU-20 | #1576 | 2 | `feat(cross): create automations from templates` | AU-11 |
| AU-21 | #1577 | 3 | `feat(panel): list and toggle a space's automations` | AU-1 |
| AU-22 | #1578 | 3 | `docs(cross): document automations` | AU-14, AU-19 |
| AU-23 | #1579 | 4 | `feat(backend): expose automations to Buddy and MCP` | AU-1 |
| AU-24 | #1580 | 4 | `feat(backend): suggest automations from detected routines` | AU-23 |
| AU-25 | #1581 | 4 | `feat(sdk): publish the automation node type contract` | AU-2 |
| AU-26 | #1582 | 4 | `feat(cross): import and export automations as YAML` | AU-10 |
| AU-27 | #1583 | 2 | Integrated verification on hardware | phase 1 and 2 merged |

### Issue summaries

**AU-0 — Spike: Vue Flow in the admin build, engine walk prototype, open decisions**
Scope: render the reference scenario with `@vue-flow/core` inside the admin (Vue 3.5, Vite 8, dark mode, Home
Assistant ingress path, touch); prototype the token walk with fake timers; record a short ADR. Settle the design's
open decisions: default run mode, where built-in cards live, how an automation-set activity mode ranks against
manual/schedule/occupancy, sun calculation in-house or `suncalc`, run history storage, UI naming.
Done when: the ADR is merged, the design doc's decision list is updated, and no production code depends on the
spike branch.

**AU-1 — `feat(backend): add automations module with entity, migration and CRUD API`**
Scope: `modules/automations` with `AutomationEntity` (fields of design § Automation, `graph` as `simple-json`),
incremental migration, DTOs, response models, controller under `/modules/automations`, revision compare-and-swap
on update, `owner`/`admin` only. Registration as in `ScenesModule.onModuleInit` (config mapping, swagger models,
seed, factory reset, extension metadata), bus events `AutomationsModule.Automation.Created|Updated|Deleted`,
OpenAPI regenerated.
Done when: CRUD works with e2e tests including a revision conflict; migration test added; no engine yet.

**AU-2 — `feat(backend): add automation node type registry and graph validation`**
Scope: `AutomationNodeTypeRegistryService` with the trigger/condition/action/flow contracts; per-type config DTO
validation (`forbidNonWhitelisted`); structural rules (at least one trigger, no edge into a trigger, known ports,
no cycles, node and automation limits); `POST /automations/validate` with per-node errors; `GET /node-types`
catalogue with config JSON schema.
Done when: saving an invalid graph is rejected with node-level errors; unreachable nodes are warnings; unit tests
cover every rule.

**AU-3 — `feat(backend): track device state transitions for automation triggers`**
Scope: state tracker with one listener each for `CHANNEL_PROPERTY_VALUE_SET`, `CHANNEL_PROPERTY_UPDATED` and
`CHANNEL_PROPERTY_VALUE_STATE_CHANGED`, routed by property id; last-seen values for referenced properties only;
transition and threshold-crossing detection; "for" timers cancelled on value change, invalid value or device
offline; startup seeding from `PropertyValueService` without firing.
Done when: unit tests with fake timers cover repeats, crossings, "for" durations, sensor loss and startup.

**AU-4 — `feat(backend): run automation graphs with modes, delays and guards`**
Scope: engine as a `BaseManagedExtensionService`; per-automation subscription rebuild on create/update/delete/enable;
token walk with parallel edges, `yes`/`no` and `done`/`error` outputs; Delay block (cap 24 h); modes `single`,
`restart`, `parallel` (bounded); per-automation run-rate guard that sets `status = suspended` and raises a
notification; global caps; automations marked `invalid` when a referenced device, property, scene or space is
deleted; manual `POST /automations/:id/trigger` and websocket command.
Done when: unit tests cover branches, modes, cancellation, the suspend guard and invalidation.

**AU-5 — `feat(backend): add device, time, scene and notification automation cards`**
Scope: triggers — device value changes (to/from/any, above/below, "for"), time of day with weekdays, manual start;
conditions — device value comparison with operators by data type, time window with weekdays; actions — set device
value (grouped per device, through `PropertyCommandService.executePropertyCommands`), run scene, send
notification. Shared minute tick; move `schedule/schedule-time.ts` to a shared location used by both schedulers.
Done when: each card has unit tests; the reference scenario runs in a backend e2e test against the simulator.

**AU-6 — `feat(backend): block safety-reducing actions from automations`**
Scope: one policy service identifying unlock, disarm and open commands by device category, property category and
target value; applied on save (per-node error), before every property write, and before every scene run by
inspecting the scene's current enabled actions; refusals take the `error` output and are traced. Manual scene runs
unchanged.
Done when: tests prove a direct write, a scene, and a scene edited after save are all refused.

**AU-7 — `feat(backend): mark automation commands with their own intent origin`**
Scope: add `'automation'` to `IntentOrigin`; pass `{ origin: 'automation', extra: { automationId } }` on property
commands and as the third argument of `triggerScene`; `ActionObserverService` in Buddy ignores this origin;
regenerate OpenAPI and panel client if the origin is exposed.
Done when: intents created by automations carry the origin and Buddy pattern detection tests show they are ignored.

**AU-8 — `refactor(admin): extract device property picker and value input`**
Scope: `device-property-picker.vue` (device → channel → property, filter by permission and data type) and
`property-value-input.vue` in the admin devices module, extracted from the scenes-local forms; scenes-local and
data-sources-device-channel forms switched to them with no behaviour change.
Done when: existing form tests pass and the new components have unit tests.

**AU-9 — `feat(admin): add automations module with list and stores`**
Scope: `modules/automations` on the scenes module layout: stores with zod schemas, composables, routes and menu
entry next to Scenes, list view with enabled switch, status, last run and filters, websocket event handling, data
refresh registration, six locales.
Done when: automations can be listed, enabled, disabled and deleted; store and composable tests added.

**AU-10 — `feat(admin): add the automation canvas editor`**
Scope: add `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls` (pinned); `automation-canvas.vue` as the
only importer, mapping graph JSON to library nodes and edges; palette grouped When / And / Then / Flow from
`GET /node-types`; typed handles with connection validation; node cards with summary text; right-hand drawer;
save with revision; unsaved-changes guard; undo/redo; server validation errors outlined on nodes; read-only below
the `md` breakpoint; generic form generated from the config schema for cards without an admin element.
Done when: a graph can be built, saved and reloaded unchanged; mapping has unit tests.

**AU-11 — `feat(admin): add configuration forms for the first automation cards`**
Scope: `useAutomationNodePlugins` on the scene-action plugin pattern (`automationNodeForm`, `automationNodeCard`,
schemas); forms and card summaries for every AU-5 card using the AU-8 picker; the editor hides or disables
safety-reducing values and shows the server's refusal.
Done when: the reference scenario can be configured entirely in the UI.

**AU-12 — `test(cross): cover the reference automation scenario end to end`**
Scope: Playwright test that draws the reference scenario, saves, reloads and compares; backend e2e that runs it
against the simulator for night, day and vacancy.
Done when: both run in CI.

**AU-13 — `feat(backend): record automation runs and traces`**
Scope: `AutomationRunEntity` and migration; trace written once at run end; `running` marker written when a run
parks on Delay or Wait; leftover `running` rows set to `interrupted` on startup; retention of the last 50 runs per
automation; `GET /automations/:id/runs` and `/runs/:runId`; `AutomationsModule.Run.Started|Completed` events;
step events only for clients watching that automation.
Done when: traces include the trigger, nodes visited, outputs taken, observed condition values and action results.

**AU-14 — `feat(admin): test automations and show live and past runs`**
Scope: Test button starting a manual run; nodes highlighted as a run reaches them; run history list; replay of a
past run with observed values on each condition; suspended and invalid states explained with a link to the node.
Done when: a failed condition or action can be located from the UI without reading logs.

**AU-15 — `feat(backend): add any, all and wait-until automation blocks`**
Scope: Any and All joins; Wait until a trigger-style event with a timeout output.
Done when: unit tests cover joins with partial arrivals, timeouts and cancellation on restart mode.

**AU-16 — `feat(cross): add sunrise and sunset automation cards`**
Scope: local sun calculation from the configured location (per AU-0 decision), sunrise/sunset triggers with offset,
day/night condition, correct across DST and at high latitudes where the sun does not rise or set.
Done when: unit tests compare against known times for several locations and dates.

**AU-17 — `feat(backend): add button, connection, house mode and security automation cards`**
Scope: button trigger from `ChannelInput.Occurrence`; device offline/online trigger; scene-was-run trigger; house
mode trigger, condition and action; a typed security bus event for armed/alarm transitions with matching trigger
and condition; arm action (disarm stays blocked by AU-6); enable/disable/run another automation.
Done when: each card has unit tests.

**AU-18 — `feat(backend): add space occupancy and activity mode automation cards`**
Scope: registered by `spaces-home-control`: occupancy changed trigger, space-is-occupied condition, activity mode
changed trigger, mode-is condition, set activity mode and space lighting intent actions, with the precedence
decided in AU-0.
Done when: cards appear only while the plugin is enabled and are covered by unit tests.

**AU-19 — `feat(admin): add forms for phase 2 automation cards`**
Scope: forms and summaries for AU-15 … AU-18 cards; space cards live in the admin `spaces-home-control` plugin.
Done when: every card in the catalogue has a specific form or a deliberate generic one.

**AU-20 — `feat(cross): create automations from templates`**
Scope: YAML template definitions with a loader service in the backend (motion light, door-open reminder, away
heating setback, leak alarm); "New from template" dialog asking for the devices and durations; result is an
ordinary graph.
Done when: each template produces a valid, runnable automation.

**AU-21 — `feat(panel): list and toggle a space's automations`**
Scope: panel module and repository for automations; a section on space pages next to schedule and occupancy with
name, status and an enable switch; no editing.
Done when: toggling on the panel is reflected in the admin live; widget test added.

**AU-22 — `docs(cross): document automations`**
Scope: `apps/website/app/docs/admin-management/automations/` with screenshots; `docs/automations-architecture.md`;
entries in `docs/features.md` and `CLAUDE.md` architecture references.
Done when: published and linked from the scenes page.

**AU-23 — `feat(backend): expose automations to Buddy and MCP`**
Scope: tool provider with `list_automations`, `run_automation`, `set_automation_enabled`; MCP wrappers with the
matching capabilities; automations in the home-context snapshot with limits.
Done when: tools respect audience and access kind and are covered by tests.

**AU-24 — `feat(backend): suggest automations from detected routines`**
Scope: a suggestion type that proposes an automation (trigger plus actions) where Buddy today proposes only a scene;
applying it opens the editor with a pre-filled draft.
Done when: a detected time-of-day pattern produces an automation suggestion.

**AU-25 — `feat(sdk): publish the automation node type contract`**
Scope: node type contracts and helpers in `packages/extension-sdk`; example card in `packages/example-extension`.
Done when: an extension can add a card without importing backend internals.

**AU-26 — `feat(cross): import and export automations as YAML`**
Scope: export one automation as YAML; import with validation and remapping of missing references; optional
read-only "View as YAML" tab.
Done when: export followed by import reproduces the graph.

**AU-27 — Integrated verification on hardware**
Scope: run the reference scenario and one heating, one cover and one alarm scenario on a Raspberry Pi installation
with real devices; check behaviour across backend restart, device loss and a full day of triggers.
Done when: results are recorded in section 7.

### Scope changes from the spike (ADR 0003)

- AU-3: optional hysteresis on numeric triggers; baseline read when a save first references a property.
- AU-4: `restart` cancels all runs of the automation; action timeouts; second rate window (200 per hour);
  counters for ignored and dropped triggers; monotonic clock for durations; Delay limit 1 h.
- AU-5: decide how time cards behave before the system clock is trustworthy (ADR 0003, decision 17); the
  "for" restriction of decision 5 is enforced by the trigger card on save.
- AU-7: also remove "automation" from Buddy's scene synonyms (`SCENE_SIGNALS`, planner grammar).
- AU-10: side panel instead of `el-drawer`; strict connection mode; tap-to-add in the palette.
- AU-15: All is a strict AND and is rejected when fed from two triggers; Wait until timeout is mandatory.
- AU-16: add nullable house latitude and longitude to the system configuration, filled from onboarding.
- AU-18: add an automatic activation source to `SpaceModeService.activateMode` that does not set the occupancy
  manual hold.
- AU-22: correct admin, website and README text that calls scenes "automations".

### Execution order

1. **Phase 0:** AU-0. No production code before its ADR is merged.
2. **Phase 1:** AU-1 → AU-2 → (AU-3 ∥ AU-4) → AU-5 → (AU-6 ∥ AU-7). In parallel: AU-8, then AU-9 → AU-10 → AU-11.
   AU-12 closes the phase.
3. **Phase 2:** AU-13 → AU-14; AU-15 … AU-18 in parallel → AU-19; AU-20; AU-27 closes the usable feature.
4. **Phase 3 and 4:** AU-21, AU-22, then AU-23 → AU-24, AU-25, AU-26 in any order.

### Parallel lanes

- Lane A (backend engine): AU-1 → AU-2 → AU-3/AU-4 → AU-5 → AU-6/AU-7 → AU-13 → AU-15 … AU-18.
- Lane B (admin): AU-8; AU-9 → AU-10 → AU-11 → AU-14 → AU-19.
- Lane C (reach): AU-21, AU-22, AU-23 … AU-26.
- Shared files (`app.module.ts`, `app.main.ts`, `openapi.constants.ts`, locale indexes) are edited by appending;
  generated files are regenerated in the PR that changes their source, never edited by hand.

## 6. Technical constraints

- Follow the scenes module structure and the Devices module API conventions (see `CLAUDE.md`).
- New dependencies are limited to the Vue Flow packages in the admin, pinned to exact versions and imported from
  one wrapper component. No backend dependency without a decision recorded in AU-0.
- Incremental migrations only.
- The backend is the only executor; the admin and panel never evaluate rules.
- Every device write goes through `PropertyCommandService`; every scene run through `SceneExecutorService`.
- The graph is validated on the server on every save; unknown node types and config keys are rejected.
- Engine tests use fake timers; no test may depend on wall-clock time.
- Tests are expected for new logic (unit next to source, e2e against the simulator).

## 7. Verification

Hardware verification (AU-27) results are recorded here with date, release and outcome per row.

| Row | Date | Release | Outcome |
|---|---|---|---|
| — | — | — | not started |

## 8. AI instructions

- Read the design doc and this file entirely before making changes; work on one sub-issue per branch and PR.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes inside the sub-issue's scope; report anything outside it instead of widening scope.
- For each acceptance criterion, either implement it or explain why it is skipped.
