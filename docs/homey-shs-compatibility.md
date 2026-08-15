# Homey SHS Compatibility Record

**Status:** In progress; safe inventory and SDK session/cleanup evidence captured, automatic mDNS discovery explicitly
deferred for the local MVP, and live capability-event, write, error-matrix, reconnect, recovery, and
credential-rotation evidence pending

**Started:** 2026-08-12

**Related task:** `FEATURE-PLUGIN-HOMEY`

## Purpose

This record is the evidence gate for the Homey local connector. It separates facts established from published artifacts
and offline tests from behavior observed against the subscribed Homey Self-Hosted Server (SHS). A production connector,
Socket.IO choice, or mDNS implementation must not be finalized from assumptions in this document.

Never add a real endpoint, Homey ID, API key, device ID, zone or device name, private address, or raw response to this
file. Live results use synthetic aliases and sanitized captures only.

## Current gate status

| Area                                                  | Status                                          | Evidence still required                                              |
| ----------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Credential-safe read probe                            | Passed on SHS `13.4.0` over HTTP `4859`         | Repeat over HTTPS `4860` if enabled                                  |
| System, zone, device inventory, and individual device | Captured and sanitized                          | Add lifecycle delta evidence on the disposable test device           |
| Capability metadata and suffixed IDs                  | Captured from inventory and an explicit read    | Add allowlisted write and read-back evidence                         |
| Socket.IO events and reconnect                        | Restart/network probes ready; live runs pending | Capture capability/availability events and both recovery orderings   |
| Allowlisted capability write                          | Hard-gated probe implemented, disabled          | Use only the designated harmless test capability                     |
| Error classification                                  | SDK invalid key returned `401`; matrix pending  | Verify missing-scope, bad-URL, unavailable, and timeout behavior     |
| API-key revocation and replacement                    | Operator-controlled probe ready                 | Revoke only a dedicated test key during the gated observation window |
| Disposable-device lifecycle                           | Guarded operator probe ready                    | Use only the separately gated virtual/test device                    |
| mDNS discovery                                        | Deferred; manual URL only for local MVP         | Revisit only after an attributable stable service is verified        |
| SDK decision                                          | Live session/cleanup passed; provisional hold   | Complete event, timeout, cleanup-failure, and reconnect comparison   |
| Sanitized fixture corpus                              | Nine representative live fixtures promoted      | Add event/reconnect fixtures and missing capability families/classes |

## Installation evidence

Complete this table after the live run. Values committed here must remain non-sensitive.

| Field                                    | Recorded value                                                       |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Capture date                             | `2026-08-13`                                                         |
| Realtime SDK probe date                  | `2026-08-14`                                                         |
| mDNS observation date                    | `2026-08-14`                                                         |
| SHS version                              | `13.4.0`                                                             |
| Container image tag and immutable digest | Pending                                                              |
| Host operating system/architecture       | Pending                                                              |
| Topology                                 | Pending; describe generically, for example `same LAN, separate host` |
| Smart Panel to SHS network path          | Pending; do not record addresses                                     |
| HTTP port `4859`                         | Confirmed for reads and the SDK Socket.IO session                    |
| HTTPS port `4860`                        | Pending                                                              |
| TLS certificate behavior                 | Pending                                                              |
| Disposable capability alias              | Pending synthetic alias                                              |
| Disposable lifecycle-device alias        | Pending synthetic alias                                              |

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

The realtime probe exercises the reviewed `homey-api` `3.19.2` package as a development-only compatibility tool. It
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

After the `device.create` event exactly matches the marker, driver, owner, initial name, and source zone allowlist, the
probe binds the new runtime device ID in memory. Only after that binding may it use the bounded local API operations
to rename the device, move it to the destination zone, and remove it. The probe observes `device.update` for rename,
zone, and availability changes and `device.delete` for removal, with fresh reads after mutations. It never accepts the
first unrelated lifecycle event and never writes an identifier, name, event payload, or raw error to the report.

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
the exact owner URI using Homey's `<owner-uri>:driver:<driver>` form. Driver ID, owner URI, initial and renamed names,
and both distinct zone IDs are exact allowlist values. `FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS` optionally sets the bounded
time available for each requested operator action from `10000` through `300000` milliseconds and defaults to `90000`.

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
unset FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS
unset FB_HOMEY_SHS_API_KEY
```

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

This runbook does not authorize Smart Panel tooling or an automated agent to restart SHS. Live evidence remains pending
until an operator intentionally performs the restart while the gated probe is open.

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

## Privacy-safe mDNS observation probe

The mDNS probe performs a bounded wildcard DNS-SD observation because SHS's service type has not been established. It
does not read or send `FB_HOMEY_SHS_API_KEY`. Although the browser necessarily receives other LAN advertisements in
memory, the probe immediately discards every service whose hostname or address does not exactly match
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

### Server-discovery decision

Automatic Homey server discovery is explicitly deferred for the local MVP. Smart Panel does not register a Homey
mDNS discoverer and does not expose Homey server-discovery or rescan endpoints. Shipping `_http._tcp` port `80` as a
Homey discriminator could present unrelated LAN services as Homey instances, so the observed record is insufficient
even if a later observation finds it again after an SHS restart.

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
unset FB_HOMEY_SHS_PRIVATE_TERMS
```

