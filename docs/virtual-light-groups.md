# Virtual light groups

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

## Feedback and quality

`VirtualLightGroupStateService` consumes only `PropertyValueService.readQualifiedSample`: a provider must submit actual
live feedback using the core sample evidence contract. Database history, optimistic API writes and cached adoption
snapshots do not qualify. Each configured input expires after 300 seconds. Missing, disabled, offline, quarantined or
incompatible sources are unknown. A backend restart starts without qualified physical samples.

ON is true when any member is confirmed on, false only when every intended member is confirmed off, and otherwise null.
The reported API separately exposes all-on, mixed, on/off/unknown counts and each member's diagnostic reasons.
Brightness is the mean of valid on-member samples, with explicit contributors and mixed state. The diagnostic value
keeps the arithmetic mean; publication rounds a representative onto the output's validated step/integer grid and
records that rounding. Colors and color temperature select a contributor's consensus value, never an average of
opposed colors. Brightness is mixed whenever contributing values differ. Absolute native-unit color tolerances are 1 for
RGB/saturation, 2 degrees for hue, and 25 K for color temperature. Any unknown/mixed color component makes its whole RGB/HS representation unknown.

## Core command integration

`CompositePropertyCommandRegistryService` is an internal opt-in planner registry. The virtual plugin registers only
validated derived light outputs in a lighting actuator-group owner. Public DTOs cannot select planners or bypass a
read-only property. Parent target values still validate against the durable exposed contract.

The planner snapshots all intended bindings and the graph/configuration revisions. Core expansion covers an entire
mixed group/group/raw command request, normalizes canonical values, deduplicates equal leaves and rejects contradictory
leaves before physical I/O. Core retains RGB/HS properties in a single physical channel batch. Strict composite dispatch requires `prepareCompositeBatch` to capture exact
physical targets and an opaque provider identity lease. Providers without this profile are unavailable and receive no
physical command; their ordinary controls retain the existing platform preparation and dispatch behavior. Core
admits the prepared values and supplies an exact generation/deadline guard to the dispatch closure. Providers check
that guard and their stable identity at actual queued publish, then report qualified live feedback. Composite windows
require live causal evidence; ordinary windows retain their legacy convergence contract. No member platform loop lives in the virtual platform.

Up to eight physical channel batches run concurrently, with at most 128 active parents, 2048 expanded children and a
bounded total deadline (the existing intent budget, capped at 30 seconds). Independent members run despite another
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
Scenes count only confirmed parents as successful actions. A partial parent retains confirmed child outcomes in the
scene result, produces partial scene completion and does not stop unrelated actions. Legacy platform boolean contracts
remain unchanged.

`PropertyCommandAdmissionRegistryService` is the shared internal canonical admission hook for future controller claims.
Ordinary direct, scene, projection and expanded group commands consult the same leaf policy. It exposes no public
bypass flag. A future controller ownership implementation must add a registry-minted opaque command authority for its
own release/control path rather than trust caller-supplied context.

Admin authoring previews the common native contract before atomic creation, and membership edits require a fresh
revision preview. Repair conflicts preserve exposed output identities and their scene/tile references. Admin and panel
group controls use the exposed native range/step grid, submit complete RGB/HS tuples together, and show unavailable
controls when the exposed contract cannot be represented. Reported mixed/unknown state stays separate from requested
values and correlated per-member outcomes. A timeout or reconnect never automatically replays a group command.
Room contribution selection deduplicates group/member overlap while raw physical controls remain individually usable. Production availability depends on adapters submitting qualified live feedback; legacy
adapters that write only values remain unknown. A provider without guarded composite preparation is also refused at
dispatch, so neither optimistic writes nor a queued obsolete command can count as group success.
