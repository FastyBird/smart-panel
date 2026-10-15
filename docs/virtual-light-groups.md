# Virtual actuator groups

A lighting device in `actuator_group` mode owns derived output rows and durable member/channel/property bindings.
The initial profile accepts 2–256 physical light channels. Members keep their identities after deletion: nullable live
foreign keys clear without shrinking the intended member set. Membership does not hide physical devices or transfer
energy attribution. Derived energy counters are outside this profile.

The common capability contract requires readable/writable ON booleans and intersects optional numeric datatype, native
unit, range and decimal step grids. Decimal grids up to six places use an exact common period and aligned origin;
disjoint or unrepresentable grids are refused. Color requires every RGB component or the complete hue/saturation pair.
The authoring preview returns `common_capabilities`. Exposed output rows keep their UUIDs and validated contract.
An edit incompatible with an exposed optional output returns a repair conflict; it never silently deletes the output
or its scene/tile references. Missing members retain the last validated exposed contract while requiring explicit repair.

## Switch and outlet profiles

The backend authoring/configuration API also supports `switch` and `outlet` profiles with matching device/channel
categories. Each group has 2–256 homogeneous physical members. Existing light-group endpoint, schema and storage names
remain compatibility aliases. The locally staged #1453 batch adds Admin authoring and Panel controls for all five profiles; delivery remains pending PR review and CI.

Switch and outlet profiles expose common readable/writable ON. An outlet may additionally expose common read-only
`in_use`; it is a reported value, not a command target. They do not create aggregate power or energy counters.
The same fixed-membership freshness, graph/revision fencing, feedback-based mixed/unknown state and per-member
composite outcomes apply. Room lighting contribution rules below remain specific to the light profile.

Their boolean fields must support both states: no format, an empty format, or exactly `true` and `false` strings
(case-insensitive). One-state or malformed formats are refused by preview and persistence. Command planning rechecks
both output and physical-member contracts, and runtime feedback becomes unavailable when those contracts drift.
This also fences previously materialized invalid rows. The legacy light profile keeps its existing format policy.

## Fan and cover contracts

