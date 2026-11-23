# Automations architecture

An automation is a graph of When / And / Then cards that the backend runs on its own. The `automations` core module
stores, validates and runs automations; the admin draws them on a Vue Flow canvas; the panel lists the automations of
a room and switches them on or off; Buddy and MCP clients list, run and switch them through tools. Scenes stay "a list
of writes run on demand": an automation can run a scene, a scene never has triggers.

The decisions behind the rules below are recorded in
[ADR 0003](./adr/0003-automations-spike-and-decisions.md); the original design is
[`docs/superpowers/specs/2026-11-10-automations-design.md`](./superpowers/specs/2026-11-10-automations-design.md). The
user guide is the website page `apps/website/app/docs/admin-management/automations/page.mdx`.

## Current implementation map

| Concern | Source |
| --- | --- |
| Module, constants, limits | `apps/backend/src/modules/automations/automations.module.ts`, `automations.constants.ts` |
| Entities and migrations | `entities/automations.entity.ts`, `entities/automation-runs.entity.ts`; `apps/backend/src/migrations/1000000000056-AddAutomations.ts`, `1000000000057-AddAutomationRuns.ts` |
| REST API | `controllers/automations.controller.ts`, `node-types.controller.ts`, `runs.controller.ts`, `templates.controller.ts`, `transfer.controller.ts` |
| Card ("node type") contract | `graph/node-type.ts`; SDK mirror `packages/extension-sdk/src/automation.types.ts` |
| Registry and catalogue | `services/node-type-registry.service.ts` |
| Graph validation and save policy | `graph/graph-validator.ts`, `graph/save-policy.ts`, `services/automations.service.ts` |
| Engine (framework-free) | `engine/automation-engine.ts`, `engine/run-walker.ts`, `engine/mode-policy.ts`, `engine/rate-guard.ts` |
| Engine adapter, run persistence | `services/automation-engine.service.ts`, `services/automation-run.service.ts`, `services/automation-run-history.service.ts` |
| State tracking and event sources | `tracker/state-tracker.ts`, `services/state-tracker.service.ts`, `services/event-source.service.ts` |
| Time and sun | `time/house-time.ts`, `time/minute-ticker.ts`, `time/sun.ts`, `services/time-source.service.ts`, `apps/backend/src/common/schedule/` |
| Built-in cards | `nodes/*.node-type.ts`, registered by `nodes/built-in-node-types.service.ts` |
| Space cards | `apps/backend/src/plugins/spaces-home-control/automations/` |
| Safety policy | `safety/safety-rules.ts`, `safety/action-safety-policy.ts`, `services/automation-safety.service.ts` |
| Templates | `templates/definitions/*.yaml`, `templates/schema/automation-templates.schema.json`, `templates/template-generator.ts`, `templates/automation-templates.service.ts` |
| YAML import and export | `transfer/automation-yaml.ts`, `transfer/import-references.ts`, `services/automation-transfer.service.ts` |
| Buddy and MCP tools | `services/automation-tool.service.ts`; MCP wrappers in `apps/backend/src/modules/mcp/tools/mcp-target-discovery-tool.service.ts` |
| Buddy suggestions | `apps/backend/src/modules/buddy/services/automation-suggestion-draft.ts`, `automation-suggestion-evaluator.service.ts` |
| Websocket | `listeners/websocket-exchange.listener.ts` (owners and admins), `listeners/display-exchange.listener.ts` (displays) |
| Reference cleanup | `listeners/reference-cleanup.listener.ts` |
| Admin module | `apps/admin/src/modules/automations/` (canvas in `components/canvas/`, card forms in `components/nodes/`, card elements in `nodes/nodes.elements.ts`, editor state in `composables/useAutomationEditor.ts`) |
| Admin space cards | `apps/admin/src/plugins/spaces-home-control/` (elements `automationNodeForm`, `automationNodeCard`, `automationNodeConfigSchema`) |
| Panel | `apps/panel/lib/modules/automations/`, room section `apps/panel/lib/plugins/spaces-home-control/presentation/widgets/automations_section.dart` |
| Extension example | `packages/example-extension/src/automation-cards.ts`; guide in [`docs/extensions.md`](./extensions.md#adding-automation-cards) |
| Generated wire contracts | `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/` (regenerate from backend source; do not edit) |

The engine, walker, mode policy, rate guard, state tracker, graph validator, time helpers and YAML format are plain
TypeScript with an injected clock and no NestJS import (ADR decision 15). The Nest services around them are thin
adapters. Keep it that way: rules are unit-tested against the pure code with fake clocks
(`testing/engine-harness.ts`, `testing/fake-*.ts`).

## Graph model

An automation row (`automations_module_automations`) holds `name`, `description`, `icon`, `enabled`, an optional
`space_id`, `mode`, `status`, `last_run_status`, a `revision` and the whole canvas as one JSON document:

```json
{
	"version": 1,
	"nodes": [
		{ "id": "n1", "type": "device.property.changed", "position": { "x": 0, "y": 0 }, "config": { "...": "..." } }
	],
	"edges": [{ "id": "e1", "source": "n1", "source_port": "out", "target": "n2", "target_port": "in" }]
}
```

- **Nodes** carry the card type, a canvas position and the card configuration. **Edges** connect an output port of
  one node to an input port of another.
- **Ports by kind.** Trigger: no input, `out`. Condition: `in`; `yes`, `no`. Action: `in`; `done`, `error`. Flow
  cards declare their own: Delay `in` → `out`; Wait until `in` → `out`, `timeout`; Any and All `in` → `out`.
- **Space** only files the automation for lists and the panel; it does not limit what the automation may control.
- **Revision.** Every save carries the revision it was based on; a stale revision is refused with a conflict instead
  of overwriting somebody else's change. The admin then offers to load the saved version or overwrite it.
  `PATCH /automations/:id/enabled` needs no revision and moves it like any save.
- **Limits** (`automations.constants.ts`): 200 automations, 100 nodes and 400 edges per graph, ids of at most 64
  characters, positions within ±1,000,000.

### Validation and the save policy

The document shape (unique ids, edges between existing nodes, version, size) is checked by the DTOs. The validator
(`graph/graph-validator.ts`) then checks the graph against the registry and returns issues with a `severity`, a
`code` and the node, edge or field concerned:

| Code | Severity | Group |
| --- | --- | --- |
| `unknown_node_type`, `unknown_port`, `edge_into_trigger`, `cycle`, `duplicate_edge`, `join_never_completes`, `graph_too_large` | error | structural |
| `safety_reducing_action` | error | structural |
| `invalid_config`, `no_trigger`, `node_type_unavailable` | error | completeness |
| `unreachable_node`, `join_partly_completes` | warning | — |

`graph/save-policy.ts` decides what blocks a save: a structural error always does; a completeness error only when
the automation would be enabled by the save. A half-drawn canvas can therefore be kept as a disabled draft, and
enabling requires a complete graph. Warnings never block. An unknown error code is treated as structural, so a rule
added later blocks unless it is listed as a completeness rule on purpose. A refused save is a 422 with
`error.details.code` `automation-graph-invalid` and the issues in `error.details.issues`;
`POST /automations/validate` runs the same check without saving.

### Status

`status` is `ok`, `invalid` or `suspended`:

- **`invalid`** — set by the engine when the stored graph cannot run: a card type is not registered (a plugin was
  removed), a card has no handler (`not_runnable`), a referenced device, channel, property, scene, space or
  automation no longer exists (`missing_reference`, driven by `references(config)` and
  `listeners/reference-cleanup.listener.ts`), or a trigger threw when armed. The runtime endpoint lists the problems
  per node.
- **`suspended`** — set by the rate guard. Cleared by saving the automation or enabling it again.

## Trigger and run semantics

### Engine lifecycle

`AutomationEngineService` loads every enabled automation at start, compiles its graph into a run plan and arms its
triggers. A save that changes the graph, the mode or `enabled` cancels the automation's active runs and re-arms it;
a save that changes only the name, description, icon or node positions does not. A card of a disabled owner (see
[owner gating](#node-type-contract)) is not armed, and enabling the owner re-arms the automations that use it.

### Triggers

A trigger's `subscribe(config, fire)` starts watching and returns the function that stops it. Whatever a trigger
keeps — a state watch, a timer, a "for" duration — belongs to the subscription, never to a run, so no run mode
touches it.

The state tracker (`tracker/state-tracker.ts`) gives device triggers their semantics:

- A watch fires on a transition between two valid values, never on a repeated report. The first report of a
  property never seen before is a baseline, not a transition.
- Edges are compared against the last **valid** value: `true → offline → true` does not fire.
- A numeric watch fires on crossing its threshold, not while the value stays beyond it. With a hysteresis it fires
  again only after the value came back past the threshold by at least the hysteresis.
- A **"for" duration** starts when the value enters the target state and is cancelled when it leaves it, becomes
  invalid or the device goes offline. Once fired it does not fire again until the value has really left the state.
  "For" needs a target state (`to`, `above`, `below`) and takes at most 7 days (`STATE_WATCH_MAX_FOR_SECONDS`).
- When the target state already holds when a "for" watch learns the value — on a save, or at backend start — the
  duration starts from that moment and the run is marked as a re-arm.
- When a save first references a property, its baseline is read from `PropertyValueService`; a condition waits a
  moment for that baseline before answering "unknown".

Event triggers (button presses, connection changes, scene runs, house mode, security transitions) share one bus
listener per event in `AutomationEventSourceService`. Connection triggers fire on online/offline transitions only.

Time uses the house timezone from the system configuration, never the process timezone, and one shared minute tick.
Durations (Delay, "for", timeouts, rate windows) run on the monotonic clock. A wall clock earlier than 2026-01-01
(`MIN_TRUSTED_WALL_CLOCK_MS`) is not trusted: time triggers do not fire and time conditions answer `no`. A clock
jumping forward by more than 5 minutes serves only the current minute; a clock set back does not fire a time-of-day
trigger again for any of the last 31 dates it fired on. Sun cards compute sunrise and sunset locally
(`time/sun.ts`) from the house `latitude` and `longitude` of the system configuration and are unavailable while
the location is not set. Details: ADR decisions 6, 10, 11 and 17.

### Runs

A fired trigger asks the mode policy whether a run may start, then the walker (`engine/run-walker.ts`) walks the
graph with tokens:

- A run starts at one trigger. A token is put on every edge leaving the output a node took. Branches run in
  parallel; the only order kept is that edges of one output are started in document order. A sequence is a chain
  through `done`.
- Two edges into one node execute it once per arriving token.
- A condition continues on `yes` or `no`. One that throws or times out is `no`, with the reason traced: **unknown is
  not true**.
- An action continues on `done` or `error`. One that throws, times out or is refused by the safety policy takes
  `error`. An `error` with no edge ends that token and marks the run `failed`; other branches continue.
- **Delay** parks the token on a monotonic timer, at most 1 hour (`AUTOMATION_DELAY_MAX_SECONDS`).
- **Wait until** passes at once when its state already holds, otherwise parks until the state is reached (`out`) or
  its mandatory timeout, at most 1 hour, runs out (`timeout`).
- **Any** continues on the first token of the run and absorbs later ones. **All** continues once a token has arrived
  on every incoming edge in the same run — a strict AND; when nothing that could still arrive is left, it does not
  continue and the trace names the missing edges. Join state belongs to the run. An All fed only from different
  triggers can never complete and is refused on save (`join_never_completes`).
- Every condition and action has a timeout: 30 s unless the card sets `timeoutSeconds`, at most 300 s. A run takes
  at most 1,000 steps (`RUN_MAX_STEPS`); one that needs more ends as `failed`.
- A run ends as `completed`, `failed`, `cancelled` or `interrupted`. A cancelled run ends at once: parked tokens are
  dropped, a node still executing gets its abort signal, its result is traced but its outputs are not followed.

### Run modes and guards

| Mode | On a trigger while a run is active |
| --- | --- |
| `restart` (default) | Cancels **every** active run of the automation, whichever trigger started it, and starts a new one. |
| `single` | Ignores the trigger. |
| `parallel` | Starts another run, up to 10 at once (`PARALLEL_RUNS_MAX`); further triggers are dropped. |

Because `restart` cancels across triggers, unrelated flows on one canvas cancel each other; the rule for users is one
automation per concern, and the editor warns when a `restart` automation holds disconnected flows. Templates use a
"for" trigger, or a Delay followed by a re-check condition, never a bare Delay before a state-changing action.

At most 50 runs are active over all automations (`CONCURRENT_RUNS_MAX`). The rate guard keeps two sliding windows of
started runs per automation; more than 30 per minute or 200 per hour sets `suspended` and raises a notification.
Ignored and dropped triggers are counted per automation and served by the runtime endpoint.

### Manual runs

`POST /automations/:id/trigger` (and the `AutomationsModule.TriggerAutomation` websocket command) starts a run as if a
trigger had fired, optionally at a chosen trigger node; the run is not waited for and the answer carries the run id.
It is refused while the automation is disabled, `invalid` or `suspended`, or when the chosen node is not a trigger.
The **Manual start** card is a trigger that fires only this way. The admin's **Test** button, the **Run automation**
card, and the `run_automation` tool all use this path.

### Run history and live runs

- One row per run in `automations_module_runs`, with the trace as one JSON document: what started the run and, per
  node reached, the edge it arrived on, the output taken, what a condition observed and what an action answered.
- A run that parks is written as `running` with the steps so far, and rewritten whenever it parks again and when it
  ends. Leftover `running` rows become `interrupted` (`backend_restarted`) before the engine loads automations: runs do
  not survive a restart. An orderly stop ends active runs as `interrupted` (`engine_stopped`).
- Retention: the last 50 runs per automation, and nothing older than 30 days (nightly and at start). A trace takes at
  most 128 KB; an observed value over 2 KB is replaced by a note, and the trace is marked `truncated`.
- `AutomationsModule.Run.Started` and `Run.Completed` go over the bus to owner and admin sockets, without the trace.
  `AutomationsModule.Run.Step` is sent only to the websocket room of one automation, which a client joins with
  `AutomationsModule.WatchAutomation` and leaves with `UnwatchAutomation`. Displays get the lifecycle events of
  automations without their graphs, and no run events.

## Safety policy

An automation acts without anybody present, so it may lock, arm and close but never **unlock, disarm or open**
(ADR decision 18). The rules are one list, `safety/safety-rules.ts`, matching every known form of such a write by
channel, device and property category and by value (`status: unlocked`, `locked: false`, `position: open`, …) for
`lock`, `alarm` and `door` channels. Valves and window coverings are not covered.

The policy judges what an action **declares** in `commands(config)` — `property_write` and `scene_run` entries — so it
does not know the cards, and a plugin's card is covered as soon as it declares its commands. It runs at three
points:

1. **On save:** an unsafe write is the structural error `safety_reducing_action`, so not even a disabled draft can
   hold it. A scene that would be refused is only a warning, since the scene may change before it runs.
2. **Before every action:** the engine asks the policy again with fresh property categories; a refusal is traced as
   refused and takes `error`. A scene is read with its enabled actions at that moment; one unsafe action refuses
   the whole scene.
3. **In the scene runner:** `SceneExecutorService.triggerScene` takes a guard that sees the very actions about to
   run, so a scene edited between the check and the run cannot slip through.

A policy that throws or does not answer in time refuses. Automation writes carry the intent origin `automation`
(set on the server; a client cannot claim it), and Buddy's action observer drops them, so Buddy does not learn
patterns from what automations do.

## Node type contract

A card is a `AutomationNodeTypeBase` with a kind-specific handler (`graph/node-type.ts`):

| Member | Purpose |
| --- | --- |
| `type` | Unique id stored in the graph: lower-case words joined by `.`, `_` or `-`, at most 100 characters (`device.property.changed`). Prefix it with the owner. |
| `kind` | `trigger`, `condition`, `action` or `flow`. Extensions add the first three; flow cards (Delay, Wait until, Any, All) are run by the engine itself. |
| `name`, `description` | Plain English; the admin translates built-in cards by type. |
| `ports` | Optional for triggers, conditions and actions (defaults above); required for flow cards. A trigger has no input. |
| `validateConfig(config)` | Returns `{ field, reason }` problems, empty to accept. Called on every save and validation with untrusted input; a reason never repeats the value. |
| `configSchema` | JSON Schema the admin builds a generic form from. It only shapes the form; `validateConfig` enforces. |
| `references(config)` | Entities the node depends on (`device`, `channel`, `property`, `scene`, `space`, `automation`) with the config `path` holding each id, so removal invalidates the automation and an import can remap it. |
| `owner` | `{ kind: 'module' \| 'plugin', type }`. A card of a disabled owner stays registered but is left out of the catalogue, not armed, and refused at execution. |
| `unavailableReason()` | Why the card cannot be used now (e.g. no house location); quick and never throws. A graph using it can be a disabled draft but cannot be enabled. |
| Trigger `subscribe(config, fire, context)` | Starts watching, returns the stop function. Never call `fire` inside `subscribe`. |
| Condition `evaluate(config, context)` | Returns `{ result, observed?, reason? }`. |
| Action `execute(config, context)` | Returns `{ success, reason?, refused? }`. Groups writes to one device itself. |
| Action `commands(config)` | What the action does to the home, for the safety policy. Called with unvalidated config; never throws. An action that acts on the home and declares nothing is a bug. |
| `timeoutSeconds` | Condition and action timeout override, capped at 300 s. |

The run context hands a condition or an action the `automationId`, `runId`, `nodeId`, the `trigger` that started the
run (`{ nodeId, data, manual }`) and an `AbortSignal` that fires when the run is cancelled or the node times out.

`normalizeAutomationNodeType` checks a definition when it is registered and throws on anything the validator could not
use, so a broken card fails at start, not when somebody saves a graph.

## Adding a card

### In a core module or a bundled plugin

1. Write the card next to the code it wraps, typed against `graph/node-type.ts` — see `nodes/*.node-type.ts`, or
   `apps/backend/src/plugins/spaces-home-control/automations/` for a plugin. Validate every config field (a DTO with
   `utils/node-config-dto.utils.ts` works), list `references` with their paths, and for an action list `commands`.
2. Register it: core cards in `nodes/built-in-node-types.service.ts`; a plugin imports `AutomationsModule`, injects
   `AutomationNodeTypeRegistryService` and calls `register()` in `onModuleInit` with its `owner`.
3. Admin: a card works with the generic form built from `configSchema`. For a dedicated form, card summary and Zod
   schema, add them to `apps/admin/src/modules/automations/nodes/nodes.elements.ts` (core cards; a card added to
   `AutomationBuiltInNodeType` without them does not compile) or register a plugin element with
   `automationNodeForm`, `automationNodeCard` and `automationNodeConfigSchema` for the automations module, as
   `apps/admin/src/plugins/spaces-home-control/` does. Add the English name and description to the locale under
   `automations.editor.nodeTypes` (or the plugin's locale).
4. Tests: unit-test the card with fake clocks and the fixtures in `testing/`; the admin catalogue test
   (`nodes/nodes.catalogue.spec.ts`) lists the cards the backend knows.
5. If the card can write to a lock, alarm or door, extend `safety/safety-rules.ts` with every form of the unsafe
   value rather than special-casing the card.

### From an installable extension

An extension types its cards against `@fastybird/smart-panel-extension-sdk` (`packages/extension-sdk/src/automation.types.ts`)
with `defineAutomationTrigger`, `defineAutomationCondition` and `defineAutomationAction`, and imports nothing from the
backend for them. The SDK types mirror `graph/node-type.ts`; `graph/node-type.sdk-contract.spec.ts` fails to compile
when the two drift, so a contract change is made in both places. The extension module imports `AutomationsModule` and
calls `AutomationNodeTypeRegistryService.register()` with `owner: { kind: 'plugin', type: '<extension type>' }`.
`packages/example-extension/src/automation-cards.ts` registers a trigger, a condition and an action; its tests are in
`packages/example-extension/test/automation-cards.test.ts`, and the backend runs SDK-typed cards end to end in
`services/extension-node-types.spec.ts`. The step-by-step guide is
[`docs/extensions.md` § Adding automation cards](./extensions.md#adding-automation-cards).

## Templates

Templates are YAML files validated against `templates/schema/automation-templates.schema.json`: built-in ones in
`templates/definitions/` (motion light, door open reminder, away heating setback, leak alarm), user ones as
`module.automations.*.yaml` in the configuration directory, or every `*.yaml` under `FB_AUTOMATIONS_TEMPLATES_PATH`
when it is set. A template with the id of a built-in one replaces it. A template declares parameters (`property`,
`duration`, `number`, `text`) and a graph whose configuration uses `{ $param: … }` placeholders.
`POST /templates/:id/generate` checks the answers and returns a draft — nothing is stored; the admin creates the
automation disabled and opens the draft in the editor. The generated graph keeps no link to the template.

## Import and export

`GET /automations/:id/export` returns a `version: 1`, `kind: automation` YAML document with the name, description,
icon, mode, space and graph — no id, revision, enabled state, status or timestamps. `POST /automations/import/prepare`
reads such a file (at most 256 KB, values nested at most 32 deep, core YAML schema without tags, aliases or several
documents), checks it as a create request and its graph as a save of a disabled automation, safety policy included,
and lists the references that do not exist here with the nodes and fields using them. Up to 200 `mappings` point
them at local entities through each reference's `path` (a property takes its channel and device with it). Nothing is
stored: the client creates the automation from the returned `draft` through the ordinary create request, disabled.
A graph too large to round-trip through this format is reported as `graph_too_large`.

## Clients

- **Admin** (`apps/admin/src/modules/automations/`): list with filters, add and edit forms in the edit drawer, the flow
  editor on template 8 of `docs/admin-ui-design-spec.md` (Vue Flow wrapped in `components/canvas/automation-canvas.vue`;
  a palette of 240 px, 208 px on tablet landscape, with tap-to-add and a 400 ms long press to drag a card out on touch;
  the configuration panel 340 px beside the canvas, 360 px on wide; on tablet portrait the palette waits behind
  **Add block** in a bottom sheet and the panel opens as a drawer over the canvas; on phone the flow is a read-only list
  of steps, `automation-step-list.vue`; undo and redo as graph snapshots; a `domain-icon` on blocks whose devices share
  a domain), Test, run history (ten runs at a time, Load more) and live trace (watching the automation's websocket
  room), templates, YAML import and export, and the **Suggested by Buddy** box.
- **Panel** (`apps/panel/lib/modules/automations/`): reads `GET /automations` with its display token, shows the
  automations of a space in the room overview with their status, and switches them with
  `PATCH /automations/:id/enabled` — the only change a display can make — following the optimistic UI pattern
  (`docs/optimistic-ui-architecture.md`).
- **Buddy and MCP** (`services/automation-tool.service.ts`): `list_automations` (read), `run_automation` (trigger) and
  `set_automation_enabled` (write). No tool creates, edits or deletes an automation or exposes its graph.
- **Buddy suggestions** (`apps/backend/src/modules/buddy/services/automation-suggestion-*.ts`): the
  `pattern_automation_create` suggestion maps a time-of-day routine to a draft — a Time of day trigger and one Set
  device value action with the observed writes — and offers it only when the automations module would save it as an
  enabled automation, safety policy included. Applying it creates nothing on the backend: the admin opens the draft
  in the editor. These suggestions are not announced to the panel or messaging channels.

## Verification boundary

Covered by unit tests on the pure code (walker, modes, guard, tracker, validator, time, sun, YAML) and by service and
controller specs in the module; the admin covers the graph mapping, stores, forms and summaries with Vitest. Not
covered: durable runs across a restart (a Delay or Wait until is lost and shown as `interrupted`; the one-hour limit
exists because of it), a wall clock that is wrong but plausible after a restore by `fake-hwclock`, and browser
verification beyond Chromium.