The probe also verifies the shared URL validator rejects a non-HTTP candidate. Unavailable-host and timeout categories
are exercised against ephemeral loopback servers owned by the probe; it does not scan another LAN port or send the API
keys anywhere except the configured SHS origin. Every request uses `GET`, blocks redirects, and is bounded by
`FB_HOMEY_SHS_TIMEOUT_MS`; the local simulations use a shorter `250` ms cap. Response bodies, raw transport errors,
URLs, addresses, keys, and private terms are never written. A report is created only after all five scenarios pass,
under the same ignored capture root and restrictive directory/file modes as the inventory and realtime probes.

## SDK artifact review

Artifact snapshot inspected on 2026-08-12:

| Property             | Finding                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Package              | `homey-api` `3.19.2`, published 2026-07-29; installed as a development-only spike dependency               |
| Runtime declaration  | Node.js `>=24`; current agent/workspace guidance requires 24, while package manifests still declare `>=20` |
| License              | Use permitted with Homey products; source proprietary to Athom B.V.; no warranty                           |
| Installed size       | Approximately 1.19 MB unpacked across 128 files                                                            |
| Runtime dependencies | `engine.io-client ^3.5.5`, `socket.io-client ^2.5.0`, `node-fetch ^2.6.7`, `form-data ^4.0.0`              |
| Local entry point    | `HomeyAPI.createLocalAPI({ address, token })`                                                              |
| HTTP behavior        | Bearer authentication and generated manager paths described above                                          |
| Realtime behavior    | WebSocket-only Socket.IO; live connect, subscribe, unsubscribe, disconnect, and destroy order verified     |

### Provisional dependency decision

Do not move `homey-api` into production dependencies yet. Use direct, built-in HTTP for read-only inventory and fixture
capture; the development-only SDK probe exists solely to measure realtime behavior. The final connector decision
remains open until the live spike compares:

- Socket.IO authentication and manager subscription behavior;
- disconnect and idempotent cleanup;
- automatic reconnect, restart recovery, and duplicate listeners;
- request and subscription timeout control;
- error classification for invalid/revoked keys and missing scopes; and
- the maintenance and security implications of the SDK's older HTTP and Socket.IO dependency chain; and
- whether adopting the SDK also requires raising the public Node.js engine declaration from `>=20` to `>=24`.

If the SDK passes, it remains behind `HomeyConnector` and no SDK object enters mapping, adoption, synchronization, or
control services. If it fails, the replacement is direct documented HTTP plus a connector-owned Socket.IO transport.
Either route must retain plain normalized models and the same connector contract tests.

## Live result matrix

Fill this matrix using synthetic aliases only.

| Scenario                                  | Result                              | Sanitized observation                                                                                                                                |
| ----------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP `4859` ping and authenticated reads  | Pass                                | Read-only system, zone, and device requests completed without redirects                                                                              |
| HTTPS `4860` ping and authenticated reads | Pending                             |                                                                                                                                                      |
| Invalid key                               | Partial pass                        | The SDK local factory rejected a generated invalid key with HTTP `401`; revocation and the restricted-scope matrix remain pending                    |
| Missing system/zone/device scope          | Pending                             |                                                                                                                                                      |
| Bad URL and unavailable host              | Pending                             |                                                                                                                                                      |
| Request timeout                           | Pending                             |                                                                                                                                                      |
| Complete inventory and individual read    | Pass                                | Complete inventory captured: 118 devices and 16 zones; the selected individual-device response matched its pseudonymized inventory identity          |
| Suffixed capability IDs                   | Pass in inventory and explicit read | 1,142 capability entries, including 170 suffixed entries; 55 devices repeat a base ID; an explicit suffixed capability GET returned a numeric scalar |
| Socket.IO connect and subscribe           | Pass                                | SDK creation, socket connect, manager subscribe/unsubscribe, socket disconnect, disconnect resolution, and SDK destruction completed in strict order |
| Capability and availability events        | Pending                             |                                                                                                                                                      |
| Allowlisted write, event, and read-back   | Pending                             |                                                                                                                                                      |
| Network interruption and restoration      | Pending                             |                                                                                                                                                      |
| SHS restart and reconnect                 | Pending                             |                                                                                                                                                      |
| API-key revocation and replacement        | Pending                             |                                                                                                                                                      |
| Disposable-device lifecycle sequence      | Pending                             |                                                                                                                                                      |
| Stable mDNS service before/after restart  | Deferred for local MVP              | Two identical windows matched only generic `_http._tcp` port `80` with no TXT keys; the record cannot be safely attributed to SHS                    |

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
