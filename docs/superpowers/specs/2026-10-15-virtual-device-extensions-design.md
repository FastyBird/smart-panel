# Virtual device extensions and automation

Status: planned — independently reviewed implementation contract
Date: 2026-10-15
Tracking: see [delivery epic](../../../tasks/epics/EPIC-VIRTUAL-DEVICE-EXTENSIONS.md)
Baseline: `de474d2ebca9dd45ace852caaa8bf97698f54b94` (#1446)

## Outcome and boundary

The user authorized implementing the previously deferred virtual-device capabilities, then reconciling documentation,
preparing the next alpha release, and finally testing the installed system on real hardware. The completed wiring,
aggregate/converter/light-group/thermostat milestone (#1409) and HomeKit delivery (#1446) remain the compatibility baseline.
This is a new software milestone, not a reopening of completed issues or a claim that installed equipment is qualified.

The bounded additions are numeric and binary aggregates; additional actuator-group profiles; thermostat presets and
temporary overrides; space schedule/presence integration; dew point and cooling cutoff policies; parallel actuator
branches; Home Assistant and Zigbee2MQTT native-unit adapters; and trusted SDK numeric-operator registration.
Admin creation/edit/repair, panel presentation, standard HomeKit mappings, generated contracts and regression evidence
are part of delivery, rather than follow-ups left after backend completion.

## Shared invariants

- Retain existing device/output UUIDs, history, v1 API/configuration interpretation and canonical physical identities.
- Use incremental migrations. Map old branch claims to singleton groups without releasing/reacquiring their ownership.
- Preserve source sample age, provenance, finite/range validation, quality, graph generation and configuration fences.
  Reading, recalculation, equal values and cached events never create fresh evidence. History is not live authority.
- Preview, persistence, source pickers and runtime use the same profile policies. Missing members remain explicit.
- Commands use core admission, prepared targets, windows and per-leaf confirmation. Acceptance is not physical success;
  partial success does not cause automatic compensating commands that overwrite newer feedback.
- All comfort actions remain subordinate to protective inputs, qualification, ownership, pending-command drainage and
  opposed-output exclusion. Unsupported equipment profiles expose specific readiness/refusal reasons.

## Numeric and binary aggregates

Initial numeric profiles are temperature/°C, relative humidity/%, CO₂ concentration/ppm and illuminance/lx. Match channel,
property category, canonical unit and the spec-supported numeric types; do not mix quantities or silently convert units.
Keep the existing restricted derived-input composition, and prohibit unreviewed nesting/cycles. Humidity accepts its
existing integer source type; output precision/rounding must be explicit in the profile and tested at boundaries.
Illuminance must not invent qualitative `level` thresholds: make that optional in the source specification and regenerate.

Add `weighted_mean` with finite positive bounded per-input weights; old inputs default to weight 1. Normalize weights
before stable summation and renormalize retained weights after exclusions. Quorum counts retained source identities,
not weights. Add optional `absolute_deviation_from_median` filtering with a positive canonical-unit threshold and a
minimum qualified comparison cohort of three. Apply freshness/domain admission, filtering, then quorum. Equality at the
threshold is included; insufficient comparison cohort or filtered quorum loss is unavailable with an explicit reason.

Initial binary profiles are contact, motion and occupancy with strict boolean `detected`, operators `any`/`all`, fixed
membership and explicit quorum/freshness. After quorum is met, true is decisive for `any`, false for `all`; otherwise
unknown members prevent a definitive result. Decisive results with missing/excluded inputs are degraded. Smoke/leak
alarm policy and security decisions are not introduced by a generic binary aggregate.

Authoring exposes profile, units, weights, filtering, quorum, exclusions and source age. Test exact threshold/expiry,
overflow, integer precision, unknown truth tables, source replacement, restart and existing temperature behavior.

## Actuator-group profiles

Keep existing light behavior and add homogeneous physical-member switch, outlet, fan and covering profiles, with the
existing bounded membership. Preserve current light API/schema/storage names as compatibility aliases where needed.
Profile capability admission distinguishes read-only, read-write and write-only fields rather than assuming every
control is read-write. Configuration changes cannot silently remove a previously exposed control.

- Switch: common ON control.
- Outlet: ON and optional common read-only in-use; no synthetic energy/power counters.
- Fan: ON plus compatible common speed, swing, direction and mode. Discrete speeds and percentages are distinct;
  do not guess a conversion or infer ON from speed. Timers and specialty breeze/lock functions are outside this profile.
- Covering: compatible type, position representation and command set; optional common tilt/obstruction. No guessed
  inversion or calibration. Stop completion needs admissible member feedback; a write-only acknowledgement is not a
  confirmed stopped state.

Fresh member feedback determines mixed/unknown state. Preserve light any-on behavior. For new numeric/enum controls,
initial reported values require agreement instead of presenting average positions/speeds as physical observations.
Expose member outcomes and unknowns. Test conflicting leaves, offline members, late confirmation, stop, obstruction,
remap and deletion. Admin/panel/room/scene controls must obey each profile's actual capabilities.

## Thermostat comfort arbitration and space automation

Add explicitly configured controller presets `comfort`, `eco`, `away` with validated branch setpoints/ranges/deadband;
never supply universal comfort temperatures. Existing configurations remain manual with automation disabled.
HVAC mode, thermostat preset, space activity mode and house mode remain distinct concepts.

Persist temporary override ID, source/actor, revision and absolute expiry. An override selects a preset or explicit
setpoints. Expiry/cancellation reevaluates the current baseline rather than restoring captured obsolete settings.
Clock changes/restarts cannot extend an elapsed override or replay missed commands. Explicit user OFF prevents
automatic resumption until cleared; a live temporary override precedes configured automation, then the selected
preset/manual baseline. Protective admission remains stronger than every layer and is rechecked at dispatch.

Reuse existing activity-mode issues #1292–#1296, scheduling #1297/#1298/#1362 and occupancy #1299/#1300. They retain their
own full acceptance; do not create duplicate engines/issues or close partially delivered prerequisites. Schedule events
activate space activity modes, which dispatch configured climate intents/preset selection. Activity-mode names do not
implicitly select equally named thermostat presets. `SpaceActivityService` recent property traffic is not presence.
The reused activity-mode task is amended in this planning change: climate actions default disabled/unset until the
operator configures explicit preset references or validated setpoints. Its former 21/22/18 °C examples do not seed
thermostat presets or silently command new or existing equipment. Existing persisted operator-configured actions are
preserved; the amendment changes planned defaults, not installed configuration.

Define DST gaps/folds, occurrence deduplication and restart current-mode evaluation in the existing scheduler work.
Do not replay historical actions. Preserve its manual-until-next-trigger rule, occupancy's explicit manual-override
clear rule and the independent thermostat override lifetime. Unknown/stale presence is not vacancy. Camera #1221 is
optional; unrelated security-domain delivery in #1287 is not a prerequisite. Unavailable optional domains retain the
activity-mode specification's explicit skip/partial-failure semantics.

## Dew point and cooling protection

Implement a typed two-input derived sensor with dry-bulb temperature and relative humidity, a versioned formula/domain
policy, explicit maximum timestamp skew and Celsius output quantity `dew_point`. This is not arbitrary scripting or
an implicit reuse of the single-input converter. Validate finite supported-domain temperature and `0 < RH <= 100`.
Use both source identities/lineages, oldest relevant sample evidence and earliest expiry. Missing/error/stale inputs
invalidate immediately; restart waits for fresh evidence. `dew_point` is not ambient/floor temperature merely because
its unit is °C. Test reference vectors, domains, skew, expiry, source repair and graph changes.

Cooling protection is a separate policy from the existing heating floor maximum. Require explicit protected surface
temperature, qualified dew-point lineage, positive margin and recovery hysteresis. Inhibit cooling at
`surface <= dew_point + margin`; recover only strictly above that threshold plus hysteresis. Missing mandatory inputs
inhibit immediately. An optional explicit absolute cooling surface minimum is independent. Do not substitute room air
for a surface probe, increase demand, promise mixing-valve control or infer installed protection from a calculation.

Configuration/preview and software cutoff behavior can be delivered before equipment qualification. Activation requires
a provider-qualified local protective profile or independently evidenced equipment cutoff appropriate to cooling loss
of backend/network control. The existing Shelly heating-floor artifact cannot qualify floor cooling by reuse. Unsupported
profiles remain visibly ineligible; no fabricated qualification flags or software-only claim of local protection.

## Provider-neutral groups and native units

Introduce versioned provider-neutral actuation/observation/qualification contracts before extending the current
Shelly-specific transport. Initial parallel groups have at most eight total mandatory actuator members across heating
and cooling, without staging, PWM, lead/lag, proportional valves or shared-plant orchestration. Parallel same-mode
members are not opposed outputs merely because there is more than one member.

Every member retains stable claim identity, provider profile/version, qualification generation, lease and journal
evidence. Demand is evaluated per branch; each leaf dispatch rechecks all guards. A missing/unresolved mandatory member
inhibits and releases the demanded group with per-member diagnostics; do not silently reduce capacity. Persist leaf
journal entries before dispatch with a shared decision identity. Partial/late ON remains unresolved per leaf.
Opposed changeover waits for every member of the other branch to be freshly OFF with earlier ON drained; group OFF
time is established by the last member. Disable/delete/remap/restart/recovery retain unresolved reservations and commands.

Make `climate_controller.control_strategy` explicit: existing configurations use `guarded_branches`; `native_unit` is
a mutually exclusive strategy binding exactly one canonical physical HA/Zigbee climate unit, without parallel relay
members. The virtual controller owns its configuration and requested mode/setpoint bundle; the native unit owns its
physical regulation. Virtual mode, setpoint and current-temperature/activity properties retain ordinary controller
identity/history. Native current temperature/activity use separately qualified provider observations. Do not substitute
an external ambient sensor unless the provider explicitly supports and validates that input.

Reserve the mode/setpoint bundle against conflicting Smart Panel writers using the provider-neutral ownership seam.
This cannot exclude HA automations, Zigbee device controls or other writers outside Smart Panel. Their changes update
observed state and drift diagnostics without overwriting requested settings or proving a virtual request completed.
Do not continuously fight upstream drift: resend only on a new legitimate user/automation setting request, with an
explicit reconcile/retry command where appropriate. Persist request identity/revision and fence older in-flight work;
restart acquires fresh observations and reconciles unresolved outcomes without replaying obsolete requests. A compound
request reports per-operation outcomes; target acceptance or an unrelated later observation is not causal confirmation.

The user selected both Home Assistant climate and Zigbee2MQTT native thermostats as initial `native_unit` adapters.
They delegate supported native mode/setpoint requests and report actual available feedback separately from requests.
Validate capability/range/unit, command ordering, feedback provenance and per-model semantics. Features exposed by a Zigbee device
alone do not prove atomic `heat_cool`; unsupported compound/auto requests are refused. Cover both integrations with
production-adapter protocol/component tests. Do not imply support for every model or firmware.

Native unit delegation is distinct from qualified protective actuation. The initial `native_unit` strategy refuses
floor/condensation protection, parallel protective leaves and opposed-output safety claims unless a separately
implemented qualified native-unit protection profile can satisfy their entire contract. Ordinary native control still
ships with real commands and qualified observations; it is not just a registration placeholder.
An adapter registration, service-call response
or requested HVAC mode does not grant a protective lease, OFF/drain proof or physical activity claim. Existing guarded
Shelly leaves retain their qualification requirements; HA/Zigbee profiles lacking required local bounds/release/interlock
remain ineligible for protective floor/opposed control. Model-specific installed evidence is a post-alpha activity.

## SDK and HomeKit

Expose a typed/versioned numeric-operator contract through the existing trusted server-extension SDK, backed by a
devices-virtual host registrar. Migrate built-in conversion operators without changing their persisted meaning.
Registration has extension ownership, collision/version rejection and disposal. Removal/configuration change fences
dependent producers; thrown/nonfinite results become unavailable, preserving history. A test extension proves the
registration/preview/runtime/removal lifecycle. This is trusted Node/Nest code, not a sandbox or user expression runner.
Keep group/controller profile contracts typed internally; do not add public policy engines without concrete contracts.

Use existing standard HomeKit mappers for supported quantities/profiles, and add standard CO₂ and fan mappings.
Keep canonical quality/current-authority checks and composite outcomes. Unsupported specialty controls and dew-point
quantities have no fabricated generic HAP service. Extend truthful thermostat/group state tests. Actual Apple Home
pairing is part of post-alpha hardware acceptance.

## Delivery and release evidence

The epic owns dependency/file boundaries and issue links. Sensor configuration/runtime and group capability/planner
lanes each have one writer while their contracts change. Stabilize backend contracts before admin/panel generation.
Use medium-effort implementation agents for bounded slices and independent higher-effort review for concurrency,
ownership, transport and protective-policy changes. Do not introduce dependencies without a demonstrated need.

Delivery uses fewer, larger cohesive PRs rather than one PR per issue, honoring the user's one-review-per-hour
CodeRabbit allowance. Assemble independently checked local commits from related tasks, run composed checks and update
the PR description before requesting review. Keep an assembling batch draft to avoid consuming reviews on unfinished
increments. The first batch reuses PR #1464 for this plan, weighted aggregates (VD3-1) and switch/outlet group profiles
(VD3-4). Later batch boundaries follow actual dependencies and reviewer file limits; issue-level acceptance remains
independent. Do not merge the planning-only head in place of the combined implementation.

Each delivery PR requires exact-head green CI and a completed nonblocking CodeRabbit main summary, or explicit operator
approval. Rate-limited/skipped SUCCESS is not review approval; retry once after the stated quota deadline and dedupe.
Every capability needs named acceptance cases, incremental upgrade coverage, user documentation and a clear unsupported
profile boundary. Final composed validation covers prior wiring, energy, hidden provenance, ordinary physical commands,
HomeKit, restart/remap/expiry, producer shutdown and generated API/spec consistency.

After software acceptance, reconcile obsolete drafts/checklists and publish current capability/evidence matrices and
release notes. Publish the next alpha through the repository's existing release workflow after software readiness,
and record its published version/tag, exact source commit, successful publishing jobs and artifacts. Publication is
an explicit terminal milestone gate, not merely a prepared draft. Final installed Shelly/HA/Zigbee/HomeKit tests use
that published alpha artifact;
no device actuation, script deployment or commissioning is authorized by this software plan alone.
