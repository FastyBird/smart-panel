# Virtual devices: aggregation, groups and climate controllers

Status: draft for architecture review
Date: 2026-10-13
Tracking: [#1409](https://github.com/FastyBird/smart-panel/issues/1409)

## Completion contract

The completed wiring implementation remains supported. The next virtual-devices milestone is complete only when all
the capabilities below work through backend, admin authoring, panel controls, scenes and space intents, with persistent
configuration, source repair, diagnostics and regression tests.

| Capability         | Required behavior                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregate sensor   | Combine several temperature measurements into one ordinary read-only temperature sensor. Support mean, median, minimum and maximum; expose freshness, membership and exclusions.                                              |
| Numeric converter  | Convert one physical numeric input with an explicit affine, piecewise-linear or NTC beta policy. Preserve quantity/unit validation, source age, unavailable states and create/edit/preview/repair support. |
| Actuator group     | Present several physical light channels as one controllable light. Broadcast supported commands, derive reported state, expose mixed/partial state and account for every member result.                                       |
| Virtual thermostat | Regulate heating and cooling from a physical or aggregated room sensor. Support heat, cool, auto and off according to configured outputs, floor overheat protection, physical window contacts and automatic window detection. |

All four device types in the table, including the standalone numeric converter, are required for milestone completion.
Native Shelly helper ingestion and numeric converters are separate required features; one does not replace the other.

The floor sensor's primary purpose is protection: when its configured threshold is reached, heating must be released
even if the room still demands heat. Displaying floor temperature is supplementary. It is not blended into the ambient
comfort measurement and is not a second comfort setpoint.

This milestone supersedes the previous suggestion to start controller delivery with `heating_unit` and `water_heater`.
The user's minimum includes a heating/cooling thermostat. The other five previously blocked categories can use the
resulting controller profiles later; delivering all six is not a prerequisite for this milestone.

## Existing architecture and gaps

The following references describe existing code, not capabilities already delivered by this proposal:

- [`VirtualChannelPropertyEntity`](../../../apps/backend/src/plugins/devices-virtual/entities/devices-virtual.entity.ts)
  has a single nullable source FK and `SOURCE`/`LOCAL` origins. `LOCAL` currently contains read-only metadata.
- [`VirtualDevicePlatform`](../../../apps/backend/src/plugins/devices-virtual/platforms/virtual-device.platform.ts)
  refuses local writes and virtual sources. It groups one-source updates by physical device, then calls each source
  platform directly. Its boolean result cannot represent individual group outcomes or durable controller interlocks.
- [`PropertyValueSourceRegistryService`](../../../apps/backend/src/modules/devices/services/property-value-source.registry.service.ts)
  resolves one storage key synchronously. Keep this responsibility; do not make it an expression evaluator.
- [`PropertyValueService`](../../../apps/backend/src/modules/devices/services/property-value.service.ts) refreshes
  cached timestamps for unchanged reports, skips null/invalid writes and stores changed numeric history. A value-change
  event is not a sample heartbeat, and writing null does not invalidate the last live value.
- [`VirtualProjectionListener`](../../../apps/backend/src/plugins/devices-virtual/listeners/virtual-projection.listener.ts),
  status/index listeners, source validators and admin source pickers assume virtual sources cannot exist. Their guards
  must be changed together, rather than removed in one place.
- [`PropertyCommandDispatchService`](../../../apps/backend/src/modules/devices/services/property-command-dispatch.service.ts)
  and [`PropertyCommandWindowService`](../../../apps/backend/src/modules/devices/services/property-command-window.service.ts)
  supply physical command validation, generations and convergence. In-memory expiring windows are not a durable
  opposed-actuator interlock.
- [`SpaceLightingStateService`](../../../apps/backend/src/plugins/spaces-home-control/services/space-lighting-state.service.ts)
  already contains lighting consensus and mixed-state calculations. Extract suitable pure helpers, keeping room
  orchestration out of the virtual plugin.
- [`SpaceClimateStateService`](../../../apps/backend/src/plugins/spaces-home-control/services/space-climate-state.service.ts)
  currently gates reported activity by user enable. A failed release after OFF must remain active/unknown, rather than
  becoming idle merely because enable changed. Panel heater/cooler channel views already read reported status directly.
- [`spec/devices/devices.yaml`](../../../spec/devices/devices.yaml) permits one ambient temperature channel on a
  thermostat. Floor display needs an explicit separate semantic role in the contract and corresponding clients.

The original [controller constraints](2026-07-31-virtual-devices-design.md#controller-support) remain relevant, especially
exclusive actuator ownership, release priority, asynchronous confirmation and restart recovery. Read
[`docs/climate-architecture.md`](../../climate-architecture.md) for the domain; current service paths are under
`plugins/spaces-home-control`, rather than the older `modules/spaces` locations in that document.

The user also requests a separate numeric conversion device: transform a source value X into a derived measurement Y.
It shares measurement quality and dependency infrastructure; conversion logic does not belong to the thermostat.

## Initial qualification target

The first requested installation uses Shelly for the actuator, Zigbee for ambient temperature and Shelly for floor
temperature. The initial Zigbee adapter is the existing Zigbee2MQTT integration. There is currently no physical window
contact in that installation, so automatic window detection must work independently. Physical-contact support is a
minimum capability, while configuring contacts is optional for each installation. Shelly generation/model and installed
equipment protections are qualification inputs, not guarantees inferred from the brand. The spike must distinguish NG
and v1 protocol capabilities and record which concrete profiles it proves. It must not operate the user's live hardware
without an explicit hardware test task.

The user has now identified the actuator as Shelly 1PM Gen2 and the floor probe as a thermistor on its analog input.
Shelly's helper already returns Celsius, but the current integration exposes the raw voltage instead. VD2-1b must
adopt and observe the functional helper output with its quantity/unit/configuration identity, rather than repeat that
conversion in the thermostat. Confirm exact model ID, firmware, peripheral/component and helper configuration before
hardware qualification. DS18B20 fixtures demonstrate a separate supported protocol, not this installation's probe.
For native analog helpers, validate transformed `xpercent`/`xvoltage` and configured unit/expression together; a
missing/null/error transformed result must never silently fall back to raw percent or voltage under a Celsius label.
Do not assume script-managed `Number` virtual components exist on every Gen2 model.

### Pilot source evidence to prove in VD2-1 / VD2-2a

Shelly NG is the first candidate adapter, subject to the exact model qualification. The current pinned library can
accept a timed switch command, but the plugin's normal setter does not pass that timer. The spike must prove timed ON,
actual output feedback, failure/timeout behavior and a release that cannot be followed by an old queued ON. Shelly v1
is not assumed to have the same adapter contract.

Sensor evidence needs integration changes as well as a core signal. NG component polling may suppress unchanged values;
invalid temperature/error reports currently need explicit consumer-quality invalidation. Add-on floor temperature may
be discovered at adoption without a runtime component delegate in a fixed model descriptor. Prove both discovery and
subsequent notify/poll handling for the selected Shelly floor source. A cached or retained Zigbee replay is not a fresh
measurement: carry live/cached/retained provenance and source timestamps through the sample boundary, and test startup
replay before allowing the thermostat to use that input. Receiving an old value again must not launder its age.

## Shared model

Keep one `devices-virtual` plugin with explicitly typed modes:

1. `projection`: existing split/composed wiring, unchanged default for all existing rows and API payloads.
2. `sensor_aggregate`: read-only materialized measurement with typed aggregate inputs and policy.
3. `actuator_group`: materialized reported values plus a member command expansion plan.
4. `climate_controller`: local user settings, sensor dependencies, physical actuator bindings and controller runtime.
5. `sensor_transform`: a separate read-only numeric measurement with one physical input and typed conversion policy.

Mode and configuration revision are durable. Use dedicated binding entities with foreign keys, stable edge identities
and typed/versioned policy configuration. Do not store an unvalidated list of source UUIDs or executable expressions in
a generic JSON blob. Initial entity/table boundaries:

- Aggregate configuration and aggregate-input rows, owned by the output property.
- Transform configuration and one source binding, owned by the materialized output property.
- Light-group membership and per-property member bindings, owned by the group.
- Climate-controller configuration, source-role bindings, exclusive physical actuator claims and durable runtime state.

Every nullable source FK uses deletion behavior that preserves a missing-member edge for diagnostics and remap.
Retain the original source identity separately; deletion must not silently reduce quorum or switch to another actuator.
Ordinary owner deletion cascades owned configuration/bindings. An active controller must first complete its release
handshake; unresolved commands retain a durable suspended/tombstone record instead of being cascade-deleted.
Enforce uniqueness, ownership and deletion behavior in both entity
decorators and incremental migrations, since synchronized test databases and upgraded installations use different paths.

Add `DERIVED` as a distinct value origin for materialized reported outputs. It owns its property series, is not an alias,
and is not generally writable. Update all origin getters explicitly: the current `isProjecting !== LOCAL` rule would
misclassify it. Legacy undefined/default origin still means `SOURCE`. Controller settings remain typed `LOCAL` outputs
with a narrowly allowed command path; activity, sensor readings and diagnostics remain read-only.

Separate scalar value from producer state:

- `quality`: good, degraded or unavailable, with stable reason codes.
- `sampled_at`: conservative timestamp of contributing source samples; `evaluated_at` is separate.
- Config revision, contributing/excluded member identities, upstream quality and command state.
- Optional last-good value for inspection, explicitly ineligible as a fresh control input.

An invalidation operation clears the served live value while retaining history. It must affect core API reads,
WebSocket clients and controller input checks consistently. A plugin-only admin diagnostic beside a stale scalar is
insufficient. Check expiry again at control/read boundaries, so a delayed evaluator cannot authorize stale control.

### Core value boundary and client rollout

VD2-2a owns the core `modules/devices` accepted-sample notification, producer-state registry and explicit derived
invalidation API. Emit the sample signal only after a valid provider sample is accepted, including unchanged samples;
invalid/null inputs never count as fresh observations. Retain ordinary physical null-write semantics. Derived producer
invalidation is a different internal operation, not a change making every physical null report erase history.

Measurement `sampledAt` is normalized UTC source time and controls freshness. At the accepted-sample boundary require
finite timestamps with `sampledAt <= receivedAt <= serverNow`; reject future timestamps without a positive skew
allowance. A rejected live temporal report revokes qualification but cannot install an untrusted ordering watermark
that prevents corrected-clock recovery. Cached/retained replay cannot recover qualification. Control/read boundaries
also reject negative sample ages after a server-clock rollback. Test future, exact-boundary, past, expiry and corrected
clock recovery. Legacy `PropertyValueService.write` timestamps and persisted history never establish control freshness.
Command admission uses a separate
internal server-clock `observedAt`: poll request start, or notification capture before asynchronous processing.
An active command window requires live evidence observed after the window opened; missing causal evidence is held.
Neither a skewed device clock nor a late response's receipt time proves that the observation followed a command.

API hydration, bounded/latest reads, WebSocket value-state serialization and controller input reads apply the producer
quality/expiry overlay. History remains intact, and unchanged reports do not manufacture additional energy deltas.
Physical API/value/energy behavior is unchanged when no derived producer owns the property. Give quality transitions
an explicit event even when the last numeric value is unchanged. A stale cached value cannot bypass this read seam.

`value_origin` is public, so adding `DERIVED` requires regenerated admin and Dart clients and explicit virtual property
mapper support. New device mode is additive only on virtual models and defaults to projection for old payloads. Deliver
client parsing support before enabling creation of non-projection modes in the supported deployment. Test old projection
payloads, unknown optional fields and new-origin parsing; do not claim old strict generated clients can parse a new enum
member without an update. Generated files come from source. Optional floor measurement is a property on the existing
thermostat channel, not a second ambient channel. A new client hides absent optional fields when talking to an older
backend; older clients do not author new modes.

## Dependencies and composition

Required composition includes `physical temperatures -> aggregate sensor -> thermostat` and
`physical numeric input -> transform sensor -> thermostat` (or transform sensor -> aggregate -> thermostat).
Permit read-only materialized aggregate/transform outputs with canonical temperature semantics as sensor sources.
Transforms initially accept physical inputs only; aggregates accept physical temperatures and qualified transformed
temperatures. Preserve the prohibition on writable virtual forwarding and arbitrary
alias chains until those paths have their own deliberately designed resolution rules. Light groups initially accept
physical light channels. Thermostat outputs initially claim physical readable/writable actuator properties.

Build an explicit bounded dependency graph for aggregate edges, permitted derived projections and controller sensor
roles. Include cycle, self-reference, depth, node and fan-out limits. Validate and serialize graph edits inside the same
transaction that persists them: simultaneous A-to-B and B-to-A must not both pass an optimistic preview. Compatibility
preview and persistence share the same validation function. Revalidate at startup and quarantine malformed components.

Runtime propagation is bounded and topological, with coalescing and revision fences. Stale evaluations, remaps and
late source responses cannot overwrite newer state. Emit immutable snapshots and quality changes even when the numeric
value is unchanged. Replace the virtual-source listener shortcuts for the supported graph edges and retain defensive
runtime traversal guards. Hardware input occurrence forwarding keeps its existing one-hop semantics in this milestone.

Include every binding type in reverse source indexes, connection evaluation and system-hidden reference sweeps.
Sources stay visible unless the operator requests replacement/hiding. Hiding preserves manual provenance and is not
exclusive ownership. Unhide only system-hidden sources after their last reference disappears; preserve `enabled`.

Ordinary projection availability retains its current all-required-sources policy. Aggregates use quorum; groups use
member availability; controllers use mandatory-input and actuator readiness. A single shared worst-source rule would
incorrectly prevent partially available lighting groups from dispatching to their reachable members.

### Binding and graph decisions

The thermostat's ambient binding points directly at the aggregate's materialized output property UUID. If its displayed
ambient property is a projection, `sourcePropertyId` points at that same UUID. A single-hop storage-key lookup therefore
returns the aggregate's own series; it never dereferences another projection or runs an aggregation expression.

Relax `SourceNotVirtualConstraintValidator` and compatibility selection only for explicitly eligible read-only derived
measurement rows. Update projection/index/status propagation and admin mapping/remap pickers for those rows. The
platform's virtual write rejection and prohibition on projection-of-projection remain. Guard controller source roles
through the same backend candidate policy, not a UI-only filter.

Graph mutation uses the existing global, re-entrant `DeviceStructureLockService` exclusively before entering the
serialized SQLite transaction boundary. Inside the transaction reserve/check the authoritative graph revision before
validating committed bindings, then apply bindings and revision together. Every participating graph edit follows the
existing structure-lock-before-transaction order, including generic property mutations. Adding a plugin graph lock
before that existing lock would invert the order used by core structural writers. A DTO preview alone cannot prevent
cross-device cycle creation. A separate writer process must reserve the same database revision before its validation
read. Actuator unique constraints remain the ownership backstop; real SQLite interleaving tests must prove the
revision/transaction algorithm.

## Aggregate sensors

Initial output: ordinary `sensor` device with `temperature.temperature` in the schema's canonical Celsius contract.
Accept at least two distinct compatible finite numeric sources. Support `mean`, `median`, `min` and `max`. Reserve
weighted mean through a typed operator extension point; do not add temperature sum or energy-counter arithmetic.

Policies are explicit and editable:

- Per-aggregate freshness limit appropriate to the actual source reporting cadence.
- Fixed minimum valid-source count, defaulting to all configured sources. Missing/deleted sources remain configured.
- Exclude missing, stale, invalid/sentinel, incompatible and definitively offline inputs. Unknown connectivity needs a
  demonstrably fresh valid measurement; it is never assumed to mean off or zero.
- Require compatible quantity, datatype and exact unit. Conversion is an explicit upstream transform device, never relabeling.
- No implicit outlier exclusion. Median is a transparent robust option; future filtering must expose exclusion reasons.

Use a stable input order, fixed evaluation clock, deterministic median and numerically stable mean. Round only the
final result to output precision. Propagate the oldest contributing sample time so another source's new report cannot
make an old reading fresh. A quorum-preserving member loss yields degraded data; quorum loss clears live data.

Reevaluate on accepted source samples including unchanged values, connectivity, metadata/source deletion, remap,
configuration, startup and expiry deadlines. The shared value boundary needs an accepted-sample signal; a bounded tick
is also required as an expiry backstop. After restart, an old persisted value does not prove a recent unchanged report.
Be conservative until fresh evidence arrives.

Expose input membership, individual current values, sample ages, exclusion reasons and aggregate operator in the admin
detail section. Preserve output property identity and history when members are remapped.

## Numeric conversion sensors

Keep conversion outside the thermostat and outside aggregate operators. A persistent `sensor_transform` owns an
ordinary read-only numeric output, its quantity/unit, one physical source and a versioned typed operator. Initial
operators are affine `Y = scale * X + offset`, piecewise linear interpolation from explicit calibration points, and an
NTC beta profile for raw divider voltage. They are bounded configuration, not JavaScript or arbitrary executable text.
Reusable pure numeric helpers may be shared with integration transformers, while source eligibility, quality and
persistence remain plugin responsibilities.

Affine coefficients must be finite. Calibration X points must be finite, strictly increasing and unique; configured
points define the domain, with no implicit extrapolation. The NTC profile requires explicit supply/reference voltage,
series resistance, nominal resistance and its reference temperature, beta coefficient and divider orientation. No
electrical or probe parameters are guessed. For an NTC on the low leg, use
`R = Rseries * V / (Vref - V)`; for the high leg use `R = Rseries * (Vref - V) / V`. Then
`Tkelvin = 1 / (1 / T0kelvin + ln(R / R0) / beta)` and convert to Celsius. Reject zero/rail voltage, invalid resistance,
nonpositive Kelvin/denominator and nonfinite results. A declared valid input/output range is enforced without clamping.
Every operator must reject nonfinite computed outputs before publication, including affine overflow and piecewise
interpolation overflow. Retain the NTC-specific domain checks and report computation failure as unavailable.

Helper output that is already Celsius is ingested as a qualified physical temperature by the Shelly adapter. It does
not pass through another thermistor calculation. A transform can explicitly provide calibration or quantity conversion
for another source, including a generic numeric output; only a temperature-profile output in canonical Celsius is
eligible for thermostat or temperature-aggregate roles. Changing source unit, helper expression/peripheral identity or
operator configuration invalidates the old revision until the new contract is validated and fresh evidence arrives.

Derived quality and timestamps use the original qualified source sample. Evaluating the same cached value again never
renews freshness. Missing, stale, invalid/sentinel, offline, out-of-domain or computation-error input clears live output
while preserving history. Remap/edit preserves output UUID/history, and restart awaits fresh eligible evidence.
Admin supports authoring, preview against supplied sample values, edits, source repair and diagnostics. Panel shows
the normal quantity control/presentation with producer quality. Preview and persistence use the same operator validator.
Tests cover all operators, source clock/expiry, null/error/domain boundaries, configuration revisions, deletion/remap
and transformed-temperature -> aggregate/thermostat composition. Input sharing follows the same room contribution
rules as other composite temperature sensors, so raw/transformed sources are not counted twice.

## Actuator groups

Initial profile: multiple physical `light` channels, including several channels of one physical device. Reject empty
groups, duplicate members and virtual members. Ordinary groups may overlap and their members remain individually
commandable, except when a physical property has an exclusive controller claim.

Expose common capabilities across all configured members:

| Property          | Command and compatibility rule                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| On                | Required common readable/writable boolean; absolute on/off broadcast.                                     |
| Brightness        | Expose only when every member supports a compatible numeric range and step.                               |
| Color temperature | Common quantity/unit and valid common range/step.                                                         |
| Color             | Complete common representation, initially RGB or hue/saturation; do not silently convert or omit members. |

A dimmable light plus an on/off light produces an on/off group. Preview explains unavailable optional controls.
Intersection includes permission, datatype, enum/range, step and complete compound color tuples. Persist the validated
group contract; membership edits that would remove a referenced capability must return a repair conflict instead of
silently removing a property used by scenes or tiles.

Reported state derives from feedback, never the last requested command:

- `on` uses three-valued any-on logic: a confirmed on member establishes true; all confirmed off establishes false;
  otherwise unknown. Expose all-on and mixed/member counts separately.
- Brightness may use a representative mean of valid on-member brightness with an explicit mixed flag and contributors.
- Color/temperature show a consensus value within documented tolerance, otherwise mixed/unknown. Do not average
  opposed hue values into an arbitrary selected color.
- Missing/stale/offline members remain unknown. All unavailable members make the group unavailable; partial
  availability remains controllable with truthful partial outcomes.

Add an opt-in composite command planner at the core command boundary. It expands the group request into canonical
physical property commands, snapshots binding revision, deduplicates leaves, validates all metadata/platforms and rejects
contradictory targets before dispatch. Reuse physical admission, prepared platform targets, generations and convergence;
do not bypass them by invoking member platforms directly from a loop in the virtual platform.

Parent tracking contains every intended member and its child outcome: accepted, confirmed, failed, unavailable,
superseded or timed out. Bound member count, concurrency and total deadline. Attempt independent valid members despite
another member failing; isolate exceptions. Parent success requires every intended child to confirm its prepared target.
Any-on becoming true or aggregate brightness matching does not confirm all members. Report partial completion without
pretending hardware rollback is atomic. Preserve correlation and fence late confirmations after a new command or remap.

Do not expose synthetic energy counters in initial groups. Physical meters retain existing attribution. A future sum
must deduplicate physical leaf meters and define accountable billing across overlapping groups.

### Group completion and room participation

The intended set is all configured members in the admitted binding snapshot, including unavailable ones. Unavailable
members terminate as unavailable rather than disappearing from the result. The parent becomes terminal once every child
is terminal or the bounded parent deadline expires:

| Terminal result | Meaning                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| confirmed       | Every intended child confirmed its prepared target.                                    |
| partial         | At least one child confirmed; another is unavailable, failed, superseded or timed out. |
| failed          | No intended child confirmed.                                                           |

UI leaves pending state at the terminal result and shows member details. A scene step counts only `confirmed` as full
success; partial contributes confirmed member outcomes to the scene's partial result and does not abort unrelated
scene actions. Existing legacy platform booleans keep their contract; the opt-in composite dispatcher carries detailed
child outcomes rather than pretending partial is a successful boolean.

Room presentation uses an explicit contribution planner. A selected aggregate/group represents its physical leaf set,
and raw members in the same room are excluded from that presentation calculation and expanded command plan. Apply this
to both climate measurements and lighting consensus/counts. Raw members remain visible/individually usable elsewhere.
If selected composites overlap in a room, report a coverage conflict and require selecting a room representative or
changing participation roles; do not silently give duplicate measurements/actuators extra weight. Command expansion
still deduplicates equal canonical leaf targets and rejects contradictory targets before dispatch. The thermostat
always regulates its own configured ambient input, never an implicit room average. VD2-10 covers duplicate raw/aggregate
and raw/group cases, and overlapping composite role conflicts.

## Virtual thermostat

### Contract and control algorithm

Use the existing thermostat/heater/cooler schema for ordinary controls. Require at least one qualified actuator and an
ambient sensor; expose heat/cool/auto only when the corresponding actuators exist. `AUTO` enables both capabilities,
not simultaneous actuation. Keep user enable/requested mode, confirmed physical activity and pending/fault separate.

Sensor role bindings are explicit: ambient, optional floor guard, and window contacts. Floor temperature is not another
unlabelled `temperature` channel. Add optional read-only `thermostat.floor_temperature` through spec source and
generators, with the explicit floor role in controller configuration, then extend the panel's sensor section. Keep the
existing single ambient temperature channel. Existing physical thermostat contracts remain compatible.

The initial algorithm is deterministic hysteresis, with explicit heating and cooling setpoints, tolerances, minimum
off/changeover intervals and maximum-on qualification. Validate the merged persisted heating/cooling pair, including
sequential single-bound commands. Require `cooling_setpoint - heating_setpoint >= cold_tolerance + hot_tolerance + neutral_margin` for the symmetric
thresholds below, with positive neutral margin. Reject incompatible
values instead of silently clamping a control request.

Normal thresholds: heating starts below its lower threshold and releases at its upper threshold; cooling starts above
its upper threshold and releases at its lower threshold. Ordinary cycle protection may delay energizing or a non-safety
changeover. User OFF, protective floor limit, invalid mandatory data and a window pause dispatch release immediately.
All inhibiting policies, including a heuristic window pause, request OFF immediately. This profile has no
minimum-on rule that delays a release; its cycle protection gates subsequent energizing/changeover. Configured release
retries remain active until confirmed; retry timing is bounded and visible.

### Floor overheat guard

The operator enables this guard for heating variants that need it and supplies a valid physical floor sensor, a maximum
floor temperature and recovery hysteresis. There is no universal hardcoded safe floor temperature; configuration belongs
to the installed heating/floor system.

- Floor sample `>= limit`: immediately demand heating OFF, independent of ambient demand and cycle minimum.
- Configured sensor missing, invalid, unavailable or stale: prohibit heating and demand release of an active heater.
- Release pending or failed: report that fact and retain the physical activity/unknown state; do not report idle from
  intent alone.
- Resume only below `limit - recovery_hysteresis`, with valid fresh floor and ambient inputs and no other inhibit.
- Changing the threshold below the current floor temperature applies the same immediate protection; every configuration
  write queues reevaluation through the controller serializer.

Guard enabled/disabled, threshold, actual floor measurement and active protective reason are visible. Guard activation
requires a heating branch; a cooling-only controller rejects enabling a heating floor guard. Turning the guard
off is an explicit configuration change, not a fallback when its sensor fails. Floor sensing supplements independent
actuator/equipment protection; an in-process sensor check cannot release hardware when the backend itself is gone.

### Windows and automatic detection

Accept one or more configured physical window contacts with an explicit open-value mapping. Any confirmed open window
inhibits heating and cooling after a configured debounce. Debounce both opening and closing, with independent configured delays. At startup an unobserved configured contact is
unknown and inhibits control. All mandatory contacts must be freshly closed before normal
resume; unavailable contacts cannot be treated as closed. Preserve the user's mode and setpoints during the pause.
When the pause ends, reevaluate the latest user configuration rather than replaying a saved pre-pause ON command.

Automatic detection is a minimum capability and must pause and recover independently when no physical contact is
available. Enabling it is optional when configured physical contacts provide the window policy. It is a
temperature-trend heuristic with a separately reported `suspected_open` reason.
For heating use a sustained falling trend; for cooling use a sustained rising trend. Configure sampling window, minimum
samples, slope threshold, confirmation duration, recovery/cooldown and maximum heuristic pause. Do not treat startup,
aggregate membership/quorum changes, stale samples or a sensor replacement as a temperature trend. Rebaseline after
those events. Contact evidence is authoritative: closing a heuristic pause must not override a still-open contact.

An expired heuristic pause triggers reevaluation only; it cannot bypass floor protection, contact state, missing data,
user OFF or actuator interlock. Make heuristic enable and thresholds explicit, since an inferred window state can be
wrong. Test heating and cooling directions independently.

### Inhibits and diagnostic precedence

Evaluate all reasons rather than stopping at the first match. Any release-demanding reason forbids energizing, even
when a different reason owns the headline diagnostic. Priority for the headline is unresolved actuator/interlock fault,
mandatory-input fault, user OFF, floor overheat, physical window, estimated window, cycle/changeover wait, comfort demand.
Floor protection applies to heating; window/user/input policies apply to their configured branches. Cycle timers never
postpone release, and clearing one reason never clears another. Preserve the full reason set for admin diagnostics.

### Actuator ownership, confirmations and restart

Keep actuator bindings separate from exposed sensor/setpoint properties. Claim each canonical physical leaf with a
database-enforced unique controller ownership constraint. Concurrent controller creation must not claim the same relay.
Every application command path, including scenes, writable projections, group expansion and direct commands, consults
the claim registry. Ordinary commands to a claimed actuator are refused with a repairable conflict; controller release
uses a specifically authorized internal path. Hiding alone does not enforce ownership.

For the minimum, require readable/writable physical on/off actuator feedback and an explicitly qualified platform profile.
Supporting an arbitrary upstream thermostat/TRV or multi-relay actuator group is a later adapter, not an implied capability.
Actuator deletion/remap disables its loop and requires explicit repair; never auto-promote another relay.

Serialize decisions per controller device across both outputs. Persist outstanding energizing commands and cycle state
before dispatch. A pending or timed-out heating ON remains interlock-blocking for cooling, and vice versa. Timeout is
unknown, not confirmed OFF. Release only on evidence that an earlier energizing command cannot land after the release,
using qualified ordered/correlated command behavior or cancellation followed by confirmed OFF. An unrelated off readback
does not establish that an earlier ON has drained.

Startup reconciles durable pending commands and actual actuators before enabling evaluation. Persisted user mode does
not automatically authorize immediate energizing after a crash. A confirmed output state drives activity/status;
in-flight command state drives interlock admission. Destroy/disable/remap paths cancel jobs, prioritize release, and
retain unresolved release diagnostics rather than forgetting pending work.

Platform qualification is an explicit first delivery gate. Confirm support for ordered/correlated readback and equipment
fail-safe behavior. An actuator-local auto-off/dead-man timer handles backend disappearance; an independently enforced
maximum-on or high-limit protection handles a sensor that remains falsely low while reporting. Upstream writers need
exclusive configuration or equivalent protection; opposed outputs need hardware interlocking or rejection where this
cannot be established. Refuse unsupported combinations in preview and persistence. Do not claim software alone can
guarantee hardware shutdown during a process or network failure.

### Claim lifetime and restart policy

Ownership is a durable reservation separate from whether the controller currently demands ON:

| Ownership state     | Rule                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| configured/reserved | Claim is exclusive while configured, including user OFF and disabled controller.                                                                                     |
| releasing           | Disable, detach, remap or deletion demands OFF; keep claim and pending-command record until qualified release proof.                                                 |
| suspended/reserved  | Confirmed OFF but configuration still owns the leaf; external writers remain refused.                                                                                |
| missing/unresolved  | Deleted physical property leaves original identity and unresolved runtime evidence; no substitute actuator or automatic release of evidence.                         |
| released            | Explicit detach/delete after release proof, or operator acknowledgement of physically disconnected equipment; free the reservation and retain runtime audit history. |

The unique claim key is the canonical physical identity for every non-released reservation; a nullable live FK must not
silently free it. Enabling/disabling the controller does not transfer the relay to another writer. Device/actuator
removal and metadata mutation are checked against claims before commit; unresolved controller deletion retains a
suspended record. If source deletion has already happened, mark the loop missing/faulted and never report successful
hardware release from that database event. The admin repair path explains what evidence or equipment isolation is needed
for explicit release, rather than permanently hiding an unreleasable claim.

An injectable ownership registry mints a typed internal command context tied to controller ID, claim revision and leaf
identity. Public DTOs cannot supply it. Dispatch validates it against the current claim; release-only contexts authorize
OFF even while the owner is disabled but never authorize energizing. Qualification adapters must define safe handling
of an administratively disabled physical source. No generic public bypass flag is added.

| Startup condition                                                           | Behavior                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Pending/unresolved command or unknown opposed output                        | Reconcile/release; keep energizing blocked and expose fault/pending state.               |
| Missing/stale mandatory input or unqualified actuator                       | Keep suspended; do not synthesize fresh readings or OFF proof.                           |
| All release/ordering proofs, qualified outputs and fresh inputs established | Resume the persisted armed mode through normal cycle/guard checks. User OFF remains OFF. |

A new controller starts unarmed until its authoring readiness checks are complete and the operator enables it. After
restart it does not require another manual enable when safe reconciliation succeeds. Aggregate producers first evaluate
or declare unavailable; controllers then check their quality. Active heuristic holds survive restart, while trend
baselines warm up again from new samples. Disable/remove/remap never erases unresolved command evidence.

## Authoring, diagnostics and extensions

Admin creation starts by choosing wiring, aggregate sensor, group or thermostat. Show only relevant source roles,
validate through backend compatibility preview, and explain unavailable capabilities or qualification failures.
Creation is atomic; abandoning the wizard creates/hides nothing. Editing uses revisions and preserves device/property
identities. The existing plugin `deviceDetailSection` renders source/member/guard diagnostics.

Panel and space intents use existing category controls, with extra quality, mixed, partial, floor and pause/fault
presentation. All requested control paths are covered: individual device controls, room climate intents, scenes and
recovery after socket/fetch races. Fix requested-versus-actual activity in room aggregation without changing physical
device meanings silently. Apply the contribution planner described above so aggregate/raw sensors and group/member lights are not counted twice
in the same room. VD2-11 updates the climate architecture document to the current service paths and requested/activity
contract.

Future additions can register typed operators, actuator-group profiles and controller policies with versioned config,
validation, capability preview, evaluation/dispatch and cleanup contracts. Keep each concern in a small service, rather
than a single virtual-device engine. No arbitrary user code, template interpreter or new dependency is required.

Useful later capabilities, deliberately not added to the initial completion gate:

- Weighted sensor mean and explicit outlier filtering; humidity, CO2 and illuminance aggregates; binary any/all groups.
- Switch/outlet, fan and cover group profiles with their own command and mixed-state rules.
- Eco/comfort/away presets, timed overrides and occupancy/schedule integration through existing intent/automation paths.
- Derived quantities such as dew point; floor-cooling/condensation protection needs its own humidity and equipment policy.
- Qualified multi-actuator thermostat bindings, unit adapters and third-party operator registration through the SDK.

## Delivery and acceptance

Each row is independently reviewable; dependent features remain unavailable until their contract is complete.
Backend/API changes regenerate OpenAPI and clients from source. Keep review batches within CodeRabbit's file limit,
splitting generated artifacts into explicit dependent batches of no more than 100 files where necessary. CI and the exact-head main review gate
apply to every PR. Documentation or a basic relay prototype alone does not complete this milestone.

| Phase  | Deliverable                                                   | Completion evidence                                                                                                                    |
| ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| VD2-1  | Design and platform qualification                             | Resolve schema/command seams; runnable qualification spike; supported and refused actuator profiles documented.                        |
| VD2-2  | Shared model, producer quality/freshness and dependency graph | Incremental migration, sync parity, unchanged reports, invalidation, graph-race tests and preserved legacy projection API.             |
| VD2-3  | Aggregate sensor backend                                      | Four operators; deterministic timestamps/quorum; unavailable-state propagation; remap and startup tests.                               |
| VD2-4  | Aggregate sensor admin/panel                                  | Author/read/edit/repair one sensor from three sources; show exclusions; preserve output UUID/history.                                  |
| VD2-5  | Group model, reported state and command expansion             | Member capability contract, canonical child generations and truthful parent partial/confirmed outcomes.                                |
| VD2-6  | Group admin/panel                                             | Create/edit a real multi-platform light group, show common controls and mixed/partial state; room/scene commands work.                 |
| VD2-7  | Thermostat configuration, claims and local commands           | Qualified actuator claims, conflict mediation, setpoint/deadband validation and independent role-aware floor contract.                 |
| VD2-8  | Heating/cooling runtime                                       | Durable interlock/cycle recovery, confirmed activity, immediate protective release and bounded retry.                                  |
| VD2-9  | Floor and window policies                                     | Threshold/recovery/fault protection; contact aggregation; heuristic heating/cooling detection and pause precedence.                    |
| VD2-10 | Thermostat admin/panel/intents                                | Complete authoring and visible current/floor/guard/activity state; latest user settings survive pauses and restart.                    |
| VD2-11 | Full regression and documentation                             | End-to-end scenarios, physical/simulated adapter acceptance, lifecycle cleanup, existing projection/hidden/energy tests and user docs. |
| VD2-12 | Numeric conversion sensor backend                             | Typed operators, unit/domain validation, source-age propagation, revision fences and temperature composition tests.                    |
| VD2-13 | Numeric conversion authoring and panel                        | Create/edit/preview/repair a converter, show input/output/quality, preserve history and test legacy clients.                           |

VD2-1 must complete before VD2-7 actuator-profile work starts. Activation also requires the recorded hardware
qualification evidence; protocol fixtures alone do not pass that gate. Neither requirement blocks independent
aggregate/group work. VD2-1b owns production Shelly timed-ON, dynamic floor notify/poll handling and Shelly/Zigbee
live/cached/retained sample provenance after the VD2-2a core boundary is available; it must finish before VD2-7.
Split VD2-2 into VD2-2a (core sample/quality boundary and client parsing) and VD2-2b (virtual bindings/graph). After those
contracts merge, VD2-3 and VD2-5 can proceed in parallel; their respective admin/panel slices follow their API contracts.
Use GPT-6.1 Sol medium for ordinary backend/admin implementation and focused tests, high for controller admission,
concurrency and restart; a cheaper model may handle bounded mechanical generation/fixtures. Independent review uses
Sonnet medium when a cross-provider check is useful. Each task issue records exact file ownership, dependencies,
acceptance and its conventional PR title before delegation.

Core acceptance scenarios:

0. Shelly 1PM Gen2 analog helper reports Celsius as a temperature source. Helper null/error disables floor eligibility
   rather than substituting voltage. A separate numeric transform also produces a qualified temperature that can feed
   an aggregate or thermostat, with original sample age and tested domain/error behavior.

1. Three physical temperatures form one median/mean sensor; the thermostat consumes it. An unchanged fresh report
   refreshes freshness, a timer expires old data, and quorum loss releases active heat instead of reading a cached number.
2. Floor at the limit releases heat while the room is cold. Stale floor data cannot permit heating. Recovery requires
   the configured hysteresis and every other gate to be satisfied.
3. Window contact opens during heat/cool, then the user changes mode/setpoint during the pause. Closing the window
   reevaluates the new setting. Automatic detection distinguishes stable samples from membership changes.
4. Heating/cooling ON commands cannot overlap during concurrent triggers, failed release, delayed acknowledgement or a
   crash between dispatch and confirmation. Unknown prior commands remain blocking through restart.
5. A light group spans two platforms and several channels. One offline/throwing member does not conceal successful
   members; late old confirmations never complete a newer request; any-on/mean equality cannot falsely confirm all.
6. Concurrent create/remap/delete cannot introduce cycles, steal actuator ownership, silently remove members or alter
   manual hiding. Source replacement preserves virtual output identity and historical readings.
7. Ordinary wiring and physical devices preserve their existing contracts. Groups/derived sensors do not duplicate
   energy billing or cause recursive value/occurrence propagation. Test modules, timers and subscriptions close cleanly.

## External references

These are behavior references rather than a dependency or promise of exact Home Assistant compatibility:

- [Home Assistant Groups](https://www.home-assistant.io/integrations/group/): grouped entity control, any/all states,
  unavailable members and numeric aggregation.
- [Home Assistant Min/Max](https://www.home-assistant.io/integrations/min_max/): numeric operators and unit compatibility.
- [Home Assistant Generic Thermostat](https://www.home-assistant.io/integrations/generic_thermostat/): hysteresis and cycle
  settings. Its documented generic thermostat handles heat or cool; this milestone explicitly requires both outputs.

- [Shelly NG Switch protocol](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/): timed switching,
  output status and startup configuration. A protective OFF must not carry a flip-back timer.
- [Shelly NG Temperature protocol](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Temperature/): null readings
  and sensor errors must invalidate control eligibility.
- [Shelly Sensor Add-On](https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellySensorAddon/): peripheral identity and dynamic
  component discovery, which must be matched by runtime observation.
