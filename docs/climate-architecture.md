# Climate domain architecture

Climate intents for a space and local virtual thermostat control share the device property command path, but serve different scopes. The spaces home-control plugin gathers climate-capable devices in a space and applies a user intent. The virtual devices plugin owns a configured thermostat's input bindings, actuator claims, guard evaluation and physical output dispatch. A thermostat can consume a physical temperature, a read-only aggregate, or a qualified numeric conversion output. A floor input is a separate protective role; it is never averaged into ambient temperature.

## Current implementation map

| Concern                                                 | Source                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space intent HTTP entry                                 | `apps/backend/src/plugins/spaces-home-control/controllers/spaces-domain.controller.ts` (`POST /modules/spaces/spaces/{id}/intents/climate`)                               |
| Space intent and room state                             | `apps/backend/src/plugins/spaces-home-control/services/climate-intent.service.ts`, `space-climate-state.service.ts`                                                       |
| Virtual thermostat configuration and binding validation | `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-config.service.ts`                                                                                  |
| Input selection, runtime and output ownership           | `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-inputs.service.ts`, `virtual-thermostat-runtime.service.ts`, `virtual-thermostat-claims.service.ts` |
| Device commands and acknowledgements                    | `apps/backend/src/modules/devices/services/property-command.service.ts` and the device command dispatcher                                                                 |
| Generated wire contracts                                | `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/` (regenerate from backend source; do not edit)                                              |

## Space climate state and physical devices

`SpaceClimateStateService` reads the space's devices and role map, then selects primary thermostat, heating-unit and air-conditioner devices. The roles control participation: `AUTO` permits both capabilities, `HEATING_ONLY` or `COOLING_ONLY` restricts the branch, `AUXILIARY` denotes a supplementary control, `SENSOR` supplies readings, and `HIDDEN` excludes a device from the climate UI and space control. The current `PRIMARY_ONLY` averaging strategy uses temperatures from primary climate devices; `ALL_SOURCES` can additionally include `SENSOR`-role temperature devices. The service plans temperature contributors before reading them, and averages the selected available temperature readings and humidity values. It returns null readings when none are available. It derives supported branches and setpoint bounds from the participating devices, preferring the intersection of their ranges and falling back to the union when ranges do not overlap.

`ClimateContributionPlannerService` obtains measurement coverage from the device contribution registry. The virtual
measurement provider resolves durable projection, transform and aggregate bindings to physical property identities;
a virtual thermostat temperature represents only its configured ambient source, never its protective floor input.
The existing role and averaging strategy still select candidates: a sensor-role aggregate participates under
`ALL_SOURCES`, while `PRIMARY_ONLY` continues using primary climate devices. A selected composite suppresses its
represented raw or transformed candidates even while unavailable. Two selected composites covering the same physical
leaf produce `temperature_contribution.status = coverage_conflict` and a null room temperature. The operator resolves
this by choosing one representative through existing climate participation roles. Missing providers or stale/invalid
coverage likewise withhold the room temperature instead of falling back to cached derived values. Other climate
controls remain available. The panel explains withheld readings and preserves individual device controls.

The returned `mode` is detected from heater/cooler **ON** properties, while `isHeating` and `isCooling` require their respective **STATUS** property to report activity. Both branches ON produce an observed `AUTO` mode; this observation is distinct from two branches actively heating and cooling. `lastAppliedMode` and `lastAppliedAt` come from intent history. Historical heating/cooling setpoints take priority over device consensus; without a historical value, a branch's physical setpoints must agree within the 0.5 °C consensus tolerance or the displayed setpoint is null. `isMixed` indicates disagreement with the selected setpoint or between devices. A requested or historical value is not an actuator acknowledgement.

`ClimateIntentService` accepts `set_mode`, `setpoint_set`, `setpoint_delta` and combined `climate_set` intents. It creates an intent with per-device targets before dispatch, captures an undo snapshot, skips offline devices, and completes the intent with success, failure or skipped target results. Partial success is possible: at least one affected device can make the overall request successful while failed targets remain visible. For ordinary physical devices, the service prepares property batches through the registered platform so platform-specific setpoint projection is reflected in its result. Successful climate changes are stored asynchronously in the intent time series, including counts of targeted, affected and failed devices. The combined virtual-controller path sends mode and setpoints together to the controller's command contract.

For ordinary physical devices, `AUTO` is a space intent routed through their native platform. The space-level mode label and prepared property commands do not establish the installed platform's output behavior. The virtual thermostat applies an independent guarded changeover and reports actual activity separately.

