# ADR 0003: Automations Spike Results and Engine Decisions

**Status:** Accepted

**Date:** 2026-11-10

**Scope:** The `automations` module (epic #1555). Closes the spike AU-0 (#1556).

## Context

The automations design
([`docs/superpowers/specs/2026-11-10-automations-design.md`](../superpowers/specs/2026-11-10-automations-design.md))
rested on two unproven assumptions and left a list of decisions open:

1. `@vue-flow/core` works as the editor canvas inside the admin build.
2. A token walk over the graph, with the trigger and run rules as written, gives correct behaviour for the
   reference motion-light scenario.

The epic states that no production code starts before these are checked. Three pieces of work were done: a Vue
Flow spike in the admin app, an engine prototype with fake-timer tests, and a read of the existing code for each
open decision. The spike code is kept for reference in
[`docs/work/automations-spike/`](../work/automations-spike/README.md); it is not built or shipped.

## Evidence

### Canvas

`@vue-flow/core` 1.48.2 with `@vue-flow/background` 1.3.2 and `@vue-flow/controls` 1.1.3, in the admin stack
(Vue 3.5.30, Vite 8.1.5, Element Plus 2.13.5, UnoCSS), built through the admin's own Vite config.

| Requirement | Result |
| --- | --- |
| Nodes as our own components with Element Plus and Iconify inside | Works |
| Typed handles (trigger out; condition in, yes, no; action in, done, error) | Works |
| Pan, zoom, drag a node, draw an edge, select, delete, multi-select | Works |
| Reject an edge into a trigger, a cycle, a self-edge, a duplicate | Works with `ConnectionMode.Strict` and an `isValidConnection` callback |
| Add a node from a palette | Drag works with a mouse; on touch only tap-to-add works |
| Configuration form beside the canvas updates the node | Works |
| Graph JSON round-trip after edits | Works |
| Undo and redo | Works, implemented outside the library as snapshots |
| Touch: drag node, pan, pinch, connect by drag or by tap-tap | Works (emulated tablet) |
| Dark mode following Element Plus variables | Works with about 100 lines of CSS |
| Served under a path prefix | Works with a prefixed and with a relative Vite `base` |
| Read-only at 375 px | Works with four props |
| `vue-tsc`, ESLint and Prettier on the spike files | Clean |

73 Playwright assertions pass against a production build. Cost: about 52 kB gzip of JavaScript and 1.5 kB of CSS
as an upper bound, including a second copy of `@vueuse/core` (v10) that Vue Flow depends on. No peer-dependency
warnings.

Limits of this evidence: Chromium only; touch was synthesised, not a physical device; the minimap, automatic
layout and run-trace highlighting were not tried; the comparison is against a stub page, not the full admin
bundle, because the admin entry does not build without the generated `src/openapi.ts`.

### Engine

A dependency-free prototype of about 1,300 lines covers the validator, state tracker, token walk, modes, guards,
joins, wait-until and the safety hook. 99 tests pass with fake timers. The prototype ran against a fake event bus
and fake devices, was executed with Node's type stripping and never type-checked, and did not cover time-of-day,
sun or button triggers, trace persistence, or per-device grouping of writes.

The reference scenario was modelled two ways, with motion returning 60 s into a 120 s wait:

| Modelling of "off" | Mode | Result |
| --- | --- | --- |
| Trigger "occupancy clear **for** 120 s" → off | any | Correct |
| Trigger "becomes clear" → Delay 120 s → off | `restart`, cancelling all runs of the automation | Correct |
| same | `restart`, cancelling only runs from the same trigger | Wrong: light goes off with the room occupied |
| same | `single` | Wrong: returning motion is ignored, then the light goes off |
| same | `parallel` | Wrong: light goes off with the room occupied |

In the Delay modelling the light also goes off when the sensor drops offline during the delay, unless a "still
clear" condition follows the Delay. In the "for" modelling it does not.

## Decisions

### 1. Canvas library

Use Vue Flow at the versions above, pinned exactly, imported only by one wrapper component. Required settings and
constraints for AU-10:

- `ConnectionMode.Strict` plus `isValidConnection`. The library default (loose) lets a source connect to a source.
- Stop click propagation on handles; otherwise tapping a handle selects the node and opens its form.
- The configuration form is a side panel that pushes the layout, not `el-drawer`: the drawer traps keyboard focus
  and covers the right-hand nodes.
- The palette supports tap-to-add as well as drag, because HTML5 drag does not start from touch.
- Arrowhead and background colours are passed as props; they cannot be set from a stylesheet.
- At phone width the initial view zooms to the first trigger instead of fitting the whole graph, which is
  unreadable at that scale.
- The lockfile diff is reviewed when the packages are added: `pnpm add` rewrote unrelated entries during the spike.

### 2. Run modes

- Modes are `single`, `restart` and `parallel` (capped at 10 concurrent runs). No `queued` mode.
- **`restart` is the default and cancels every active run of the automation**, whichever trigger started it,
  including parked delays, waits and half-arrived joins. Cancelling only runs from the same trigger is not offered.
- "For" durations belong to the trigger subscription, not to a run, so no mode affects them.
- Consequence: unrelated flows on one canvas cancel each other under `restart`. The rule for users is one
  automation per concern; the editor warns when a `restart` automation contains disconnected sub-graphs.
- Templates use a "for" trigger, or a Delay followed by a re-check condition. They never use a bare Delay before a
  state-changing action.

### 3. Run and walk rules

- Parallel branches are unordered. A sequence is expressed as a chain through `done`.
- Two edges into one node run it once per arriving token.
- An `error` output with no edge ends that token and marks the run `failed`; other branches continue. A throwing
  action or a safety refusal takes `error`. A throwing condition evaluates to `no` with the reason recorded.
- `last_run_status` is one of `completed`, `failed`, `cancelled`, `interrupted`.
- Saving a changed graph, mode or `enabled` cancels active runs. A save that changes only name, description or
  icon does not, and does not rebuild subscriptions.
- An action already executing when its run is cancelled cannot be recalled; its result is traced and its outputs
  are not followed. Every action has a timeout so a hung device call cannot hold a run open.
- A manual run is refused while the automation is `invalid` or `suspended` and may start only at a trigger node.
- `suspended` is cleared by saving the automation or enabling it again.
- The validator also rejects duplicate edges, dangling edges, duplicate ids and unknown graph versions.

### 4. Joins and Wait until

- Join state is per run.
- **Any** passes the first arrival in a run and absorbs later ones.
- **All** fires once a token has arrived on every incoming edge. If a branch can no longer arrive, All does not
  fire and the trace records which edge was missing. It is a strict AND.
- An All fed from two different triggers can never fire, because a run starts from one trigger. The validator
  rejects it. "A and B within 30 s" is expressed with Wait until.
- **Wait until** passes immediately if the state already holds. Its timeout is mandatory.

### 5. Trigger rules

- The first report of a property never seen before is not a transition.
- Edges are compared against the last valid value: true → offline → true does not fire.
- A "for" trigger that has fired does not fire again after an offline blip with the same value.
- A "for" duration restarts when the graph is saved, and at backend start if the state already holds; the trace
  marks a run that came from a start-up re-arm.
- "For" requires a target state (`to`, above, below), not `from` or `any`.
- Numeric triggers accept an optional hysteresis value.
- When a save first references a property, its baseline is read from `PropertyValueService` at that moment.

### 6. Time

- Delays, "for" durations, timeouts and the rate window use a monotonic clock. The wall clock is used only for
  time-of-day logic and display.
- Time windows are `[from, to)`; `from == to` is rejected. For a window that crosses midnight the weekday names
  the day it started.
- Evaluation uses the house timezone explicitly, never the process timezone.
- A time-of-day trigger inside a skipped DST hour fires at the first valid minute after it; inside a repeated hour
  it fires once.

### 7. Delay limit

The Delay and Wait until limit is **1 hour** in the first version, down from the 24 hours first proposed. Runs do
not survive a backend restart, so a long Delay can be lost silently; a "for" trigger re-arms at start and is the
tool for long waits. Durable delays remain a follow-up, and the limit is raised when they exist.

### 8. Guards

- Two sliding windows over started runs per automation: more than 30 per minute or more than 200 per hour sets
  `suspended`. The second window exists because a loop of one write every three seconds passed the first.
- Ignored and dropped triggers are counted per automation and shown, so "why did it not run" has an answer.
- The save-time warning for an action that writes a property its own trigger watches stays.

### 9. Setting a space activity mode from an automation

The design said a manual change pauses the schedule and occupancy. That is wrong: a manual change pauses only
occupancy, until someone presses Resume; schedules are never paused. Calling the existing manual path from an
automation would therefore switch off occupancy for that room after a single run.

Automations get their own **automatic** source in `SpaceModeService.activateMode`: it does not set the occupancy
manual hold, it uses the existing activation-id compare-and-swap so it never overwrites a newer choice it did not
see, and its actor is `automation:<id>:<run>`. The schedule's "manual selection" badge treats it as automatic.
Last automatic writer wins, as between schedule and occupancy today.

### 10. Location for sun cards

There is no house location today; coordinates exist only on weather-plugin locations, and an OpenWeatherMap
city-name location has none. Add nullable `latitude` and `longitude` to the system configuration, filled by
onboarding and defaulted from the primary weather location on upgrade. Sun cards are unavailable, with a clear
validation message, when no location is set.

As built (AU-16): the location is `latitude` and `longitude` of the `system-module` configuration, editable in
the system settings and stored by the onboarding location step. The configuration lives in `config.yaml`, not
in the database, so the upgrade default is an on-boot step (`HouseLocationDefaultService`) rather than a
migration: while the file holds no `latitude` or `longitude` key at all - a file written before they existed -
the coordinates of the primary weather location are copied in, when it has them. Once either key is stored,
set or cleared, it is never touched again. A node type may declare `unavailableReason()`; the validator then
reports `node_type_unavailable` on each node using it, a completeness issue (a disabled draft can be saved,
enabling is refused), and the catalogue serves the reason as `unavailable_reason`. The engine does not ask for
it when it loads an automation: an automation enabled while the location was set stays armed if the location
is cleared, its sun triggers do not fire and the day or night condition answers `no` with the reason.

### 11. Sun calculation

Implemented in the module, with no dependency. `suncalc` resumed publishing in June 2026 after four years, with
eight releases since, the latest on the day of this ADR, no provenance attestation and no licence field in its
package metadata. The calculation is 80–150 lines and must handle polar day and night (no event that day), the
local day rather than the UTC day, and offsets applied to the instant.

As built (AU-16): `automations/time/sun.ts` takes the position of the sun from the NOAA solar calculator and
finds sunrise and sunset as the crossings of -0.833° by the altitude itself: sampled every 10 minutes on a grid
fixed to the epoch, refined by bisection, with turning points of the altitude searched so that a sun showing for
only a minute or two near the polar night is not missed. Each crossing is found on its own, so the days around
the midnight sun and the polar night keep every event, also a sunrise that comes after the last sunset. A solar
day is anchored to the calendar date at the longitude, and an event belongs to the local date of the instant it
happens at in the house timezone. The trigger (`sun.event`) fires at the first minute boundary at or after the
event moved by its offset (up to six hours either way), so a day or night check right after a sunrise sees day
and right after a sunset sees night; it works on instants, so a daylight-saving change does not move or repeat
it, and one event fires once as for a time of day. The condition (`sun.daylight`) compares the altitude with the
same -0.833°, so a polar day is day and a polar night is night. Tested against timeanddate.com tables to within
a minute, and within three minutes on the days next to the polar transitions, where the sun crosses the horizon
at a shallow angle.

### 12. Run history

SQLite, as proposed: the last 50 runs per automation enforced when a run is written, a nightly prune of runs older
than 30 days, and a size limit per trace. Every timeseries path in the system keeps at most 24 hours, or nothing
across a restart when only the memory storage is active, which would defeat the `interrupted` marker.

### 13. Where built-in cards live

Cards over core modules (devices, time, scenes, notifications, house mode, security) are registered by the core
`automations` module, matching security providers, tools and Buddy evaluators. Space cards are registered by
`spaces-home-control`. Because the backend has no generic check for a disabled plugin, the engine checks the
owning plugin's `enabled` flag when arming triggers and before executing, and a graph whose card type is not
registered marks the automation `invalid` instead of failing at start.

### 14. Naming

The feature is called **Automations**, with When / And / Then on the cards. Phase 1 includes:

- Buddy no longer treats "automation" as a synonym for scene (`SCENE_SIGNALS` and the planner grammar). This is a
  behaviour fix, not wording.
- Admin, website and README text that calls scenes "automations" is corrected.

"Occupancy automation" and "climate automation" keep their wording.

### 15. Engine structure

The walker, state tracker core, mode policy, rate guard, graph validator and time helpers are plain,
framework-free code taking an injected clock, unit-tested like the prototype. Nest services are thin adapters
around them. The run service is split into a pure walker and a service that persists traces.

### 16. Writes from parallel branches

Added with the engine (AU-4); the spike left it open.

- The engine neither orders nor merges what parallel branches write. Each action node is one call of its
  handler, made when its token arrives. Two branches that write to the same device produce two independent
  commands, and for the same property the later command wins.
- The only order the engine keeps is the start order: the edges leaving one output are followed in the order
  they have in the graph document, and a handler is called before the next edge is followed. Behind a node that
  waits (a condition, an action, a Delay) the order between branches is not defined.
- Grouping is the job of one action, not of the engine: an action that writes several values groups them per
  device before it calls `PropertyCommandService.executePropertyCommands`, which rejects a batch spanning
  several devices. Values that must be applied together belong to one action node; a required order is a chain
  through `done`.
- The engine does not serialise actions per device. Serialising would make one slow or offline device hold up
  unrelated branches for up to the action timeout, and the reference scenarios do not need it.

Also settled with the engine:

- A cancelled run ends at once for the mode policy and the caps. A node of it that is still executing gets its
  abort signal, and the trace is complete once that node returns or reaches its timeout (30 s by default, 300 s
  at most, for conditions as well as actions).
- A save that only moves nodes on the canvas counts as a metadata-only save: positions are not part of what
  decides how an automation runs.
- A manual run of a disabled automation is refused: a disabled automation holds no timers and no runs.
- One run takes at most 1,000 steps. A graph that fans in executes a node once per arriving token, so tokens
  can multiply far beyond the node count; a run that reaches the limit ends as `failed`.
- Active runs end as `interrupted` when the engine stops in an orderly way. Recognising runs lost to a power
  cut needs the `running` marker of the run history (AU-13).

### 17. Time before the system clock is trustworthy

Added with the first cards (AU-5); the spike left it open. A Raspberry Pi has no real-time clock: after a power
cut it starts at the epoch, at the build date of its image, or at the time `fake-hwclock` saved at the last
orderly shutdown, and stays there until the network sets the time.

- **Unknown is not true, for time as for device values.** While the wall clock reads earlier than
  2026-01-01 UTC it is not trusted: no time-of-day trigger fires, and a time-window condition evaluates to `no`
  with the reason recorded. The floor is a constant (`MIN_TRUSTED_WALL_CLOCK_MS`); a clock before it can only be
  one that was never set. The same holds while the house timezone in the system configuration is not a zone the
  runtime knows.
- **A set clock is not replayed.** The minute tick follows the wall clock and is re-aligned after every tick.
  When the clock jumps forward by more than 5 minutes (the network setting the time, a long suspend) only the
  current minute is served; the times the jump skipped do not fire, exactly as after a restart. A stall of up
  to 5 minutes is caught up minute by minute, so a busy event loop does not lose a trigger.
- **A corrected clock does not fire twice.** When the clock is set back the tick continues from the new time,
  and a time-of-day trigger does not fire again for any of the last 31 local dates it fired for
  (`TIME_OF_DAY_SERVED_DATES_KEPT`). The guarantee is counted in fired dates, not in elapsed time: a date that
  has dropped out of those 31 can fire again. A set of dates is kept instead of a high-water mark, because a clock
  briefly set far ahead would otherwise silence the trigger until that date. The memory is per subscription and
  is lost when the trigger is re-armed or the backend restarts.
- **Durations are not affected.** Delays, "for" durations, timeouts and the rate windows run on the monotonic
  clock (decision 6), so none of them changes when the wall clock is set.
- **What is not detected:** a clock that is wrong but plausible - `fake-hwclock` restoring a time some hours or
  days old that is later than the floor. Until the network corrects it, time cards act on that time; the
  correction is then handled by the two rules above. Detecting it needs the synchronisation state of the
  operating system (`timedatectl`), which is not available in a container or on every platform, and the window
  is the few seconds between the start of the backend and the first time sync. Left as a follow-up for the
  hardware verification (AU-27) should it show up there.

Also settled with the first cards:

- The time helpers shared with the space mode scheduler live in `apps/backend/src/common/schedule/`. The
  scheduler keeps its rule that a schedule entry inside a skipped hour is skipped that day; an automation
  time-of-day trigger fires at the first valid minute after it (decision 6). The two rules differ on purpose:
  a schedule entry sets a state that the next entry replaces, a trigger starts something that would otherwise
  not happen that day.
- A device card stores the device, channel and property ids together. The engine can then mark the automation
  `invalid` when any of the three is removed, and a write is refused by the command service when the property
  is no longer the one of that channel and device.
- A card configuration is checked on save against the property it points at: operators and thresholds by data
  type, values by data type and enum format, and writes against the permissions. A property that does not exist
  is not a configuration error; it marks the automation `invalid` in the engine, with the node named.
- "Set device value" takes up to 20 writes. They are grouped per device, one command batch per device, and
  devices are written side by side so an offline device does not hold up the others.
- A condition waits for the baseline of a property that was referenced a moment ago before it answers
  `unknown`, so a run right after a save does not see "no value" for a property that has one.
- Notifications sent by automations are events with the automations module as source. They share the
  notifications module's limit of 60 per minute per source with the engine's own "suspended" notification.

### 18. Safety policy

Added with AU-6; the design names the rule (§ Security and safety), this records how it is built.

- **What reduces safety is one list**, `modules/automations/safety/safety-rules.ts`: unlock, disarm, open. A
  write is recognised by the category of the device, of the channel and of the property and by the value. The
  integrations describe the same thing differently, so a rule lists every known form: a lock is unlocked by
  `status: unlocked`, by `on: false` or by `locked: false`; a door is opened by `position: open`,
  `command: open` or a position or percentage above zero. A rule holds for the channel category (`lock`,
  `alarm`, `door`) on any device and for every channel of a device of that category. Garage doors and gates are
  `door` channels. Locking, arming, closing and stopping are allowed, and so is the siren.
- **Not covered:** valves and window coverings - irrigation and blinds are what automations are for - and a
  garage door that an integration exposes as a `window_covering` on a device that is not a `door`. Such a device
  has to be adopted with the door category to be protected.
- **An action declares what it does.** An action node type lists, with `commands(config)`, the values it writes
  and the scenes it runs. The policy judges that list, so it does not know the cards and a card of a plugin is
  covered as soon as it declares its commands. An action that declares nothing is not judged; a card that acts on
  the home and declares nothing is a bug in that card.
- **Three points, one policy.** On save, an unsafe write is the error `safety_reducing_action` on its node and
  field; it stops the save whether the automation is enabled or not, so not even a draft can hold it. Before
  every action of a run the engine asks the policy, which reads the categories of the properties again; a
  refusal is traced as `refused` and takes `error`. A scene is opened and all its enabled actions are read as
  they are at that moment; one unsafe action refuses the whole scene. On save a scene that would be refused is
  a warning only, because the scene is judged when it is run, not when the automation is saved.
- **The scene runner checks once more.** Between the policy reading a scene and the scene running, the scene
  can be edited. `SceneExecutorService.triggerScene` therefore takes an optional guard that is handed the very
  actions the run is about to execute, before an intent is created; automations always pass one. Runs from the
  panel, the admin, Buddy and MCP pass none and are unchanged.
- **What can not be checked is refused.** A policy that throws, rejects or does not answer within the timeout
  of the action refuses the action. A scene action that names no property - a future scene platform the policy
  can not read - refuses the scene. A property or scene that no longer exists is not a finding: the action
  fails on it by itself.
- **The action policy of the engine may answer later**, since it has to read the database. A policy that
  answers at once is not waited for, so nothing changes in the timing of an engine without one.

### 19. Intent origin of an automation

Added with AU-7.

- **One origin, set on the server.** `IntentOrigin` has the value `automation`. The built-in actions hand
  `{ origin: 'automation', extra: { automationId } }` to `PropertyCommandService.executePropertyCommands` and, as
  the third argument, to `SceneExecutorService.triggerScene`; the second argument of `triggerScene` is only the
  `triggeredBy` label and never reaches the intent. A scene runs its actions under its own intent, so they carry
  the origin too.
- **A client can not claim it.** The command context a client sends (`DevicesModulePropertyCommandContext`)
  takes `INTENT_CLIENT_ORIGINS`, the list as it was. Otherwise any client could hide what a person does from
  Buddy by naming the origin. The request schema is therefore unchanged; the origin reaches clients only in the
  context of the intent events.
- **Buddy does not learn it.** `ActionObserverService` drops a completed intent with this origin before it gets
  to the buffer, so pattern detection, scene suggestions and the "recent actions" context never see it.
- **"Automation" is not scene vocabulary.** The word is removed from `SCENE_SIGNALS` and from the scene patterns
  of the planner grammar (decision 14). Until Buddy has automation tools the word means nothing to it: "run the
  Morning automation" is asked about instead of running a scene, and next to a device noun ("start the garage
  door in automation mode") the request is a plain device request.

### 20. Run history as built

Added with AU-13; decision 12 names the storage and the limits, this records how the history is written.

- **One row per run**, in `automations_module_runs`, with the identifier the engine gave the run - the `run_id`
  a manual trigger answers with leads straight to the record. The trace is one JSON document in the wire
  format: what started the run, and per node reached the edge it arrived on, the output taken, what a condition
  observed, what an action answered, and whether it was refused, timed out or finished after the run had ended.
  The runs of an automation are deleted with it (foreign key, cascade).
- **Written once, when the trace is complete**, not when the outcome is known. For a run that was not cancelled
  both come together. A cancelled run whose node is still executing is written when that node returns or
  reaches its timeout; should the engine stop before that, the run is written with the trace it has.
  `last_run_status` of the automation is still written when the outcome is known, so a run costs two small
  writes: the automation row and the history row.
- **The `running` marker carries the trace up to the Delay.** A run that parks is written at that moment as
  `running`, with the steps it took so far, rewritten every time it parks again and when it ends. After a power
  cut the record therefore still says which Delay never let the run go on.
- **Leftover `running` rows become `interrupted` before the engine loads the automations**, with the reason
  `backend_restarted` and no end time: when the run stopped is not known. `last_run_status` of the automation
  follows, unless a later run has ended since. A run that is active when the engine stops in an orderly way is
  ended by the engine itself, with the reason `engine_stopped` and an end time.
- **Retention.** The last 50 runs of an automation are kept, enforced on every write of that automation; runs
  older than 30 days are deleted nightly and when the engine starts, whatever the count.
- **Trace size.** A stored trace takes at most 128 KB as JSON, counted in UTF-8 bytes. A value a card
  reported - what a condition observed, the data of a trigger - that takes more than 2 KB is replaced by a
  note; when the document is still too long, the last steps are left out. Either marks the trace as `truncated`. A run of the 1,000
  steps the walker allows does not fit and is stored truncated; such a run has failed at the step limit.
- **A run that never waited and is still executing has no record.** The history lists what ended or parked.
  The live state is the `runtime` endpoint and the events below.
- **Events.** `AutomationsModule.Run.Started` and `AutomationsModule.Run.Completed` go over the bus, and so to
  every owner and admin socket, with the run but without its trace. `Run.Completed` is sent after the row is
  written, also when the write failed, so a client that follows a run always learns that it is over. It is
  sent once per run: a run written by an engine that stopped and rewritten when it settles is not announced
  again.
- **Step events never go over the bus.** `AutomationsModule.Run.Step` is sent straight to the websocket room
  of one automation. A client enters the room with the `AutomationsModule.WatchAutomation` command and leaves
  it with `AutomationsModule.UnwatchAutomation` or by disconnecting; both commands are owner and admin only,
  and a room is opened only for an automation that exists. While nobody watches, a step costs one look at an
  empty room. For this the websocket module gained two small things: a command handler is handed the socket
  of its command as far as joining and leaving a room goes, and the gateway can send an event to one room.

### 21. Event, house mode, security and automation cards

Added with AU-17.

- **One listener per event.** `AutomationEventSourceService` holds the only listener of the module for button
  occurrences, device connection changes, scene runs, house mode changes and security transitions, and hands
  each event to the armed triggers, as the state tracker does for property values.
- **Typed security transitions.** The security module emits `SecurityModule.State.Changed` with
  `{ kind: 'armed' | 'alarm', from, to }`, once per state that changed. It is emitted by the state listener as
  soon as a recalculation has aggregated the status, before the alert bookkeeping and `security:status`, which
  is unchanged, so a failure there can not lose a transition. The first read that knows a state is its
  baseline, not a transition, and a state lost to a failing provider neither sets the baseline nor is taken as
  a change to "none".
- **Connection triggers fire on online/offline transitions only.** The state a device is in when the watch
  starts is read as the baseline; a change between two online states (`init` → `ready`), two offline states
  or to `unknown` starts nothing, and while the state before is not known the first change only sets it.
- **Arming is a declared device write.** "Arm alarm" points at the `state` property of an `alarm` channel and
  declares the write with `commands()`, so the safety policy judges it like any write. It offers only the armed
  states; there is no disarm card, and a `disarmed` write through "Set device value" stays refused (decision 18).
- **The house mode** is read from and written to the system configuration, the same change the panel and the
  admin make, so the house mode actions and `SystemModule.HouseMode.Changed` follow. Setting the mode it
  already has writes nothing.
- **Acting on another automation.** Enable and disable save the other automation through `AutomationsService`
  at the revision just read, retrying on a revision conflict, so enabling checks its graph as the API does; an
  automation already as asked is left alone. Run uses the path of the manual run (`triggerOrThrow`) and does not
  wait for that run. An automation never acts on itself - running itself would loop and disabling itself would
  cancel the run doing it - which is refused when the action runs, as the configuration does not know the
  automation it belongs to. The automation named is a reference, so one that is deleted marks the automation
  `invalid`.

## Consequences

- The design doc is updated to match this ADR.
- Scope added to the epic: house location in the system configuration (AU-16), the automatic activation source in
  `spaces-home-control` (AU-18), the Buddy synonym fix and text corrections (AU-7 and AU-22), action timeouts and
  the second rate window (AU-4), hysteresis (AU-3).
- Scope reduced: the Delay limit drops to one hour.
- Open after this ADR: write grouping when parallel branches target the same device (settled in AU-4, see
  decision 16); behaviour of time conditions before the system clock is trustworthy on hardware without a
  real-time clock (settled in AU-5, see decision 17); how the run history is written and how step events
  reach only the clients watching (settled in AU-13, see decision 20); verification on Firefox, Safari and a
  physical touch device (AU-27).

## Environment note

The backend's dependencies could not be installed in the session that ran the spike: the `shellies-ds9`
dependency is fetched as a GitHub tarball and that download was refused. The engine prototype therefore ran
outside the backend test setup. This does not affect the decisions but must be resolved before AU-1.
