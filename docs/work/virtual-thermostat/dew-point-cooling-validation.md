# Dew point and cooling software candidate — issue #1459

Status: preliminary source-only composition on current climate/main; fresh generation, checks and composed review pending. Not merged, published, deployed or installation-qualified.
Base: `cf8a5b656bc1eab246389cd73412f03228a66d32` from `origin/feat/virtual-thermostat-comfort-branches`.
Composition target: climate UI `0117d3f96786df5a4f412b83d77fb540b7d4e9cf`, including merged PR #1466 main
`6414291237813856b9a4b7c05401b225820df677`. The extension epic and issue remain open. This record does not complete native HA/Zigbee takeovers.

## Measurement contract

A dedicated persisted producer owns a read-only generic output and its existing UUID/time series. It uses the
existing sensor-transform device presentation, with separate dew-point configuration and exactly two durable
source roles: `dry_bulb` (temperature/°C) and `relative_humidity` (humidity/%). It does not change the single-input
transform/SDK operator interface or built-in policy JSON. Missing edges retain identities, source contract
fingerprints, role domains and repair diagnostics. Repair updates edges and revision while retaining the output.
Migrations 44/45 are additive; reserved migrations 42/43 and older migrations are untouched.

Formula `magnus-water-17.62-243.12-v1` uses
`gamma = ln(RH/100) + 17.62*T/(243.12+T)` and `Td = 243.12*gamma/(17.62-gamma)`.
The input and output domains are `-45 < T <= 60`, `0 < RH <= 100`, and `-45 < Td <= 60`; no clipping is used.
The [WMO training source](https://etrp.wmo.int/pluginfile.php/97653/mod_folder/content/0/Training%20Material/5_1_Humidity%20Part%201%20Introduction.pdf),
page 13, supplies the over-water Magnus coefficients and validity interval. Reference vectors in Celsius are:
20/50 → 9.255174599; 25/60 → 16.693149006; 30/70 → 23.927219625; 0/100 → 0.

Both current good-quality inputs are mandatory. There is no quorum or partial live result. Timestamp skew equality
is permitted; source-age/expiry equality expires. Output sample time is the earlier input time and expiry is the
earliest inherited or configured deadline. Startup, configuration/repair and reconnect require new accepted reports
for both inputs. Cached values, history, equal values and same-millisecond timestamps cannot renew authority.
`dew_point` is excluded from ambient/floor input, ordinary temperature aggregation, room contribution and generic HAP
mapping; Celsius is a unit, not permission to reinterpret the quantity.

Plural incorporated evidence is additive to the singular interface. Supplying both forms is rejected. Each derived
node captures its actual producer lease, revision and publication identity plus recursive accepted physical evidence.
Walks reject missing evidence, duplicates/cycles and depth >16, fan-in >32 or >256 visited nodes. Aggregate evidence
includes the admitted comparison cohort, including members later rejected as outliers. Every read and final publish
validates the captured tree. The final check occurs after awaited historical storage, immediately before producer
commit; an old historical write never becomes current producer authority. Ordinary lineage-free legacy display
publications remain supported but cannot be captured as protective evidence.

## Cooling protection and installed boundary

The optional version-one cooling policy is separate from `policy.floor`, its retained `local_floor` rows and existing
heating artifacts. Every mandatory cooling leaf has its own retained dedicated dew-point and genuine local cooled-surface
dependency, with original-age limits and fingerprints. A room-air probe is not proof of a cooled surface. Software
trips at `surface <= Td + margin`, or at/below an explicitly configured optional absolute minimum. Recovery is strictly
above every threshold plus the positive hysteresis. Missing/current-gap/configuration/protection-generation evidence
starts inhibited. A failed mandatory leaf inhibits and releases every cooling sibling; final queued sends reevaluate
current requested state, comfort arbitration, explicit OFF, ownership, graph and evidence. Recovery never restores a
captured obsolete request. Existing unresolved command journals and reservations remain until real qualified OFF,
readback and drainage. Timeout, lease elapsed, ACK and reported virtual activity do not prove release.

The separate internal qualification registry, adapter and authenticated session are implemented. They admit only a
complete current installed record bound to the exact artifact, physical identity, surface, timing, writers and restart
drainage; there is no permanent-refusal provider stub or public qualification bypass. This task creates no installed
record, so production cooling is explicitly reported as `cooling_remote_profile_installation_unqualified`. No installed record, boolean, adapter registration, old heating artifact or firmware pilot
observation qualifies it. The known pilot is firmware 1.7.5 and lacks humidity/cooling topology. Hardware procedure,
actual surface placement/calibration, measured timing, writer isolation, authentication and restart drainage are
post-alpha work. No script, pairing, deployment or actuation has occurred in this task.

## Separate authenticated remote profile

Provider `shelly-ng.remote-dew-point-lease` version 1 and protocol `sp-remote-dew-point-lease-1` have separate compiler,
artifact identity/bytes and session code. Binding includes actual hardware/device/model/firmware, actuator/component,
local surface peripheral/calibration/domain/configuration, remote lineage/formula/policy, timing and writer isolation
identities. Threshold and ON are one serialized admission. Threshold-only never implicitly energizes, and a higher
sequence threshold reevaluates active ON without automatically clearing a cutoff latch.

Each payload carries epoch, sequence, request ID, controller revision, protection fingerprint, threshold and absolute
device-uptime expiry bound to that artifact/session. The script starts OFF/inhibited, requires durable epoch rotation
and readback, good local surface evidence and unchanged configuration/peripherals/authentication, and uses finite
native `Switch.Set.toggle_after` for ON. OFF revokes backend queued ON authority synchronously, then attempts physical Set(false) before durable epoch work.
Storage/epoch-rotation failure still leaves OFF retry active and readiness inhibited. Actual Set(false) is followed by
GetStatus with no pending native ON; an epoch change never cancels a Switch.Set already issued. A reordered old native
ON callback forces another physical OFF and cannot clear inhibition or supersede a newer result. Backend restart
uncertainty remains sticky through repeated fences. An internal trusted installation witness must bind actual native
completion and OFF-readback evidence to physical identity, artifact/hash, session/epoch and the exact pending journal
IDs it covers. Untracked journals refuse release before any new OFF source freshness is written. No public boolean,
matching status, ACK, elapsed timeout or epoch alone supplies that witness.

The [HTTPServer documentation](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/HTTPServer/) confirms inherited
device authentication and a 3072-byte complete HTTP request limit. The separate client obtains a fresh 401 challenge
only via read-only status GET on the exact script host/URI. It requires Digest SHA-256, qop auth, actual device-ID
realm, then sends authenticated exact-method/URI POST JSON. Disabled auth (unauthenticated 200), wrong realm,
401/429/timeouts, authority loss and over-limit bytes fail closed. Credentials appear neither in URLs, logs, artifacts
nor public configuration. The old nonce-correlated GET heating transport is unchanged and is not authentication.
The [authentication documentation](https://shelly-api-docs.shelly.cloud/gen2/General/Authentication/) explicitly requires
a complete fresh challenge cycle on pre-2.0 firmware and reserves nonce reuse for 2.0+. HTTP Digest qop auth uses the
actual HTTP method and URI; its JSON bytes are sent as the POST body, not an RPC dummy-method Digest.

Replay uses one compact KVS record `{epoch,reservedThrough}` under **`sp_remote_dew_v1`**, with etag concurrency fencing.
The [KVS documentation](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/) limits a value to 253 bytes,
a key to 42 characters and the store to 50 keys. It also documents dotted-key reboot loss through firmware 2.0.0;
therefore this pinned-1.7.5 profile uses no dots in its key. An existing separately provisioned seed is an installation
prerequisite: absent/erased/corrupt storage never recreates epoch zero. Restart durably rotates the epoch and refuses
old packets. Before accepting the first sequence in a forward block, the script persists and reads back a reservation
of 256 sequences; RAM accepts only increasing sequences within it. Block writes are bounded to at most one per minute
(1440 reservation writes/day at the refusal limit), in addition to epoch writes at script start and each admitted protective OFF fence. OFF writes are not throttled; installed flash endurance and OFF cadence therefore require separate qualification. At one admitted
update per second, the normal reservation rate is about 338 writes/day. These are arithmetic software limits, not a
flash endurance certification or recommendation for an installed cadence. Emergency OFF is never rate-limited.
Failure/overflow inhibits. Exact current-epoch duplicates return the stored result without reapply or expiry renewal;
conflicting duplicates refuse. The backend retains each journal tuple, original captured source/graph/request/ownership
guard and original wall/monotonic budgets. Every exact retry combines that original guard with new attempt authority;
a fresh guard cannot reauthorize an old lower threshold. Changes of action, threshold, deadline, artifact/protection or
epoch require a fresh admitted journal identity. Normal finite ON renewal uses a new persisted command/request ID
and sequence while reevaluating the current threshold, including when the native output is already ON. Persistence/switch callbacks recheck epoch, sequence, supersession and absolute expiry.

Evidence wall expiry is captured once into a monotonic budget. Remaining lifetime is always the smaller of monotonic
remaining and wall-expiry-minus-now. Correlated authenticated status uptime U is observed before receipt R; packet
expiry is `U + remainingAtR - qualified transport/status/clock/drift/dispatch budgets`, capped by installed maximum
lease and refused below minimum lifetime. ACK/retry/late arrival does not rebase it. The script rejects nonfinite,
past, out-of-domain and over-max leases. [Switch.Set](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/)
documents the finite native flip-back timer. A remote threshold is stale during an outage: it cannot follow humidity
rise without a new report. Backend invalidation requests immediate OFF if reachable; otherwise only the committed
finite lease/native timer bounds exposure. Remote T/RH is not device-local humidity evidence or independent equipment
cutoff, and cross-device synchronous shutdown is not promised.

## Admin and Panel behavior

Admin creates and repairs the dedicated producer through the existing measurement editor, using both explicit role
pickers and retaining missing source identities and the output/history UUID. Draft previews show exact blockers and
bind saving to the current draft and graph revision. Numeric transform/SDK authoring remains separate. Cooling adds
an independent policy and a retained dew-point/surface binding for every mandatory member; it does not expose an
installation flag. Its request uses the source-owned `schemaVersion` field; the response retains `schema_version`.
Changing protection invalidates preview approval. All six locales include the new controls and validation messages.

Panel keeps configuration repair in Admin and extends read-only measurement and thermostat diagnostics. It labels
both dry-bulb/RH roles, original ages, retained identities, quantity and blockers. Requested mode, relay observation,
dew point, surface reading and server protection readiness remain distinct. Heating/floor and relay freshness fences
are unchanged. A separate bounded per-claim cooling display fence binds accepted membership, claim/dependency revision
and source identity to the original response expiry plus a captured monotonic budget. Identical cached refetches,
older evidence, source gaps, rebinds and wall rollback cannot restore expired values. Admin snapshots likewise retain
their first monotonic budget through identical reloads. A genuinely new current report with a later original expiry
can recover display freshness. These display fences never authorize a command or qualify an installation.

The cooling response has no independent physical-input publication token. Display recovery is consequently
conservative: a report whose original expiry does not advance cannot revive a withdrawn display reading, even if a
new HTTP response is received. No fetch timestamp or invented acceptance identity fills that gap.

## Preliminary current-climate composition

The accepted dew-point source `2fb98eb3a7265ae58c4fab9aa8f5a3e2861bfe13` is merged with the exact climate
UI target above. Source JSON/ARB leaves and metadata retain both parents' changes. Swagger registration includes
both dew-point and group catalogue models. Current HomeKit metadata handling and the dedicated `dew_point`
exclusion are retained together. Native HA/Zigbee takeover remains incomplete; no staging source is imported.

All seven tracked `app_localizations*.dart` files are exact climate-parent versions, inherited from main as
**PROVISIONAL placeholders**. They do not contain the complete merged ARB interface and must be regenerated
with Flutter 3.41.5 from all six merged ARB sources before review or publication. API/spec/client generation,
fresh backend/Admin/Panel checks and independent composed review also remain pending under the parent's serial
heavy-check grant. No generator, heavy test, type check, lint or Flutter command ran during this composition.

## Historical verification record

The following results apply to the original accepted sources, not this new merge. Prior `/tmp` logs were cleared
by a Mac restart; their paths below are historical references, not available evidence. Durable parent task/state
reports and source commits preserve the reported outcomes. Independent backend round-two and client round-one
reviews accepted their source checkpoints; fresh composition remains a separate gate.

- Backend software checkpoint `c32bfeb73712ed9f263d67161fc31a7fb5779bb2` received independent GPT-6-Sol high round-two
  acceptance after both requested fixes. Its bounded pack passed backend types and 135 distinct targeted cases
  (30 remote protocol/provider/session, 104 formula/SQLite/lineage, one existing runtime renewal boundary).
  This is software acceptance, not full-regression or installed evidence.
- Generation exposed a Nest DI bootstrap defect. Separate commit `3884e249dd88ada146aa40d6de64783579b49c87` follows
  existing runtimes with optional/default `ConfigService`. Three real Nest DI tests cover missing-provider fallback,
  retaining injected configuration and the CLI startup gate without application/transport I/O. The initial generator
  failure remains in `/tmp/virtual-1459-openapi-v6.log`.
- Annotation-only commit `dc0b7d627a025858547e08102a47d7f3007a258b` makes preview graph revision optional in Swagger.
  Actual SQLite tests prove preview omission does not persist and writes still require the current transaction fence.
  Focused DI/runtime pack: 9 passed, backend types passed. Logs: `/tmp/virtual-1459-swagger-tests-v6.log` and
  `/tmp/virtual-1459-swagger-types-v6.log`. Controller/service validation and migrations are unchanged by these deltas.
- Source-owned OpenAPI/Admin generation passed. Generated schema inspection confirms optional preview graph revision
  and request `schemaVersion`; API conventions and Spectral passed with no warnings/errors. Logs:
  `/tmp/virtual-1459-openapi-v6-optional.log`, `/tmp/virtual-1459-openapi-contract-v6.log`,
  `/tmp/virtual-1459-api-conventions-v6.log`, `/tmp/virtual-1459-openapi-validation-v6.log`.
- Flutter 3.41.5 offline dependency resolution and own API/spec/localization generators passed. Ignored API/spec outputs
  were neither manually edited nor force-added; tracked localization outputs come from all six ARB sources.
- Final Admin pack: 53 tests in six files passed, including actual editor cooling repair → preview → edit invalidation
  → save payload, dedicated producer creation/repair, retained identities, stale previews and monotonic expiry/reload.
  Types and scoped lint/format passed. Logs: `/tmp/virtual-1459-admin-tests-v6-delivery.log`,
  `/tmp/virtual-1459-admin-types-v6-final.log`, `/tmp/virtual-1459-admin-lint-v6-final.log`,
  `/tmp/virtual-1459-admin-format-v6-final.log`.
- Final Panel pack: 76 tests in seven files passed, with clean scoped analysis and formatting. It covers actual generated
  API decoding, actual detail/no-floor cooling, missing mandatory inputs, cached/older replies, rebind/revision/removal,
  recovery and preserved heating/floor/relay/comfort behavior. Clock rollback uses controlled-clock shared-fence/renderer
  tests; actual detail exercises the same production fence. Logs: `/tmp/virtual-1459-panel-tests-v6-final.log`,
  `/tmp/virtual-1459-panel-analysis-v6-final.log`, `/tmp/virtual-1459-panel-format-v6-final.log`.
- Initial client failures remain visible: missing ignored Admin specs/deduplicated enum, Node default 4 GiB heap exhaustion,
  incomplete legacy store mock, a misplaced new Dart test block, scoped prop-mutation lint, and integration-test input
  selectors that targeted Element Plus internals. They were corrected and rerun without weakening assertions. Initial
  and targeted-rerun logs were recorded under `/tmp/virtual-1459-*-v6-*.log`; older v4 failure/rerun logs were also recorded there.
- Local client commits: Admin `38dceaa29ea1391fe2c389a1cab66039f1ce7eef`, Panel
  `2d25c0c48b0e5e33e31f3221679972d6cf0c4777`. Full branch count is 92 changed source files relative to the exact base,
  including tracked localization output. No full-monorepo rerun was performed.
- Fresh composed review/checks, CI and CodeRabbit remain root gates; historical client acceptance does not validate
  the current merge. The narrow `dew_point` HomeKit `findProperty` exclusion must survive composition. No installed
  certification, live integration contact, issue closure, push, PR or alpha release is claimed.
