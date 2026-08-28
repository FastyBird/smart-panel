# Homey SHS Compatibility Record

**Status:** In progress; safe inventory, production-service startup/recovery, SDK session/cleanup, restart-spanning
capability events, network recovery, disposable-device lifecycle, and stable restart-spanning mDNS evidence captured;
automatic mDNS discovery remains deferred, and physical/Homey-originated availability-event continuity is pending

**Started:** 2026-08-12

**Related task:** `FEATURE-PLUGIN-HOMEY`

## Purpose

This record is the evidence gate for the Homey local connector. It separates facts established from published artifacts
and offline tests from behavior observed against the subscribed Homey Self-Hosted Server (SHS). Production connector,
Socket.IO, and mDNS decisions below identify which evidence supports them and which live gaps remain open.

Never add a real endpoint, Homey ID, API key, device ID, zone or device name, private address, or raw response to this
file. Live results use synthetic aliases and sanitized captures only.

## Current gate status

| Area                                                  | Status                                                   | Evidence still required                                          |
| ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Credential-safe read probe                            | Passed on SHS `13.4.0` and `13.4.1` over HTTP `4859`     | Repeat over HTTPS `4860` if enabled                              |
| System, zone, device inventory, and individual device | Captured and sanitized                                   | None                                                             |
| Capability metadata and suffixed IDs                  | Inventory, explicit read, and write read-back passed     | None                                                             |
| Socket.IO events and reconnect                        | Capability event, restart, and network recovery passed   | Capture physical/Homey-originated availability-event continuity  |
| Allowlisted capability write                          | Passed on SHS `13.4.1`                                   | None                                                             |
| Error and permission-scope classification             | Five failure scenarios and three omitted scopes passed   | None                                                             |
| API-key revocation and replacement                    | Passed on SHS `13.4.1`                                   | None                                                             |
| Disposable-device lifecycle                           | Passed on SHS `13.4.1`                                   | None                                                             |
| Production-service startup                            | Online and offline-recovery passed on SHS `13.4.1`       | None                                                             |
| mDNS discovery                                        | Stable across one controlled restart; manual URL remains | Design safe identity verification before reconsidering discovery |
| SDK decision                                          | SDK selected behind connector boundary                   | Re-evaluate the pinned package and audit result on every upgrade |
| Sanitized fixture corpus                              | Nine live plus one synthetic device fixture              | Add physical/Homey-originated availability-event evidence        |

## Installation evidence

Complete this table after the live run. Values committed here must remain non-sensitive.

| Field                                    | Recorded value                                    |
| ---------------------------------------- | ------------------------------------------------- |
| Capture date                             | `2026-08-13`, `2026-08-26`, `2026-08-27`          |
| Realtime SDK probe date                  | `2026-08-14`, `2026-08-26`                        |
| mDNS observation date                    | `2026-08-14`, `2026-08-26`                        |
| SHS version                              | `13.4.0`, `13.4.1`                                |
| Container image tag and immutable digest | Pending                                           |
| Host operating system/architecture       | TrueNAS; version and architecture pending         |
| Topology                                 | Same LAN, separate host                           |
| Smart Panel to SHS network path          | Direct private-LAN connection                     |
| HTTP port `4859`                         | Confirmed for reads and the SDK Socket.IO session |
| HTTPS port `4860`                        | Pending                                           |
| TLS certificate behavior                 | Pending                                           |
| Disposable capability alias              | Pending synthetic alias                           |
| Disposable lifecycle-device alias        | `fbsp-lifecycle-disposable-device`                |