The existing group endpoints accept `fan` and `cover`. Both require 2–256 homogeneous physical members.
The `LightGroup` API/storage names remain compatibility aliases. HomeKit/HA mappings remain separate work (#1461).

| Profile | Required fields                         | Optional fields                       | Source access                                                         |
| ------- | --------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| Fan     | `on` boolean                            | `speed`, `swing`, `direction`, `mode` | Read/write                                                            |
| Cover   | `type`, `status`, `position`, `command` | `tilt`, `obstruction`                 | Type/status/obstruction read; position/tilt read/write; command write |

Fan speed uses either native percentage (`uchar`, %) or discrete enum levels; these representations cannot mix.
Cover position likewise preserves percentage versus discrete states. Tilt uses native degrees. Numeric fields require
explicit finite ranges within the channel specification and a compatible common decimal grid. Enum controls expose
only the shared supported values. Cover command sets must match exactly. Cover type requires the same singleton
metadata declaration on every member; a broad list of possible installed types is refused. There is no inversion,
calibration, unit conversion, speed-to-ON inference, timer, breeze or lock policy.

New numeric and enum observations require exact agreement across every intended member, including powered-off fans.
Conflicting or missing positions/speeds/status remain null with mixed/contributor diagnostics; they are never averaged
or rounded into a physical observation. Obstruction also requires agreement; a mixed result retains its contributors
and does not mean the obstruction cleared. Cover ON counts describe unavailable power fields; use each property's
value/mixed/contributors and member reasons for covering feedback. Freshness remains 300 seconds and restart waits
for fresh evidence. Membership repair preserves output UUIDs and the exact exposed range/grid/enum contract.

Commands use the existing prepared canonical-leaf core path with revision, claims, deadline and per-member outcomes.
Shelly NG now supplies the first qualified `cover_action` adapter for calibrated covers. Other adapters remain
unavailable for strict cover commands: generic Zigbee `STOP` mapping, ordinary HA updates and Shelly V1 are not proof.

For Shelly NG, select the physical cover TYPE explicitly through the existing property metadata API: set the TYPE
property's `format` to a singleton supported type (for example `['blind']`). This is operator configuration on the
canonical physical component, not an inferred model/name/default or live measurement. Rediscovery preserves it.
Unconfigured or broad TYPE declarations remain visible but ineligible. The group reports TYPE with
`provenance: configured`, without a physical sample timestamp or derived history publication.

Preview and configuration responses expose per-operation `operations` readiness, with per-member refusal reasons.
Structural `rw`/`wo` field access is separate from current commandability. Shelly POSITION and TILT commands are
explicitly unavailable in this adapter; their truthful observations remain available. Full required TYPE/STATUS/
POSITION/COMMAND and exposed optional metadata are checked together during creation, repair, planning and reporting.
Drift or deletion excludes the entire affected member, preserving intended identities and unknowns.

The native field contract follows the [Shelly Cover API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cover/), including its nullable status tag and optional action tag. The pinned SDK cover helpers omit action tags, so the adapter uses its guarded native RPC transport.

COMMAND confirmation uses the same pinned guarded RPC session for a tagged action and a distinct post-response
`Cover.GetStatus`. OPEN/CLOSE confirm **motion begun in the requested direction**, or a freshly observed correct terminal
endpoint. They do not claim full travel completed. Child reasons distinguish `cover_action_begun`,
`cover_target_observed` and `cover_stopped`. Group STATUS/POSITION always come from actual samples, never the requested
terminal target. STOP requires explicit native `open`, `closed` or `stopped`; unchanged position cannot prove cessation.
A fresh idle no-op STOP is accepted only after the serialized successful action response and fresh matching idle state.
Cover STATUS reporting also requires the internal native-status semantic classification; a generic live packet or imperative STOP mapping cannot establish stopped state.
Moving confirmation requires the exact unique action tag. Incorrect tags cannot prove motion; freshly correct terminal endpoints and ordered idle STOP no-ops may retain an earlier tag. Calibration, malformed/out-of-range
position, faults, cached data and pre-action replies cannot confirm a command. Readiness requires a fresh qualified native status that actually exposes the tag field. An opaque process-local observation token and acceptance boundary bind proof to the exact admitted STATUS/POSITION samples, never unrelated equal values. Raw validation precedes transformation;
invalid/uncalibrated input immediately invalidates qualified position rather than clamping it into evidence.

The existing absolute composite/intent deadline remains bounded by 30 seconds, without renewal. Every command and
readback checks its core generation, physical motor effect scope, provider session/mapping, metadata and graph fences.
Direct COMMAND/POSITION/shared-drive TILT requests supersede pending group observations for that motor, including when
an unsupported new control is refused. Sibling motor effects consult the existing ownership admission guards too.
Timeout, remap, deletion, disconnect and shutdown revoke confirmation authority and stop further polling/sends;
late physical replies cannot repair terminal outcomes. SDK authentication retries and queued sends retain send guards.

Migration `1000000000038` adds a durable unresolved-submission journal keyed by physical MAC/component, without a
cascading device FK. Submission is journaled before send; only a matched successful action response retires a sent
entry. An uncertain earlier action blocks newer qualification across rediscovery and restart. No command is replayed,
and restart never restores process-local confirmation or physical sample authority. The pinned SDK collapses remote
errors and transport failures to ordinary errors; this adapter conservatively retains the journal for either. There is
no automatic journal reset or fabricated drain barrier; unresolved installations require separately qualified recovery.

Acceptance uses mock RPC transport with the real pinned SDK, production Shelly adapter/delegate, real SQLite,
normal qualified sample admission and core composite windows. It covers tagged motion/no-op endpoints/STOP, malformed
and missing evidence, ACK-only/late responses, partial members, direct/group supersession, ownership effects,
configuration/metadata/deletion/disconnect/shutdown fences, normal raw reports, TYPE persistence/readiness and journal
migration/restart behavior. This is backend software evidence. The #1453 software UI flows below are staged locally; installed equipment
qualification and hardware acceptance remain after alpha.

## Feedback and quality

`VirtualLightGroupStateService` consumes only `PropertyValueService.readQualifiedSample`: a provider must submit actual
live feedback using the core sample evidence contract. Database history, optimistic API writes and cached adoption
snapshots do not qualify. Each configured input expires after 300 seconds. Missing, disabled, offline, quarantined or
incompatible sources are unknown. A backend restart starts without qualified physical samples.

A structural write that has committed stays committed if the subsequent graph validation read or listener fails.
The committed catalog can activate, while live virtual outputs and command guards remain unavailable until a complete
validation refresh succeeds. Pending publications from the previous validation lifecycle cannot become current again
when validation recovers. Physical source samples retain their independent authority.

ON is true when any member is confirmed on, false only when every intended member is confirmed off, and otherwise null.
The reported API separately exposes all-on, mixed, on/off/unknown counts and each member's diagnostic reasons.
Brightness is the mean of valid on-member samples, with explicit contributors and mixed state. The diagnostic value
keeps the arithmetic mean; publication rounds a representative onto the output's validated step/integer grid and
records that rounding. Colors and color temperature select a contributor's consensus value, never an average of
opposed colors. Brightness is mixed whenever contributing values differ. Absolute native-unit color tolerances are 1 for
RGB/saturation, 2 degrees for hue, and 25 K for color temperature. Any unknown/mixed color component makes its whole RGB/HS representation unknown.

## Core command integration

`CompositePropertyCommandRegistryService` is an internal opt-in planner registry. The virtual plugin registers only
validated derived typed-group outputs in an actuator-group owner. Public DTOs cannot select planners or bypass a
read-only property. Parent target values still validate against the durable exposed contract.

The planner snapshots all intended bindings and the graph/configuration revisions. Core expansion covers an entire
mixed group/group/raw command request, normalizes canonical values, deduplicates equal leaves and rejects contradictory
leaves before physical I/O. Core retains RGB/HS properties in a single physical channel batch. Strict composite dispatch requires `prepareCompositeBatch` to capture exact
physical targets and an opaque provider identity lease. Providers without this profile are unavailable and receive no
physical command; their ordinary controls retain the existing platform preparation and dispatch behavior. Core
admits the prepared values and supplies an exact generation/deadline guard to the dispatch closure. Providers check
that guard and their stable identity at actual queued publish, then report qualified live feedback. Composite windows
require live causal evidence; ordinary windows retain their legacy convergence contract. Reports without evidence are
held for ordinary recovery after expiry and cannot confirm a composite generation or establish qualified samples.
No member platform loop lives in the virtual platform.

Up to eight physical channel batches run concurrently, with at most 128 active parents, 2048 expanded children and a
bounded total deadline (the existing intent budget, capped at 30 seconds). The absolute parent intent expiry caps
planning and dispatch with a 100 ms margin for completion reporting; metadata delays cannot restart that budget.
Independent members run despite another
member's exception or unavailable metadata. Progress/completion events include the parent id, intent/request correlation,
requested targets and binding revision. Unavailable members stay in outcomes. Exact physical window confirmation is
required: matching derived any-on or brightness mean never confirms a command.

Each child ends as confirmed, failed, unavailable, superseded or timed out. A parent is confirmed only when every
intended child confirms, partial when some confirm, and failed when none confirm. New physical generations and
cancellation notify active parents, including an already-confirmed early child; ordinary confirmation-grace expiry does
not erase confirmation. Confirmation is recorded immediately even when a provider acknowledgement hangs.
Configuration remaps fence the parent. Observers are removed on completion, timeout and module
shutdown. There is no promise of atomic hardware rollback after partial completion.

Completed intents retain one correlated composite snapshot and derive partial status from confirmed children.
REST responses and websocket intent events expose child identity fields as `member_id`, `property_id`,
`member_identity` and `property_identity`; the original identities survive cleared live references.
Scenes count only confirmed parents as successful actions. A partial parent retains confirmed child outcomes in the
scene result, produces partial scene completion and does not stop unrelated actions. Legacy platform boolean contracts
remain unchanged.

`PropertyCommandAdmissionRegistryService` is the shared internal canonical admission hook for future controller claims.
Ordinary direct, scene, projection and expanded group commands consult the same leaf policy. It exposes no public
bypass flag. A future controller ownership implementation must add a registry-minted opaque command authority for its
own release/control path rather than trust caller-supplied context.

Room lighting state and commands use the same physical-leaf contribution planner. A selected group represents its
members; raw channels covered by it are excluded from the room calculation and dispatch selection. Unclaimed raw
channels continue to contribute and remain directly controllable.

If two room groups overlap, state and commands report `lighting_contribution_conflict` before dispatch. Repair this
in the room's lighting roles editor: keep one group participating as the representative and set the other group's role
to **Hidden**. The equivalent API is `POST /api/v1/modules/spaces/spaces/{id}/lighting/roles` with
`data.device_id`, `data.channel_id`, and `data.role: "hidden"`. Both state and command selection exclude that room role
before contribution planning. The role target listing retains the excluded group, so its participation can be restored
explicitly; restoring overlapping participation reports the conflict again. Changing a lighting role does not change the
device's `hidden` flag or `hiddenBy` provenance, its group membership, or direct member controls.

Focused regressions are `apps/backend/src/plugins/spaces-home-control/services/light-group-room-role-repair.integration.spec.ts`
(saved role repair, room counts and dispatch selection) and
`apps/backend/src/plugins/devices-virtual/services/virtual-light-group-authoring.integration.spec.ts`
(group create/edit/remap/delete preserve source hiding, projection links and energy claims).
Production availability depends on adapters submitting qualified live feedback; legacy
adapters that write only values remain unknown. WLED partial observations preserve omitted main RGB values; only full
snapshots or explicitly unsafe main-segment identities invalidate those colors. A provider without guarded composite preparation is also refused at
dispatch, so neither optimistic writes nor a queued obsolete command can count as group success.

## Authoring and repairing native groups (locally staged #1453)

In Admin, open the group wizard and select Light, Switch, Outlet, Fan or Cover. Profile definitions and candidate
compatibility come from `POST /plugins/devices-virtual/producers/light-group-candidates`, using the same typed policy
as creation and repair. Only homogeneous physical channels are eligible. Candidate diagnostics explain incompatible
quantities, enum intersections, ranges/grids and required cover metadata. A catalog or UI readiness result grants no
write authority: preview, persistence and dispatch each revalidate their own current contract.

Select 2–256 members, preview their common capabilities, optionally remove non-required controls, then preview again
before creating. Fan discrete speed, direction and mode display their native shared choices. A native percentage speed
remains numeric; no percentage/discrete conversion is offered. Changing profile, selected members, optional fields or
source metadata invalidates the previous preview. Existing measurement editors and light color tuples retain their
own flows.

For each physical Shelly NG cover, first choose the installed TYPE explicitly using its supported metadata endpoint:

```http
PATCH /api/v1/modules/devices/channels/<physical-channel>/properties/<type-property>
Content-Type: application/json

{"data":{"type":"devices-shelly-ng","format":["blind"]}}
```

Use the actual property integration `type` and a supported singleton installed covering type. Do not include `value`.
This is a configuration change, not a motor command. It persists through rediscovery. The wizard displays this guidance
and the precise TYPE incompatibility when the declaration is missing. It never guesses from names/models or publishes
configured TYPE as a physical sample.

Open the group's Admin detail to edit membership. Deleted members keep their original channel/property identities;
replace their live source explicitly. Repair candidates must preserve every durable output UUID and its exposed
capability contract. Metadata changes require reload/re-preview; an incompatible change cannot silently remove an
output referenced by scenes or tiles.

## Panel controls, quality and command outcomes

Native group categories open a shared group detail with actual reported feedback, contributor counts, missing member
identities and refusal reasons. False remains Off; missing, expired or unavailable is Unknown; disagreement is Mixed.
Reported expiry comes from actual source sample clocks. Refreshing REST does not renew it. Configured TYPE is separately
labelled. Numeric/enum fan speeds and cover positions are never averaged into an observation.

On/Off, compatible fan native controls and light tuples use the existing composite command transport. All tuple fields
are submitted together. Pending requests disable repeat submissions and retain actual feedback. Partial/failed,
superseded, timed-out and unavailable outcomes retain individual member identities/reasons. Reload/reconnect fences
late responses; configuration changes require an explicit reload and membership repair in Admin where necessary.

Cover controls use each operation's backend readiness. OPEN/CLOSE confirms motion started or an already correct
endpoint, not full travel. STOP requires the qualified stopped-feedback path described above. POSITION and TILT remain
unavailable as commands in the current adapter; they can still display qualified actual observations. Unsupported
providers, tag uncertainty, uncalibrated/unavailable position and missing bindings retain concrete refusal reasons.
The backend rechecks readiness and all core evidence/ordering guards at execution.

## Scenes and room intent scope

Admin scene action add/edit reads the same native group access/readiness metadata, including derived output properties
whose storage permission is read-only. Cover scene choices include only ready native COMMAND values; no position/tilt
control is advertised as usable. Scene execution remains in `LocalScenePlatform` and core composite dispatch with the
scene's existing absolute deadline, estimated group budget and per-member outcomes. There is no second command engine.

The existing covers room domain dispatches group OPEN/CLOSE/STOP as native COMMAND operations.
It uses shared canonical-leaf contribution selection to exclude represented raw members and reject overlapping groups.
Producer connectivity stays UNKNOWN and does not determine group command eligibility: room discovery and intents retain
the group identity, while the composite dispatcher revalidates qualified member readiness. An unavailable group never
falls back to its represented raw members, including members assigned a different room role. Ordinary physical
UNKNOWN/offline covers keep their existing offline refusal.
Repair overlap by changing membership or the existing cover participation role (HIDDEN excludes a representative).
Unrelated ordinary covers keep their existing position-first controls and dispatch independently of group convergence,
under the captured intent authority and absolute deadline. A refused or timed-out group does not suppress their sends.
Room controls display agreement/mixed/unknown actual position, source expiry, readiness/refusal and composite outcomes.
Group-containing rooms offer no relative-position, preset-mode or guessed position-to-command conversion. Room-wide
relative-position and mode requests fail for every target before any dispatch, including in mixed rooms. A group outside
a role-specific target does not block that role's ordinary controls. The shading page removes mode popups and also guards
retained popup callbacks when a room changes to grouped controls. Explicit
position requests still reach core validation and remain unavailable on the current qualified adapter. Ordinary
physical-only covers and the existing light room domain retain their policies.

There is currently **no standalone switch, outlet or fan room intent domain**. Device controls and scene actions for
those profiles are supported, but mapping them into lighting/HVAC or inventing a new room domain is outside this batch.
Consequently the broad room-control portion of #1453 remains limited to existing light and cover domains; this guide
and the epic do not mark #1453 delivered or close the issue. Installed-device qualification remains after alpha.