`SpaceClimateStateListener` watches relevant property value, update and qualified-value-state events for temperature, ON, STATUS, humidity and lock state. It resolves current channel/device membership, schedules one recalculation per room after a 100 ms debounce, and emits `CLIMATE_STATE_CHANGED` for an existing climate space. It clears pending timers on module shutdown. These events refresh the space view; they do not turn a historical reading into a fresh controller input.

## Virtual thermostat and derived inputs

The space intent records a requested mode or setpoint and targets eligible climate devices. A virtual thermostat persists its latest requested settings and reevaluates them against its _current_ inputs and guards. `requested_mode` is therefore different from reported actuator activity. UI clients should display actual activity and inhibit/fault diagnostics separately from the user's requested setting. A queued, timed-out or unconfirmed physical command is not proof of heating or cooling. The runtime and claim/interlock path keep opposed heating and cooling outputs from being energized together, including across a restart.

The runtime response lists each configured ambient, floor and contact binding with its current freshness status,
quality, sample time, age, allowed age and expiry. These diagnostics use process-local accepted evidence and do not
renew a sample, mutate expiry or promote history to live authority. Missing/incompatible bindings remain visible.
The panel listens to `DevicesVirtualPlugin.Thermostat.RuntimeChanged` as an invalidation hint and refetches HTTP state.
HTTP and event snapshots share process epoch and sequence stamps, so a fetch covers its own notification without a
refresh loop; newer hints, commands, reconnects or device replacement fence older pending responses. Socket payloads
are not treated as actuator acknowledgement or independent control evidence.

## Thermostat comfort intent

The controller stores optional comfort configuration alongside its version-1 requested settings. A null comfort
configuration preserves installed manual behavior and does not seed any preset or enable automation. Explicit
`comfort`, `eco` and `away` presets use operator-defined Celsius setpoints and ranges matching the configured
branches and neutral deadband. HVAC `requested_mode`, selected preset and reported branch activity stay separate.
The original requested setpoint properties and configuration response retain their meaning. Runtime
`effective_comfort` reports the resolved source, preset, setpoints, override identity and expiry.

The `/plugins/devices-virtual/producers/thermostats/{id}/comfort` endpoint reads this state; PUT configures explicit
ranges/presets. POST `selection` selects a preset or null for the manual baseline, POST `override` selects a preset
or explicit setpoints until an absolute ISO expiry, and POST `override/cancel` terminates the identified active
override. Writes require both current thermostat and graph revisions. Override source is assigned by the backend
and actor identity comes from an authenticated user session or a display-owned token (recorded as source `panel` with display/token identity); public requests cannot impersonate internal automation.
The optional `comfort` definition on the existing thermostat configuration PUT permits an atomic policy/range change.
Incompatible active override setpoints must be cancelled before such a change; neither reconfiguration nor preset
editing silently replaces a live override.

A live override keeps the setpoints resolved at its creation and precedes an explicitly enabled trusted automation
baseline, then the current selected preset/manual baseline. The internal `applyAutomationBaseline` port accepts only
a current validated preset or explicit setpoints, authenticated bridge actor identity and revision fences; it has no
public HTTP route. Operator configuration defaults automation disabled. Explicitly disabling it clears its baseline. Background edits change that baseline only. Cancellation and expiry resolve the then-current baseline;
there is no saved settings restoration or historical command replay. Explicit OFF through the registered enable
controls latches OFF across comfort edits. An explicit non-OFF command or `clear_user_off` selection action clears
the latch; clearing it does not change the separate requested HVAC mode. All existing protective inputs, claims,
qualification and unresolved-output barriers still dominate comfort and are checked again at physical dispatch.

Override expiry uses both an absolute wall-clock deadline and a process-local monotonic budget. Equality expires.
Committed terminal expiry cannot revive on rollback or restart. A restart recovers remaining absolute lifetime capped
by the original duration, retaining identity and setpoints. A persisted wall watermark detects observable rollback;
invalid lifetime evidence or clock uncertainty holds the override as `clock_uncertain` and inhibits output until an
explicit cancellation/replacement, rather than falling through to a potentially higher-demand baseline. No method can
prove unobservable wall-clock shifts across downtime without an independent trusted clock. The API reports
`bounded_absolute_recovery_with_uncertainty_inhibit`. Synchronous dispatch refusal is immediately fail-closed, but durable
expiry observation occurs at committed settlement; a synchronous guard cannot promise persistence across a crash.
Temporary overrides are bounded to seven days. Cache state is bounded to one live identity per controller.

This backend stage does not implement a space activity/schedule/presence engine. The trusted baseline port is ready
for the separate bridge, and no engine invokes it here.
Admin authoring and Panel selection/override/cancel controls expose server diagnostics in all six locales. Local UI
tests cover legacy/manual controllers, explicit branch setpoints, OFF-latch actions, expiry invalidation and stale
requests. Independent backend review, composed UI acceptance and release gates remain before VD3-7 is complete.