On 2026-08-26, the TrueNAS host was reachable but SHS stopped before opening its API ports because its required Avahi
daemon could not start. The deployment recovered after applying Homey's documented TrueNAS settings: disable the host
mDNS option, run the trusted SHS image with host networking and privileged mode, and restart the app. See the official
[Homey TrueNAS installation guide](https://support.homey.app/hc/en-us/articles/23981543357596-How-to-install-Homey-Self-Hosted-Server-on-TrueNAS).

## Published protocol baseline

The following facts were confirmed from the `homey-api` `3.19.2` package artifact and its bundled
`HomeyAPIV3Local.json` specification on 2026-08-12. They are inputs to the live test, not proof that the subscribed SHS
build behaves identically.

| Operation          | Method and path                                                      | Required scope          |
| ------------------ | -------------------------------------------------------------------- | ----------------------- |
| Identify Homey     | `GET /api/manager/system/ping`                                       | none                    |
| System information | `GET /api/manager/system/`                                           | `homey.system.readonly` |
| Zones              | `GET /api/manager/zones/zone`                                        | `homey.zone.readonly`   |
| Devices            | `GET /api/manager/devices/device`                                    | `homey.device.readonly` |
| Capability value   | `GET /api/manager/devices/device/:deviceId/capability/:capabilityId` | `homey.device.readonly` |
| Capability write   | `PUT /api/manager/devices/device/:deviceId/capability/:capabilityId` | `homey.device.control`  |

Authenticated calls use `Authorization: Bearer <token>`. The ping response is expected to include `X-Homey-ID` and
`X-Homey-Version`. The official local factory is `HomeyAPI.createLocalAPI({ address, token })` and performs the ping
before creating a local client.

## Safe read-only probe

The probe is intentionally independent of `homey-api`. It uses Node's built-in `fetch`, performs only six GET requests
(ping, system information, zones, inventory, one selected individual device, and one readable capability), blocks
redirects, applies a bounded timeout and response-size limit, and pins the configured URL to a separately supplied
expected host. The API key is not sent to the unauthenticated ping endpoint and is never written to a capture.

From `apps/backend`, enter values interactively so the key and private identifiers do not appear in shell history:

```bash
read -r FB_HOMEY_SHS_URL
read -r FB_HOMEY_SHS_EXPECTED_HOST
read -r -s FB_HOMEY_SHS_API_KEY
read -r FB_HOMEY_SHS_PRIVATE_TERMS
export FB_HOMEY_SHS_URL FB_HOMEY_SHS_EXPECTED_HOST FB_HOMEY_SHS_API_KEY FB_HOMEY_SHS_PRIVATE_TERMS
pnpm run homey:probe
```

Keep these base variables exported while running either optional probe below. Clear them only after the last probe you
intend to run.

`FB_HOMEY_SHS_PRIVATE_TERMS` is a comma-separated defense-in-depth list of household names or other strings that must
not survive sanitization. Every nonempty entry must contain at least three characters; configuration fails instead of
silently ignoring a shorter entry. Optional settings are:

| Variable                   | Default                    | Constraint                                                 |
| -------------------------- | -------------------------- | ---------------------------------------------------------- |
| `FB_HOMEY_SHS_TIMEOUT_MS`  | `10000`                    | Integer from `1000` through `60000`                        |
| `FB_HOMEY_SHS_CAPTURE_DIR` | `test/.homey-shs-captures` | Output root; the default repository path is ignored by Git |

The probe writes a new non-overwriting directory with mode `0700` and JSON files with mode `0600`. It sanitizes before
writing and aborts if the result still contains the API key, expected hostname, configured private terms, IPv4 or IPv6
addresses, MAC addresses, or email-like values. Redaction markers are opaque and excluded only from private-term
collision checks; credential checks remain fail-closed. IDs are deterministically pseudonymized, personal labels and
timestamps are replaced, and full capability IDs—including suffixes—are preserved. Personal labels use non-derived
opaque markers rather than public hashes. String values in driver-defined `data` and `settings` metadata are
conservatively redacted, and identifier-like key variants outside those containers are redacted as well.
Device/zone icons are made opaque, while source-host memory, load, CPU, runtime, and platform fields retain only
synthetic field shapes.

Automation is not a substitute for review. Before promoting any capture into committed fixtures:

1. inspect every value and object key manually;
2. search for the real key, endpoint host, Homey ID, device/zone IDs, household names, addresses, serials, and email;
3. split devices and events into minimal representative fixtures rather than committing the full inventory;
4. record only the synthetic SHS version/provenance fields required to reproduce compatibility behavior; and
5. run `pnpm run test:homey-spike` without live SHS access.

## Realtime SDK probe and live mutation gate

The realtime probe exercises the same reviewed `homey-api` `3.19.2` package used by the production local connector. It
connects and subscribes to the devices manager, records only allowlisted event labels and ordering, disconnects and
destroys the client, then verifies that a generated invalid key is rejected by the same pinned SHS endpoint. Raw event
payloads, errors, endpoints, keys, IDs, and values are never written to the report. Run it from the same interactive
shell that contains the read-only variables:

```bash
pnpm run homey:probe-realtime
```

`FB_HOMEY_SHS_REALTIME_OBSERVE_MS` optionally controls the passive event observation window from `0` through `60000`
milliseconds and defaults to `2000`. Without every write variable below, the probe has no code path that issues a
mutation. Every SDK client, subscription, read, write, restoration, and disconnect operation is bounded by
`FB_HOMEY_SHS_TIMEOUT_MS`. A failed or timed-out disconnect fails the probe and is never recorded as resolved, so no
report can claim successful cleanup when the transport did not confirm it.

The read-only live run on 2026-08-14 against SHS `13.4.0` and `homey-api` `3.19.2` recorded this sanitized order:

1. SDK creation resolved;
2. the Socket.IO connection opened;
3. the devices manager subscription resolved;
4. manager unsubscription resolved;
5. the socket emitted disconnect;
6. the explicit socket disconnect resolved; and
7. the SDK client was destroyed.

Cleanup completed and the write gate remained disabled. The same run proved that a generated invalid key was rejected
with HTTP `401`. No capability or availability event occurred during the passive observation window, so this result
does not close event-delivery, write-confirmation, restart, reconnect, timeout, or revoked-key evidence. The reviewed
report is committed as `__fixtures__/evidence/2026-08-14-shs-13.4.0-sdk-session.json`.

Manager reads and writes also receive the SDK-native `$timeout`; that timeout is registered before the probe's outer
watchdog. A timed-out write therefore settles inside the SDK before restoration is emitted afterward on the same
ordered Socket.IO transport. Capability-event matching opens only immediately before the allowlisted write and closes
after its observation window, preventing an unrelated matching event during subscription setup from satisfying the
write evidence.

Read and write tests must use different least-privilege keys where SHS supports that workflow. The read-only probe needs
only `homey.system.readonly`, `homey.zone.readonly`, and `homey.device.readonly`. A write test additionally needs
`homey.device.control`; do not grant general device management.

The write probe refuses to start unless all of the following variables are present and the live device/capability
exactly matches both allowlist values:

```text
FB_HOMEY_SHS_WRITE_ENABLE=I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE
FB_HOMEY_SHS_WRITE_DEVICE_ID=<disposable device ID>
FB_HOMEY_SHS_WRITE_CAPABILITY_ID=<harmless capability ID>
FB_HOMEY_SHS_WRITE_VALUE=<validated scalar value>
```

The value must be a JSON boolean, finite number, or string. Before mutation, the probe verifies that the exact
capability is settable, validates type/range/enum constraints, and performs a fresh API read of a safely restorable
original value. The requested value must differ from that original. It then requires the requested-value event and
read-back, restores the original value in `finally`, and requires a second read-back confirming restoration before the
sanitized report can be written.

On 2026-08-27, the guarded probe passed against SHS `13.4.1`: the requested write produced a matching capability event
and read-back, the original value was restored with a second matching read-back, all subscriptions and SDK resources
were cleaned up, and the independent invalid key was rejected with `401`. The sanitized nine-event report is committed
as `__fixtures__/evidence/2026-08-27-shs-13.4.1-write-confirmation.json`; it retains no device or capability identifier,
requested or original value, endpoint, credential, inventory content, or event payload.

## Operator-controlled disposable-device lifecycle probe

Lifecycle evidence uses a separate management-scoped, disposable API key and may target only a virtual/test device
created for this run. Do not reuse the regular read-only or capability-control key. The lifecycle key needs
`homey.device` for metadata updates and removal, plus `homey.device.readonly`, `homey.zone.readonly`,
`homey.system.readonly`, and `homey.flow.readonly` for fail-closed preflight, ownership, zone, instance, and flow
validation. Before it opens the operator add window, the probe exercises each read permission with bounded,
cache-bypassing requests and proves `homey.device` through a non-mutating lookup of a fresh cryptographically random
pair-session ID: only `404` proves authorization, while a collision, permission error, timeout, or transport failure
fails closed. Revoke the key when the run is complete.

The local Web API cannot generically create a virtual device or set device availability. The probe therefore
subscribes first and then opens a bounded observation window. During that window, the operator or a dedicated test
driver adds exactly one disposable device carrying the configured synthetic marker. Later, when prompted, the
operator or that same test driver makes only that device unavailable and available again. Do not disable a shared app:
that could change every device owned by the app. The probe rejects a lifecycle owner that has any device at baseline
and requires the run-bound device to remain its only device during availability checks.

The repository includes a private, test-only app at
`apps/backend/test/support/homey-lifecycle-test-app`. Its single driver exposes the fixed synthetic marker and names
listed in that directory's README. Pair it only after the lifecycle probe opens the add window. When the probe renames
and moves the bound device, it changes the driver's fixed lifecycle setting only after each availability listener is
active. The driver applies the requested unavailable or available state from that setting. This keeps lifecycle evidence
isolated from household apps and removes manual timing and slow-operation races from both availability stages.

After a `device.create` event or fresh inventory item exactly matches the marker, driver, owner, initial name, and source
zone allowlist, the probe binds the new runtime device ID in memory. If SHS omits the manager-level create/delete event
or a bound-device update event, the probe uses bounded, cache-bypassing inventory reads to verify the same complete
identity, requested state, or final absence and records each omitted event explicitly in the sanitized report. It never
treats an event-free inventory match as proof that an event was observed. Only after that binding may it use the bounded
local API operations to rename the device, move it to the destination zone, and remove it. The probe attempts to observe
`device.update` for rename, zone, and availability changes and `device.delete` for removal, with exact fresh reads after
mutations. It never accepts the first unrelated lifecycle event and never writes an identifier, name, event payload, or
raw error to the report.

Start from the base URL, expected-host, and private-term environment used by the safe read probe, but replace
`FB_HOMEY_SHS_API_KEY` with the dedicated lifecycle key. Enter all private values interactively:

```bash
read -r -s FB_HOMEY_SHS_API_KEY
read -r FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER
read -r FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID
read -r FB_HOMEY_SHS_LIFECYCLE_OWNER_URI
read -r FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME
read -r FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME
read -r FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID
read -r FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID
export FB_HOMEY_SHS_API_KEY FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER
export FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID FB_HOMEY_SHS_LIFECYCLE_OWNER_URI
export FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME
export FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID
export FB_HOMEY_SHS_LIFECYCLE_ENABLE=I_ACKNOWLEDGE_THIS_MUTATES_A_DISPOSABLE_DEVICE
export FB_HOMEY_SHS_LIFECYCLE_OPERATIONS=add,rename,zone-move,availability,remove
pnpm run homey:probe-lifecycle
```

The probe fails closed unless the acknowledgement and ordered operation list match those exact values. The device
marker must start with `fbsp-lifecycle-`, and both names must start with `FBSP Lifecycle`. The driver ID must belong to
the exact owner URI using Homey's `<owner-uri>:<driver>` form. Driver ID, owner URI, initial and renamed names,
and both distinct zone IDs are exact allowlist values. `FB_HOMEY_SHS_LIFECYCLE_ADD_WINDOW_MS` optionally sets the
bounded operator pairing window from `10000` through `300000` milliseconds and defaults to `90000`.
`FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS` independently sets the post-read-back event window for each lifecycle transition
over the same range and default. Keeping the add window long and the event window short gives the operator time to pair
without extending every absent-event check.

Never add, rename, move, make unavailable, or remove an ordinary household device. Use a dedicated test driver where
possible, and do not pair or discover physical equipment as part of this run. Successful completion requires the
device to be available again before removal, cleanup to complete, and a fresh final inventory read to prove the
runtime-bound ID, marker, and dedicated-app ownership are all absent. Automatic failure cleanup revalidates ownership,
app isolation, and the absence of standard or advanced flows immediately before its single permitted delete attempt.
If the probe stops after creation, follow its cleanup warning and remove only the marker-matching disposable device;
do not guess an ID or broaden the allowlist.

Clear the lifecycle variables and the disposable management key immediately after the final absence check:

```bash
unset FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_OPERATIONS
unset FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID
unset FB_HOMEY_SHS_LIFECYCLE_OWNER_URI FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME
unset FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID
unset FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID FB_HOMEY_SHS_LIFECYCLE_ADD_WINDOW_MS
unset FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS
unset FB_HOMEY_SHS_API_KEY
```

On 2026-08-27, the guarded lifecycle probe passed against SHS `13.4.1`. It verified the exact disposable device add,
rename, zone move, unavailable state, availability restoration, removal, and final absence, with flow checks and full
cleanup. SHS did not emit the manager create event or any of the bound-device update events during this run, so the
probe recorded those omissions and verified every resulting state with bounded, cache-bypassing inventory read-back;
the delete event was observed. The sanitized report is committed as
`__fixtures__/evidence/2026-08-27-shs-13.4.1-device-lifecycle.json`. This closes the lifecycle inventory-delta slice but
does not close physical/Homey-originated availability-event continuity.

The lifecycle run was repeated after the probe began retaining each listener through the full configured event
deadline. A separate 90-second operator add window allowed pairing without lengthening the transition checks; each
post-read-back event window remained open for 10 seconds. The result was semantically identical: no create, rename,
zone-move, unavailable, or availability-restoration event arrived, while delete was observed and every state read-back
and cleanup check passed. This confirms event absence for the synthetic lifecycle driver rather than extrapolating it
to physical devices or Homey/flow-originated changes.

## Operator-controlled production-service startup probe

The startup probe exercises the production `HomeyService`, `HomeyLocalConnectorFactory`, and pinned SDK transport in a
fresh backend process. It substitutes only a no-op synchronizer, so it can validate connection state, authoritative
inventory availability, reconnect accounting, and service cleanup without adopting devices or writing to the Smart
Panel database. It performs no Homey mutation and records no inventory content or count.

Run the online scenario first while SHS is reachable. Start from the same base URL, expected-host, API-key, and
private-term environment as the safe read probe. Completely unset every mutation, lifecycle, recovery, and
credential-rotation variable; even an empty value is rejected:

```bash
unset FB_HOMEY_SHS_WRITE_ENABLE FB_HOMEY_SHS_WRITE_DEVICE_ID FB_HOMEY_SHS_WRITE_CAPABILITY_ID
unset FB_HOMEY_SHS_WRITE_VALUE FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_OPERATIONS
unset FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID
unset FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID
unset FB_HOMEY_SHS_LIFECYCLE_OWNER_URI FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME
unset FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID
unset FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID FB_HOMEY_SHS_LIFECYCLE_ADD_WINDOW_MS
unset FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS FB_HOMEY_SHS_RECOVERY_ENABLE
unset FB_HOMEY_SHS_RECOVERY_SCENARIO FB_HOMEY_SHS_RECOVERY_OBSERVE_MS
unset FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS
unset FB_HOMEY_SHS_REPLACEMENT_API_KEY
export FB_HOMEY_SHS_STARTUP_SCENARIO=online
export FB_HOMEY_SHS_STARTUP_ENABLE=I_WILL_VERIFY_A_FRESH_ONLINE_HOMEY_STARTUP
pnpm run homey:probe-startup
```

The online report is written only if the newly constructed production service reaches healthy `CONNECTED` state,
publishes a non-null authoritative inventory snapshot, and stops cleanly.

For offline-at-boot recovery, block only this Mac's path to the dedicated test SHS ports `4859` and `4860` before
starting the command. Do not stop SHS, block the broader LAN, or alter the container. Then select the distinct scenario
and acknowledgement:

```bash
export FB_HOMEY_SHS_STARTUP_SCENARIO=offline-recovery
export FB_HOMEY_SHS_STARTUP_ENABLE=I_WILL_START_WITH_TEST_SHS_BLOCKED_AND_RESTORE_ONLY_WHEN_PROMPTED
export FB_HOMEY_SHS_STARTUP_OBSERVE_MS=90000
pnpm run homey:probe-startup
```

The probe first requires the production service to finish its initial attempt in unhealthy `RECONNECTING` state. Only
after it prints `Homey offline-startup recovery window is open` should the operator remove the narrow firewall rule.
The report is written only after a scheduled production reconnect reaches healthy `CONNECTED` state, increments the
service reconnect counter, makes an authoritative inventory snapshot available, and stops cleanly. The probe never
changes firewall or network state itself.

`FB_HOMEY_SHS_STARTUP_OBSERVE_MS` bounds initial service startup, the operator recovery window, and cleanup from
`10000` through `300000` milliseconds and defaults to `90000`. It must be greater than `FB_HOMEY_SHS_TIMEOUT_MS`, so
the intentionally blocked initial connection can fail and open the restoration prompt with time remaining. All
production connector operations remain internally bounded by `FB_HOMEY_SHS_TIMEOUT_MS`. If a startup or cleanup
deadline is exceeded, the run is marked failed but waits for that internally bounded operation and definitive service
teardown before returning. All failure messages and the exact-schema report use fixed labels only; endpoint, host, key,
Homey identity, inventory, device and zone identifiers, event payloads, and raw errors are excluded.

After both runs, restore the firewall and clear the startup gate:

```bash
unset FB_HOMEY_SHS_STARTUP_SCENARIO FB_HOMEY_SHS_STARTUP_ENABLE FB_HOMEY_SHS_STARTUP_OBSERVE_MS
```

Both guarded runs passed on 2026-08-27 against SHS `13.4.1`. The fresh-online run constructed the production service,
reached healthy `CONNECTED` state after authoritative inventory synchronization, exposed the inventory snapshot, and
stopped cleanly. The offline-recovery run began with only the test host's SHS path blocked, verified unhealthy
`RECONNECTING` state after the initial unavailable attempt, then used the production retry path after the operator
restored the firewall. It reached healthy `CONNECTED` state with an incremented reconnect counter, exposed a fresh
authoritative inventory snapshot, and stopped cleanly. The reviewed reports are committed as
`__fixtures__/evidence/2026-08-27-shs-13.4.1-startup-online.json` and
`__fixtures__/evidence/2026-08-27-shs-13.4.1-startup-offline-recovery.json`. They contain no endpoint, host, credential,
Homey identity, inventory content or count, device or zone identifier, event payload, firewall rule, or raw error.

## Operator-controlled restart during capability event flow

This mutating probe combines the previously proven allowlisted capability write with a real SHS restart in one
subscribed SDK session. It writes the validated disposable value and requires its matching event and read-back before
opening the restart window. After the operator restarts only the test SHS, it requires socket disconnect/reconnect,
manager resubscription, and a fresh inventory read. It then restores the in-memory original value and requires the
matching post-restart event and final read-back before cleanup and report creation.

Use the same disposable device, capability, and harmless alternative value as the successful realtime write probe.
Unset all other probe families, then enable the dedicated restart-event-flow acknowledgement:

```bash
unset FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_OPERATIONS
unset FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID
unset FB_HOMEY_SHS_LIFECYCLE_OWNER_URI FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME
unset FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID
unset FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID FB_HOMEY_SHS_LIFECYCLE_ADD_WINDOW_MS
unset FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS
unset FB_HOMEY_SHS_RECOVERY_ENABLE FB_HOMEY_SHS_RECOVERY_SCENARIO FB_HOMEY_SHS_RECOVERY_OBSERVE_MS
unset FB_HOMEY_SHS_STARTUP_ENABLE FB_HOMEY_SHS_STARTUP_SCENARIO FB_HOMEY_SHS_STARTUP_OBSERVE_MS
unset FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS
unset FB_HOMEY_SHS_REPLACEMENT_API_KEY
unset FB_HOMEY_SHS_REALTIME_OBSERVE_MS
export FB_HOMEY_SHS_WRITE_ENABLE=I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE
export FB_HOMEY_SHS_RESTART_EVENT_FLOW_ENABLE=I_WILL_RESTART_THE_TEST_SHS_WHILE_A_DISPOSABLE_CAPABILITY_IS_CHANGED
export FB_HOMEY_SHS_RESTART_EVENT_FLOW_RECOVERY_OBSERVE_MS=90000
export FB_HOMEY_SHS_RESTART_EVENT_FLOW_EVENT_OBSERVE_MS=10000
pnpm run homey:probe-restart-event-flow
```

Keep the test SHS online until the probe prints `Homey restart event-flow window is open`, then restart only that SHS
instance. Do not change the capability manually. `FB_HOMEY_SHS_RESTART_EVENT_FLOW_RECOVERY_OBSERVE_MS` accepts `1000`
through `300000` milliseconds and defaults to `90000`; the event window uses the same range and defaults to `10000`.
Every SDK operation remains independently bounded by `FB_HOMEY_SHS_TIMEOUT_MS`. If restart recovery or the
post-restart event fails, the probe still attempts exact original-value restoration before disconnecting. Check the
test device manually after any failed run. No report can claim success unless both events, both read-backs, restoration,
manager recovery, and complete cleanup pass.

On 2026-08-27, the guarded probe passed against SHS `13.4.1`. Its 23 ordered events prove the allowlisted request,
matching event, and read-back before restart; socket disconnect, two reconnect attempts, manager resubscription, and a
fresh uncached inventory read during recovery; then original-value restoration, its matching post-restart event and
read-back, and complete teardown. The exact-schema report is committed as
`__fixtures__/evidence/2026-08-27-shs-13.4.1-restart-event-flow.json` and contains no endpoint, credential, Homey or
device identity, capability identifier/value, inventory content, or raw error.

## Operator-controlled physical, Homey, and Flow-originated events

This probe performs no Smart Panel capability write. It subscribes to one exact allowlisted device/capability, records
its scalar baseline only in memory, and opens an operator window for a change originating from one declared source:
the physical device, the Homey app, or a designated Homey Flow. It requires a matching subscribed event and
authoritative read-back, then opens a second window in which the operator must restore the baseline through the same
source. No report is written unless the restoration event, final read-back, and complete teardown all pass.

Use a harmless capability whose state can be changed and restored from each source. Keep every Smart Panel mutation
and unrelated live-probe gate unset, enter the private target values interactively, then run one scenario at a time:

```bash
unset FB_HOMEY_SHS_WRITE_ENABLE FB_HOMEY_SHS_WRITE_DEVICE_ID FB_HOMEY_SHS_WRITE_CAPABILITY_ID
unset FB_HOMEY_SHS_WRITE_VALUE FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_OPERATIONS
unset FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID
unset FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID
unset FB_HOMEY_SHS_LIFECYCLE_OWNER_URI FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME
unset FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID
unset FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID FB_HOMEY_SHS_LIFECYCLE_ADD_WINDOW_MS
unset FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS
unset FB_HOMEY_SHS_RECOVERY_ENABLE FB_HOMEY_SHS_RECOVERY_SCENARIO FB_HOMEY_SHS_RECOVERY_OBSERVE_MS
unset FB_HOMEY_SHS_STARTUP_ENABLE FB_HOMEY_SHS_STARTUP_SCENARIO FB_HOMEY_SHS_STARTUP_OBSERVE_MS
unset FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS
unset FB_HOMEY_SHS_REPLACEMENT_API_KEY FB_HOMEY_SHS_REALTIME_OBSERVE_MS
unset FB_HOMEY_SHS_RESTART_EVENT_FLOW_ENABLE FB_HOMEY_SHS_RESTART_EVENT_FLOW_RECOVERY_OBSERVE_MS
unset FB_HOMEY_SHS_RESTART_EVENT_FLOW_EVENT_OBSERVE_MS

read -r FB_HOMEY_SHS_ORIGIN_EVENT_DEVICE_ID
read -r FB_HOMEY_SHS_ORIGIN_EVENT_CAPABILITY_ID
export FB_HOMEY_SHS_ORIGIN_EVENT_DEVICE_ID FB_HOMEY_SHS_ORIGIN_EVENT_CAPABILITY_ID
export FB_HOMEY_SHS_ORIGIN_EVENT_ENABLE=I_WILL_CHANGE_AND_RESTORE_ONLY_THE_ALLOWLISTED_HOMEY_CAPABILITY_OUTSIDE_SMART_PANEL
export FB_HOMEY_SHS_ORIGIN_EVENT_OBSERVE_MS=90000

export FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO=physical
pnpm run homey:probe-origin-event

export FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO=homey
pnpm run homey:probe-origin-event

export FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO=flow
pnpm run homey:probe-origin-event
```

For each command, wait for the change-window prompt before changing the capability. After its event and read-back pass,
wait for the restoration-window prompt and restore the original state through the same declared source. The probe
accepts only finite boolean, number, or string values and never persists either the baseline or changed value. A failed
run cannot restore the target itself because all Smart Panel write gates are prohibited; restore it manually if the
second operator action did not complete. `FB_HOMEY_SHS_ORIGIN_EVENT_OBSERVE_MS` accepts `1000` through `300000`
milliseconds and independently bounds both operator windows and each read-back convergence window.

On 2026-08-28, all three scenarios passed against SHS `13.4.1`. Physical control, the Homey app, and a designated
Homey Flow each produced the subscribed capability-change event and matching authoritative read-back; the same origin
then restored the baseline with a second event and final read-back. Every run completed device, manager, socket, and
SDK teardown. The reviewed reports are committed as
`__fixtures__/evidence/2026-08-28-shs-13.4.1-origin-physical.json`,
`__fixtures__/evidence/2026-08-28-shs-13.4.1-origin-homey.json`, and
`__fixtures__/evidence/2026-08-28-shs-13.4.1-origin-flow.json`. They contain no endpoint, credential, Homey identity,
device or capability identifier, capability value, inventory content, event payload, Flow identity, response body, or
raw error.

## Allowlisted Smart Panel mapping-family control

This probe validates the production Smart Panel command path rather than calling the SDK directly. It starts a fresh
production `HomeyService`, loads the current built-in and user mapping catalog, binds one exact device/capability/mapping,
and invokes `HomeyDevicePlatform` with an operator-selected panel value. The platform revalidates the live inventory,
property constraints, mapping binding, and inverse transformation before `HomeyService` performs the bounded write and
authoritative confirmation. A fresh device read must match, after which the original value is restored through the same
platform path and verified again before shutdown.

Only reversible bidirectional mappings are allowed. The guarded family catalog is:

| Family     | Allowed mapping names                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| `lighting` | `light-power`, `light-brightness`, `light-hue`, `light-saturation`, `light-color-temperature` |
| `switch`   | `outlet-power`, `generic-switch-power`                                                        |
| `cover`    | `window-covering-position`, `window-covering-tilt`                                            |
| `lock`     | `lock-on`                                                                                     |

Climate control is not part of this gate because the approved local mapping catalog intentionally defers target and
mode projection until a verified actual-activity signal is available. Sensor, safety, battery, and energy families are
read-only. The probe derives the full set of reversible writable families currently available in the live inventory
and records only their fixed family labels, never counts or target details.

Use the Homey inventory endpoint locally to select harmless targets. Keep the output private: it contains device names
and identifiers. For every family reported as available, choose one exact capability and a safe panel value different
from its current value. The probe rejects a baseline that cannot round-trip exactly and always attempts restoration if
the command path was entered.

Start from the base URL, expected-host, API-key, timeout, and private-term variables used by the read probe. Clear every
other live-probe family, then set one target at a time without putting its identifiers in repository files:

```bash
for variable in $(env | awk -F= '
  /^FB_HOMEY_SHS_(CREDENTIAL_ROTATION|LIFECYCLE|ORIGIN_EVENT|REALTIME|RECOVERY|REPLACEMENT|RESTART_EVENT_FLOW|STARTUP|WRITE)_/ {
    print $1
  }
'); do
  unset "$variable"
done

export FB_HOMEY_SHS_MAPPING_CONTROL_ENABLE=I_WILL_USE_SMART_PANEL_TO_CONTROL_AND_RESTORE_ONLY_THE_ALLOWLISTED_HOMEY_MAPPING_TARGET
export FB_HOMEY_SHS_MAPPING_CONTROL_FAMILY=lighting
export FB_HOMEY_SHS_MAPPING_CONTROL_MAPPING_NAME=light-brightness

read -r FB_HOMEY_SHS_MAPPING_CONTROL_DEVICE_ID
read -r FB_HOMEY_SHS_MAPPING_CONTROL_CAPABILITY_ID
read -r FB_HOMEY_SHS_MAPPING_CONTROL_PANEL_VALUE
export FB_HOMEY_SHS_MAPPING_CONTROL_DEVICE_ID
export FB_HOMEY_SHS_MAPPING_CONTROL_CAPABILITY_ID
export FB_HOMEY_SHS_MAPPING_CONTROL_PANEL_VALUE

pnpm run homey:probe-mapping-control
```

Repeat with a representative mapping for each family that the first successful report lists in `availableFamilies`.
Boolean panel values are entered as `true` or `false`; mapped percentages, angles, hue, and color temperature are
entered in Smart Panel units. Inspect the controlled equipment after any failed run. No success report is written
unless the requested command, fresh read-back, exact restoration, restoration read-back, and service shutdown all pass.
The report contains no endpoint, credential, Homey identity, device or capability identifier, capability value,
inventory content/count, event payload, response body, or raw error.

## Operator-controlled restart recovery probe

The recovery probe measures the SDK's behavior across a real SHS restart without performing the restart itself. It
first creates the local SDK client and subscribes to the devices manager. Only then does it print that the observation
window is open. During that window, the operator restarts only the designated test SHS instance from a separate
terminal or management interface. The probe requires this ordered evidence before writing a report:

1. the subscribed socket disconnects;
2. the SDK transport reconnects;
3. the devices manager reports that its subscription is restored; and
4. a bounded post-reconnect inventory read succeeds.

Cleanup then unsubscribes the manager, disconnects the socket, and destroys the SDK client. The exact-schema report
contains only fixed event labels, their order, and completion booleans. It contains no endpoint, API key, device data,
inventory count, event payload, error detail, or identifier.

Start from the same interactive shell as the read-only probe, ensure every `FB_HOMEY_SHS_WRITE_*` and
`FB_HOMEY_SHS_LIFECYCLE_*` variable is unset, then enable only the operator-controlled recovery gate:

```bash
unset FB_HOMEY_SHS_WRITE_ENABLE FB_HOMEY_SHS_WRITE_DEVICE_ID FB_HOMEY_SHS_WRITE_CAPABILITY_ID
unset FB_HOMEY_SHS_WRITE_VALUE FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID
unset FB_HOMEY_SHS_LIFECYCLE_OPERATIONS
export FB_HOMEY_SHS_RECOVERY_SCENARIO=restart
export FB_HOMEY_SHS_RECOVERY_ENABLE=I_WILL_RESTART_THE_TEST_SHS_DURING_THIS_PROBE
pnpm run homey:probe-recovery
```

Wait for `Homey restart recovery observation window is open`, restart the test SHS, and do not alter networking,
credentials, or ordinary household devices during the run. `FB_HOMEY_SHS_RECOVERY_OBSERVE_MS` optionally controls the
operator window from `10000` through `300000` milliseconds and defaults to `90000`. SDK creation, manager operations,
post-reconnect verification, and cleanup remain independently bounded by `FB_HOMEY_SHS_TIMEOUT_MS`. A timeout or cleanup
failure writes no report and exposes only a fixed sanitized error.

This runbook does not authorize Smart Panel tooling or an automated agent to restart SHS. Only an operator may perform
the restart while the gated probe is open.

The operator-controlled run on 2026-08-26 against SHS `13.4.1` recorded the required disconnect, reconnect, manager
resubscription, and fresh inventory read, followed by successful manager unsubscription, socket disconnect, and SDK
destruction. The reviewed 15-event report is committed as
`__fixtures__/evidence/2026-08-26-shs-13.4.1-restart-recovery.json`. Capability values were not changed during the run.

### Operator-controlled network interruption and restoration

The same recovery harness can record a network interruption as a separate exact-schema scenario. It does not change
interfaces, routes, firewall rules, containers, or network state. After the manager subscription is active, the
operator temporarily interrupts only the designated test SHS network path. The probe prints a second message after it
observes the socket disconnect; only then does the operator restore the test path. The probe requires transport
reconnection, manager resubscription, a fresh inventory read, and complete cleanup exactly as it does for restart.

Start from the base read-only environment, ensure every write and lifecycle variable is unset, then select the network
scenario and its distinct acknowledgement:

```bash
unset FB_HOMEY_SHS_WRITE_ENABLE FB_HOMEY_SHS_WRITE_DEVICE_ID FB_HOMEY_SHS_WRITE_CAPABILITY_ID
unset FB_HOMEY_SHS_WRITE_VALUE FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID
unset FB_HOMEY_SHS_LIFECYCLE_OPERATIONS
export FB_HOMEY_SHS_RECOVERY_SCENARIO=network-interruption
export FB_HOMEY_SHS_RECOVERY_ENABLE=I_WILL_INTERRUPT_AND_RESTORE_THE_TEST_SHS_NETWORK_DURING_THIS_PROBE
pnpm run homey:probe-recovery
```

Wait for the network-scenario observation window, interrupt only the test SHS path, then wait for `Homey network
disconnect observed` before restoring it. Do not interrupt the broader household LAN, the Smart Panel agent host, or an
ordinary Homey installation. The restart acknowledgement is rejected in network mode and the network acknowledgement
is rejected in restart mode, preventing one operator authorization from being reused for a different action.

The operator-controlled run on 2026-08-26 against SHS `13.4.1` temporarily blocked only the Smart Panel test host's
path to SHS ports `4859` and `4860` for 60 seconds. The reviewed 36-event report proved disconnect, nine reconnect
attempts during that finite interruption, transport reconnection, manager resubscription, a fresh inventory read, and
complete cleanup. No capability, device, or credential was changed. The report is committed as
`__fixtures__/evidence/2026-08-26-shs-13.4.1-network-recovery.json`; it contains neither the firewall rule nor any
address, endpoint, inventory, credential, or payload.

After the run, restore the default restart mode explicitly or clear the scenario and acknowledgement:

```bash
unset FB_HOMEY_SHS_RECOVERY_SCENARIO FB_HOMEY_SHS_RECOVERY_ENABLE
```

This runbook authorizes only the operator to interrupt and restore the dedicated test SHS path. The probe and automated
agents do not change networking.

## Operator-controlled API-key revocation and replacement probe

The credential-rotation probe verifies the remaining revoked-key behavior without changing devices or revoking a key
itself. Before attaching either credential, it performs the unauthenticated system ping and requires the Homey identity
and version headers. It then proves that both the primary dedicated test key and a distinct replacement key can read
device inventory. The operator revokes only the primary test key through Homey. The probe polls the same pinned
inventory endpoint until that key returns HTTP `401`, then proves the replacement key still works. It performs only GET
requests, refuses redirects, and sends both keys only after the configured endpoint proves it is Homey.

Do not use a key shared by Smart Panel, another application, or a person. Create two disposable test keys with
`homey.device.readonly`, enter the replacement without adding it to shell history, and ensure every write, lifecycle,
and recovery gate is unset:

```bash
read -r -s FB_HOMEY_SHS_REPLACEMENT_API_KEY
export FB_HOMEY_SHS_REPLACEMENT_API_KEY
unset FB_HOMEY_SHS_WRITE_ENABLE FB_HOMEY_SHS_WRITE_DEVICE_ID FB_HOMEY_SHS_WRITE_CAPABILITY_ID
unset FB_HOMEY_SHS_WRITE_VALUE FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID
unset FB_HOMEY_SHS_LIFECYCLE_OPERATIONS FB_HOMEY_SHS_RECOVERY_ENABLE FB_HOMEY_SHS_RECOVERY_OBSERVE_MS
unset FB_HOMEY_SHS_RECOVERY_SCENARIO
export FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE=I_WILL_REVOKE_THE_TEST_KEY_DURING_THIS_PROBE
pnpm run homey:probe-credential-rotation
```

Wait for `Homey credential rotation observation window is open`, then revoke only the key currently stored in
`FB_HOMEY_SHS_API_KEY`. `FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS` controls the operator window from `10000` through
`300000` milliseconds and defaults to `90000`. Each inventory request remains independently bounded by
`FB_HOMEY_SHS_TIMEOUT_MS`, while the whole polling loop cannot exceed the operator window. Any transport failure,
unexpected status, replacement-key failure, timeout, or report-safety failure writes no evidence.

The exact-schema report contains only six fixed ordered event labels, completion booleans, and the expected `401`
status. It contains no endpoint, token, device data, inventory count, response body, raw error, or identifier. After a
successful run, replace the exported primary value for any later probe and clear the rotation-only variables:

```bash
export FB_HOMEY_SHS_API_KEY="$FB_HOMEY_SHS_REPLACEMENT_API_KEY"
unset FB_HOMEY_SHS_REPLACEMENT_API_KEY FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE
unset FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS
```

This runbook authorizes only the operator to revoke the dedicated primary test key. The probe and automated agents do
not create, revoke, rotate, or otherwise administer Homey credentials.

The operator-controlled run on 2026-08-27 against SHS `13.4.1` recorded the exact six-event sequence. Both disposable
keys completed the initial inventory read, the operator revoked only the primary key after the observation window
opened, the probe observed `401`, and the replacement key completed the final inventory read. The reviewed report is
committed as `__fixtures__/evidence/2026-08-27-shs-13.4.1-credential-rotation.json`; it contains no endpoint, Homey
identity, credential, inventory data, response body, raw error, or identifier.

## Privacy-safe mDNS observation probe

The mDNS probe performs a bounded wildcard DNS-SD observation so it can compare Homey with other services advertised by
the same host. It does not read or send `FB_HOMEY_SHS_API_KEY`. Although the browser necessarily receives other LAN
advertisements in memory, the probe immediately discards every service whose hostname or address does not exactly match
`FB_HOMEY_SHS_EXPECTED_HOST`. The persisted exact-schema report contains only the matched service type, protocol, port,
and sorted TXT key names. Service names, hostnames, addresses, TXT values, referer data, FQDNs, URLs, credentials, and
raw errors have no report fields.

Run it from the same interactive shell as the read-only probe:

```bash
pnpm run homey:probe-mdns
```

`FB_HOMEY_SHS_MDNS_OBSERVE_MS` optionally controls the observation window from `1000` through `30000` milliseconds and
defaults to `5000`. The report uses the shared `FB_HOMEY_SHS_CAPTURE_DIR` and the same non-overwriting `0700` directory
and `0600` file modes as the other probes. A zero-match result is valid evidence that no matching advertisement was
seen during that bounded window; it is not proof that SHS never advertises. Closing the discovery decision still
requires stable observations before and after an SHS restart, or an explicit documented decision to defer mDNS.

Two consecutive five-second observations on 2026-08-14 produced the same sanitized host match: `_http._tcp` on port
`80` with no TXT keys. The reviewed report is committed as
`__fixtures__/evidence/2026-08-14-shs-13.4.0-mdns-host-match.json`. Because the record is generic and the observed port
is not either documented SHS API port, this does not establish that SHS owns the advertisement or provide a safe
discovery discriminator.

A ten-second observation on 2026-08-26 after SHS `13.4.1` started on TrueNAS matched `_homey._tcp` on port `4859`, with
the TXT key names `id`, `model`, `name`, and `version`. It also matched two co-hosted `_hap._tcp` services. The reviewed
pre-restart report is committed as `__fixtures__/evidence/2026-08-26-shs-13.4.1-mdns-homey-advertisement.json`. A second
ten-second observation after the controlled restart produced an exact canonical match and is committed as
`__fixtures__/evidence/2026-08-26-shs-13.4.1-mdns-post-restart.json`. The service names, hosts, addresses, and all TXT
values remain excluded.

### Server-discovery decision

Automatic Homey server discovery remains explicitly deferred for the local MVP. Smart Panel does not register a Homey
mDNS discoverer and does not expose Homey server-discovery or rescan endpoints. The `_homey._tcp` observation is
attributable and stable across the controlled restart, but TXT values are intentionally excluded from evidence. Safe
identity deduplication, spoof-resistant endpoint verification, expiry, and duplicate-record behavior still require a
reviewed design before the advertisement can become a discovery input.

Administrators configure the local Homey URL manually through the plugin configuration and can verify either the
fully saved configuration or a complete candidate URL/new-key pair through the connection-test endpoint. Manual setup
does not depend on the mDNS module and remains the supported fallback if automatic discovery is reconsidered later.

For manual setup:

1. Enter the complete `http` or `https` SHS/Homey local API URL, including its configured port. The URL must not contain
   embedded credentials.
2. Enter a newly created scoped API key in the write-only `api_key` field and save the plugin configuration. A later
   update may omit the field to preserve the stored key; config responses return only `api_key_configured`.
3. Test the persisted URL/key with `saved` connection-test mode, or test an unsaved URL only by supplying both the
   candidate URL and a new key in `candidate` mode.
4. Enable the plugin after the saved configuration passes validation. No discovery scan or discovery result is needed
   before the connector starts.

The ignored live-capture probe and sanitized evidence fixture remain available for future compatibility work. Automatic
discovery may be reconsidered only when an advertisement can be attributed specifically to SHS/Homey, is stable before
and after restart, exposes enough non-secret metadata to deduplicate by Homey identity, and can be validated without
sending credentials to an unverified endpoint. Until all of those conditions are met, no guessed service type, port,
TXT field, or discovery route is shipped.

## Non-mutating error-classification probe

The error probe records only fixed category labels, rejection booleans, and HTTP status codes. It performs three live
GET requests against the pinned SHS origin: a generated invalid key, an allowed device inventory read using a separate
device-only key, and a system-information read using that same restricted key. The allowed read must succeed before a
`403` system response can count as missing-scope evidence, so an invalid second token cannot be mislabeled as an
authorization failure.

Create a second least-privilege key with only `homey.device.readonly`, enter it without adding it to shell history, and
run the probe from the same interactive shell as the read-only capture:

```bash
read -r -s FB_HOMEY_SHS_DEVICE_ONLY_API_KEY
export FB_HOMEY_SHS_DEVICE_ONLY_API_KEY
pnpm run homey:probe-errors
```

After the last probe you intend to run, clear every credential and private value from the interactive shell:

```bash
unset FB_HOMEY_SHS_DEVICE_ONLY_API_KEY FB_HOMEY_SHS_URL FB_HOMEY_SHS_EXPECTED_HOST FB_HOMEY_SHS_API_KEY
unset FB_HOMEY_SHS_WITHOUT_DEVICE_API_KEY FB_HOMEY_SHS_WITHOUT_ZONE_API_KEY
unset FB_HOMEY_SHS_PRIVATE_TERMS
```

The probe also verifies the shared URL validator rejects a non-HTTP candidate. Unavailable-host and timeout categories
are exercised against ephemeral loopback servers owned by the probe; it does not scan another LAN port or send the API
keys anywhere except the configured SHS origin. Every request uses `GET`, blocks redirects, and is bounded by
`FB_HOMEY_SHS_TIMEOUT_MS`; the local simulations use a shorter `250` ms cap. Response bodies, raw transport errors,
URLs, addresses, keys, and private terms are never written. A report is created only after all five scenarios pass,
under the same ignored capture root and restrictive directory/file modes as the inventory and realtime probes.

The 2026-08-26 combined live/local run passed all five classifications. Against SHS `13.4.1`, a generated invalid key
returned `401`; a device-read-only key first completed an allowed inventory request with `200` and then received `403`
for the forbidden system-information request. The shared validator rejected the non-HTTP candidate, while probe-owned
loopback servers produced the unavailable and timeout categories. The reviewed report is committed as
`__fixtures__/evidence/2026-08-26-shs-13.4.1-error-matrix.json`. It does not prove API-key revocation or replacement.

## Complete permission-scope matrix probe

The separate permission-scope probe closes the two permission cases that the error-classification report intentionally
does not claim. It first performs an unauthenticated Homey ping and requires the identity and version headers. Only
after that identity check does it send three distinct restricted credentials to the pinned SHS origin. Each credential
must complete one allowed read with `200` before the probe accepts `403` for the independently omitted permission:

| Credential     | Required permissions                             | Allowed proof    | Required denial    |
| -------------- | ------------------------------------------------ | ---------------- | ------------------ |
| Device only    | `homey.device.readonly`                          | Device inventory | System information |
| Without zone   | `homey.system.readonly`, `homey.device.readonly` | Device inventory | Zone inventory     |
| Without device | `homey.system.readonly`, `homey.zone.readonly`   | Zone inventory   | Device inventory   |

Create the two additional disposable restricted keys, enter them without adding their values to shell history, and run
the probe from the same interactive shell. The previously configured device-only key is reused for the missing-system
case:

```bash
read -r -s FB_HOMEY_SHS_WITHOUT_ZONE_API_KEY
read -r -s FB_HOMEY_SHS_WITHOUT_DEVICE_API_KEY
export FB_HOMEY_SHS_WITHOUT_ZONE_API_KEY FB_HOMEY_SHS_WITHOUT_DEVICE_API_KEY
unset FB_HOMEY_SHS_WRITE_ENABLE FB_HOMEY_SHS_WRITE_DEVICE_ID FB_HOMEY_SHS_WRITE_CAPABILITY_ID
unset FB_HOMEY_SHS_WRITE_VALUE FB_HOMEY_SHS_LIFECYCLE_ENABLE FB_HOMEY_SHS_LIFECYCLE_OPERATIONS
unset FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER
unset FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID FB_HOMEY_SHS_LIFECYCLE_OWNER_URI
unset FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME
unset FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID
unset FB_HOMEY_SHS_LIFECYCLE_ADD_WINDOW_MS FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS
unset FB_HOMEY_SHS_RECOVERY_ENABLE FB_HOMEY_SHS_RECOVERY_SCENARIO
unset FB_HOMEY_SHS_RECOVERY_OBSERVE_MS FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE
unset FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS FB_HOMEY_SHS_REPLACEMENT_API_KEY
pnpm run homey:probe-scopes
```

All four configured credentials must be distinct. The full-read key is validated by the shared configuration loader but
is not sent by this probe. Mutation, recovery, and credential-rotation gate variables must be completely unset; even an
empty or disabled-looking value is rejected. The seven requests are GET-only, redirect-blocked, and independently
bounded by `FB_HOMEY_SHS_TIMEOUT_MS`.

The exact-schema report contains only the three fixed permission labels, `200`/`403` status codes, the authorization
category, and rejection booleans. It has no fields for endpoints, Homey identities, credentials, inventory data,
response bodies, or raw errors. A report is written only after all three allowed/denied pairs pass.

The operator-controlled run on 2026-08-27 against SHS `13.4.1` passed all three pairs. Each independently valid
restricted credential completed its allowed inventory request with `200`, then received `403` for the omitted system,
zone, or device permission. The exact generated report is committed as
`__fixtures__/evidence/2026-08-27-shs-13.4.1-permission-scopes.json`; it contains no private value or response payload.

## SDK artifact review

Artifact snapshot inspected on 2026-08-12 and rechecked on 2026-08-25:

| Property             | Finding                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Package              | `homey-api` `3.19.2`, published 2026-07-29 and pinned exactly as a production dependency                      |
| Release activity     | Eight releases from 2026-03-25 through 2026-07-29; `3.19.2` remained the latest on 2026-08-25                 |
| Runtime declaration  | Node.js `>=24`; root, backend, and packaged-server engine declarations are aligned to `>=24`                  |
| License              | Use permitted with Homey products; source proprietary to Athom B.V.; no warranty; packaged `LICENSE` retained |
| Installed size       | Approximately 1.19 MB unpacked across 128 files                                                               |
| Runtime dependencies | Resolved to `engine.io-client 3.5.6`, `socket.io-client 2.5.0`, `node-fetch 2.7.0`, `form-data 4.0.6`         |
| Local entry point    | `HomeyAPI.createLocalAPI({ address, token })`                                                                 |
| HTTP behavior        | Bearer authentication and generated manager paths described above                                             |
| Realtime behavior    | WebSocket-only Socket.IO; live connect, subscribe, unsubscribe, disconnect, and destroy order verified        |

### Final dependency decision

**Decision:** use the official `homey-api` SDK behind the local connector boundary for the local MVP. Direct built-in
HTTP remains the independent read-only compatibility/capture path, not the production realtime transport. The decision
is based on the live SHS session and cleanup evidence, the SDK-native manager/capability contract, and the production
adapter suites covering bounded creation and operations, subscription cleanup, reconnect coalescing, duplicate-listener
prevention, late-client disposal, and normalized error handling. Live SHS restart and network-interruption session
recovery now pass; availability event-flow continuity remains a release-evidence gap, not an SDK abstraction gap.

The package license permits use with Homey products. Smart Panel loads it only for a user-configured Homey integration,
does not copy or modify its proprietary source, and preserves the package's own `LICENSE` in installed production
dependencies. Because backend source imports the SDK at runtime and production installers omit development dependencies,
`homey-api` is a production dependency. Its exact pin prevents an unreviewed proprietary/runtime update from entering a
release.

The 2026-08-25 `pnpm audit` reported one moderate advisory on this dependency path:
`homey-api > engine.io-client > parseuri 0.0.6` ([GHSA-6fx8-h7jm-663j](https://github.com/advisories/GHSA-6fx8-h7jm-663j)).
No patched `parseuri` release exists for that legacy chain. The affected parser receives only an administrator-supplied
Homey endpoint; Smart Panel restricts it to credential-free HTTP(S), caps it at 2,048 characters before the SDK sees it,
and applies bounded connect/operation timeouts. This accepted residual risk must be rechecked on every SDK upgrade and
blocks relaxing the endpoint validation.

Only production `homey-sdk.client.ts` imports `homey-api`; compatibility probes import it independently under `test/`.
SDK values stay behind `HomeySdkClient`/`HomeyLocalTransport` interfaces, and the connector transforms them into plain
normalized models before mapping, adoption, synchronization, or control code can consume them. The replacement is a
connector-owned adapter using the documented HTTP and Socket.IO protocol. It must pass the existing transport,
connector-contract, normalization, lifecycle, and command suites without changing any downstream service or stored
device model.

## Live result matrix

Fill this matrix using synthetic aliases only.

| Scenario                                  | Result                              | Sanitized observation                                                                                                                                |
| ----------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP `4859` ping and authenticated reads  | Pass                                | Read-only system, zone, and device requests completed without redirects                                                                              |
| HTTPS `4860` ping and authenticated reads | Pending                             |                                                                                                                                                      |
| Invalid key                               | Pass                                | Both the SDK session probe and error-matrix probe rejected independently generated invalid keys with HTTP `401`                                      |
| Missing system scope on device-only key   | Pass                                | The restricted key completed the allowed device inventory read with `200`, then the system-information read returned `403`                           |
| Missing zone and device scopes            | Pass                                | Independently valid restricted keys completed allowed inventory reads with `200`, then each omitted permission returned `403`                        |
| Bad URL and unavailable host              | Pass                                | Shared validation rejected a non-HTTP URL; a probe-owned closed loopback port produced the unavailable category                                      |
| Request timeout                           | Pass                                | A probe-owned loopback server that withheld its response produced the timeout category within the local simulation cap                               |
| Complete inventory and individual read    | Pass                                | Complete inventory captured: 118 devices and 16 zones; the selected individual-device response matched its pseudonymized inventory identity          |
| Suffixed capability IDs                   | Pass in inventory and explicit read | 1,142 capability entries, including 170 suffixed entries; 55 devices repeat a base ID; an explicit suffixed capability GET returned a numeric scalar |
| Socket.IO connect and subscribe           | Pass                                | SDK creation, socket connect, manager subscribe/unsubscribe, socket disconnect, disconnect resolution, and SDK destruction completed in strict order |
| Capability events                         | Pass                                | The allowlisted write produced its matching capability update inside the guarded observation window                                                  |
| Availability events                       | Absent for synthetic test driver    | Unavailable/restored read-backs passed after full ten-second event windows; physical/Homey-originated evidence remains pending                       |
| Allowlisted write, event, and read-back   | Pass                                | Requested-value event and read-back passed; restoration of the original value and its second read-back also passed                                   |
| Network interruption and restoration      | Pass                                | 36 ordered events proved disconnect, nine retries during the 60-second interruption, resubscription, fresh inventory read, and complete cleanup      |
| SHS restart and reconnect                 | Pass                                | A 23-event write/restart/restore run proved events and read-backs across recovery; the earlier 15-event run independently proved transport recovery  |
| API-key revocation and replacement        | Pass                                | Primary and replacement keys passed preflight; revocation returned `401`, and the replacement key remained valid                                     |
| Disposable-device lifecycle sequence      | Pass                                | Exact add, rename, zone move, unavailable, restore, removal, and final absence passed; omitted create/update events were recorded and read back      |
| Stable mDNS service before/after restart  | Pass                                | Ten-second pre/post observations were exact matches: `_homey._tcp` on `4859` plus two co-hosted `_hap._tcp` services                                 |

## Verification

The offline harness test covers exact-host validation, credential-bearing URL rejection, redirect blocking, read-only
methods, Bearer placement, deterministic identity replacement across inventory/detail reads, private address/name
removal, suffixed capability selection and preservation, and forbidden-value failure:

```bash
cd apps/backend
pnpm run test:homey-spike
```

## Sanitized live fixture corpus

The ignored full capture was reduced to nine distinct representative devices under
`apps/backend/src/plugins/devices-homey/__fixtures__/`. Selection is deterministic and based on capability shape, not
household identity. The committed set covers light, switch, environmental sensing, covers, alarm-capability shapes,
energy, repeated/suffixed capabilities, and device unavailability.

The live inventory did not contain `target_temperature`, `alarm_contact`, `alarm_smoke`, `alarm_co`, `measure_co2`,
`windowcoverings_tilt_set`, or `measure_pressure`. These remain explicit evidence gaps and must not be represented by
fixtures that claim live provenance.

The inventory also contained no device with Homey's `lock` class. A `locked.child` capability on a non-lock device is
not treated as lock evidence; the manifest records `lock` under `knownDeviceClassGaps`.

The first sanitized capture irreversibly collapsed enum option IDs. Corrupted option lists are omitted from live
fixtures and recorded under `knownMetadataGaps`; a clearly labeled synthetic enum capability covers distinct-ID
contract testing until a fresh corrected live capture is available.

Capability bases are retained, while suffixes after the first `.` are consistently pseudonymized across every
representation because driver suffixes can contain household-derived semantics.

## References

- [Homey SHS installation and ports](https://support.homey.app/hc/en-us/articles/24010537261980-How-to-install-Homey-Self-Hosted-Server-with-Docker-on-Linux)
- [Homey local API factory](https://athombv.github.io/node-homey-api/HomeyAPI.html)
- [Homey local ManagerDevices API](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerDevices.html)
- [Homey local device capability/event API](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerDevices.Device.html)