## Input graph and measurements

Virtual measurement bindings are durable graph edges. An aggregate reports a read-only temperature from compatible sources according to its configured operator, freshness and quorum. The output has its own identity and history, while source identity, timestamp and quality remain visible for diagnostics. Losing quorum or seeing only stale inputs makes the current output unavailable; history is not treated as a live reading.

A numeric converter binds one numeric physical source and declares its output quantity and unit. Typed policies include affine and piecewise conversion, NTC beta and explicitly calibrated Steinhart–Hart. Domain errors, unknown units, stale input and invalid samples make the derived output unavailable. Conversion preserves source age; it cannot create a fresh temperature by recalculating old voltage. Only a validated temperature output in canonical Celsius is eligible for an ambient or floor role. Graph validation prevents cycles and unsafe derived-source composition.

The supplied Shelly Plus 1PM Gen2 pilot exposes its analog floor input as voltage at `voltmeter:100`; its existing NTC script logs Celsius but does not currently expose a Celsius RPC property. The prepared pilot path uses a separate converter with the script's explicit Steinhart–Hart coefficients. A separately configured native Shelly helper that _does_ report Celsius can be used as temperature, with its unit and quality, but raw voltage must not be silently substituted for temperature.

## Protective control

The operator supplies setpoints, deadband and any enabled floor limit and recovery hysteresis for the installed equipment. No universal protective floor threshold is assumed. A heating floor guard releases heat when the valid floor reading is **at or above** its configured limit. Missing, invalid or stale mandatory floor data inhibits heating. Recovery requires a fresh valid reading **strictly below** `limit - hysteresis`, plus all other gates being clear. A new, lower limit is evaluated against the current reading; it does not await another sensor event.

A configured physical window contact and automatic temperature-change detection are independent pause policies. Either can inhibit output. A contact closing or heuristic pause expiring triggers a fresh evaluation of the latest user mode and setpoint; it does not replay the settings that existed when the pause began. User OFF, input faults, floor protection, window pauses, cycle/changeover waits and actuator uncertainty take precedence over comfort demand. Protective release must be confirmed or remain visible as uncertain; a virtual status alone cannot qualify an installed protective system.

Actuator claims bind a qualified physical output to one controller and refuse unsupported or conflicting configurations at preview and persistence. Stop, restart and binding changes reconcile outstanding commands and claims before output may resume. The controller's software safeguards still require independent equipment protection and an operator-approved installation qualification before a live heating or cooling output is activated.

## Mandatory parallel thermostat branches

Guarded controllers group physical actuator claims by the stable `(controllerId, role)` identity. The existing
`actuators` request/response array remains compatible: repeating `heating` or `cooling` adds a mandatory parallel
member to that branch. At most eight total non-released members are admitted across both roles, including missing,
releasing and suspended reservations. Singleton upgrades change neither physical claim IDs nor their qualification
generation, lease, revision, release state or command journal. Migration `1000000000040` removes only the singleton
role uniqueness constraint and adds the installed provider profile/version and explicit `guarded_branches` strategy.
The shared journal decision identity remains the existing `(controllerId, decisionRevision)` tuple; every leaf gets
its own persisted command identity before transport entry.

The versioned internal actuation contract separates transport acceptance, causal observation, local protective
qualification and qualified OFF/drain evidence. Shelly remains the only implemented guarded adapter. A profile/version
mismatch or an unsupported provider cannot qualify a protected branch by registering an adapter or acknowledging a
service call. `native_unit` is a typed, mutually exclusive strategy seam binding one canonical HA/Zigbee physical unit;
its adapters, requested bundle and observations are outside this backend foundation and cannot be activated here.

Demand uses all mandatory members. Same-mode siblings require no opposed-output attestation merely because they are
parallel. Unknown, unavailable, unqualified or failed members inhibit the demanded branch and drive release of its
remaining members. Acceptance without fresh ON observation does not establish completed parallel capacity. Each
uncertain/late ON remains unresolved in its own journal until its own qualified drainage proof. Final send guards
recheck the complete branch, physical ownership, input evidence and configuration/mapping/request fences. Settlement
feedback can reevaluate a parallel decision without revoking its siblings; external changes still revoke admission.

An opposed branch must have every member freshly OFF and every earlier ON drained. Its changeover clock starts at
the last member's qualified OFF, not the earliest sibling. Reported aggregate activity requires unanimous fresh member
observations; mixed/unknown activity remains unavailable. Runtime diagnostics remain per physical claim, including
group/canonical identity, reservation state, pending ON, release attempts and last qualified OFF. Configuration also
returns `released_actuators` with retained per-member completion evidence; recovery audit remains claim-specific.
Disable/delete/remap/restart preserve unresolved identities and reservations rather than reducing branch capacity.

Each parallel heating member now requires an explicit version-one `local_floor` protection binding. Its Celsius
source must be a qualified sensor on that actuator's canonical Shelly, or the reviewed Steinhart–Hart converter over
one qualified physical voltage input on that same Shelly. Aggregates, projections, nested converters, controller
outputs and unsupported protective profiles remain ineligible. One ambient source regulates the entire branch.

Migration `1000000000041` adds retained claim-keyed safety dependencies, nullable diagnostic latch/display fields and
a nullable full Shelly catalog snapshot. It rewrites no claim, journal, generation, installation, activation or audit.
Without a member-binding row, the singleton resolver, fingerprint and artifact source remain exactly the legacy path.
Previously ineligible groups do not activate through migration or registration.

The version-two `member_setup` installation request derives sensor/component/peripheral/calibration metadata from
the catalog under the structural lock. Operators supply the existing equipment evidence, native switch snapshot,
endpoint/script slot, watchdog/lease bounds and an installed floor ceiling. The reviewed artifact enforces
`min(common requested floor limit, installed member ceiling)` with the common hysteresis and an identical finite
native/converter domain in backend and local script. Thresholds are immutable artifact configuration, never ON
parameters. Changing bindings, calibration, topology or common safety policy invalidates applicable sibling profiles;
explicit restaging and activation are required. Staging retains the real guarded queue/session/epoch/retry and
OFF/drain proof, existing attestation requirements and the distinction between metadata and physical qualification.

Every member latch starts set after startup, reconnect, contract/lease changes and observation gaps. Only a new
qualified sample strictly below effective cutoff minus hysteresis clears it. Persisted clear state grants no startup
authority. Missing, stale, degraded, incompatible, nonfinite or faulted input inhibits and releases the entire heating
branch, including at final queued/authentication-retry sends. Each leaf retains its independent unresolved ON and
reservation. Positive local `floorSafe`, metadata inspection and ACKs do not refresh backend measurements; unsafe
floors do not prevent protective OFF/drain reconciliation. Consumer dependencies include converter leaves and remain
separate from ambient measurement provenance.

An existing controller `sources.floor` remains an additional mandatory global guard. Explicit removal is a fenced
safety configuration change. `display_floor_claim` selects only a member's displayed floor reading and cannot remove
or replace a safety dependency. Configuration includes retained member bindings; runtime branches expose individual
reading/age, effective cutoff, latch and blockers alongside pending ON and release/recovery evidence.

This software supplies no installed qualification evidence and performs no commissioning. Each floor-protected relay
still needs an actual supported local sensor/calibration and the existing per-device isolation, execution-bound,
restart-drain and independent equipment-protection evidence. Network loss cannot promise instantaneous cross-device
shutdown; local protection and bounded leases remain essential. Hardware deployment/qualification follows a published
alpha. HA/Zigbee native-unit protection and non-floor protective profiles remain unsupported.

Admin multi-member creation/edit/repair now retains missing members and enforces the combined limit. Admin/Panel
render per-member readiness, uncertainty, release/recovery evidence and mixed activity, while preserving singleton
compatibility. Client integration and localization generation have local validation evidence in
`docs/work/virtual-thermostat/member-client-validation.md`. Review fixes have focused local validation recorded there;
fresh independent review and exact-head CI remain required before publication. Native-unit adapters and installed qualification remain
separate work; this client delivery does not close the complete climate issues or extension epic.

## Groups, spaces and provenance

A virtual light group exposes only compatible common controls from its physical members. Its reported state may be mixed or unknown, and a parent command may have confirmed, partial or failed member outcomes. Space and scene commands expand through the same command path; room contribution must count a physical light only once when it and its group both belong to the room. Group and derived sensor values are views of physical sources, so they do not create additional energy consumption or erase physical provenance. Hidden physical sources retain their own history and attribution.

## Verification boundary

The [virtual devices epic](../tasks/epics/EPIC-VIRTUAL-DEVICE-CAPABILITIES.md) tracks composed-head software acceptance and the separate installed-hardware gate. Focused tests cover measurement freshness/quality, converter domains, graph repair, group child outcomes, controller guard and restart behavior, and ordinary physical command regressions. Passing those tests establishes software behavior, not installed floor calibration, actuator isolation or independent protective equipment. The [Shelly commissioning record](work/virtual-thermostat/shelly-commissioning.md) holds the pilot evidence and remaining operator qualification procedure.
