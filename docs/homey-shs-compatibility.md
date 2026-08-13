# Homey SHS Compatibility Record

**Status:** In progress; safe read-only inventory captured, realtime/write/recovery evidence pending

**Started:** 2026-08-12

**Related task:** `FEATURE-PLUGIN-HOMEY`

## Purpose

This record is the evidence gate for the Homey local connector. It separates facts established from published artifacts
and offline tests from behavior observed against the subscribed Homey Self-Hosted Server (SHS). A production connector,
Socket.IO choice, or mDNS implementation must not be finalized from assumptions in this document.

Never add a real endpoint, Homey ID, API key, device ID, zone or device name, private address, or raw response to this
file. Live results use synthetic aliases and sanitized captures only.

## Current gate status

| Area                                                  | Status                                       | Evidence still required                                                        |
| ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Credential-safe read probe                            | Passed on SHS `13.4.0` over HTTP `4859`      | Repeat over HTTPS `4860` if enabled                                            |
| System, zone, device inventory, and individual device | Captured and sanitized                       | Add lifecycle delta evidence on the disposable test device                     |
| Capability metadata and suffixed IDs                  | Captured from inventory and an explicit read | Add allowlisted write and read-back evidence                                   |
| Socket.IO events and reconnect                        | Pending live access                          | Capture connect, subscribe, event, disconnect, restart, and reconnect ordering |
| Allowlisted capability write                          | Contract defined, disabled                   | Use only the designated harmless test capability                               |
| Disposable-device lifecycle                           | Contract defined, disabled                   | Use only the separately gated virtual/test device                              |
| mDNS discovery                                        | Pending live access                          | Record stable service/TXT data or explicitly defer discovery                   |
| SDK decision                                          | Provisional hold                             | Complete live Socket.IO and cleanup/reconnect comparison                       |
| Sanitized fixture corpus                              | Nine representative live fixtures promoted   | Add event/reconnect fixtures and missing capability families/classes           |

## Installation evidence

Complete this table after the live run. Values committed here must remain non-sensitive.

| Field                                    | Recorded value                                                       |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Capture date                             | `2026-08-13`                                                         |
| SHS version                              | `13.4.0`                                                             |
| Container image tag and immutable digest | Pending                                                              |
| Host operating system/architecture       | Pending                                                              |
| Topology                                 | Pending; describe generically, for example `same LAN, separate host` |
| Smart Panel to SHS network path          | Pending; do not record addresses                                     |
| HTTP port `4859`                         | Confirmed for ping and authenticated system/zone/device reads        |
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
unset FB_HOMEY_SHS_URL FB_HOMEY_SHS_EXPECTED_HOST FB_HOMEY_SHS_API_KEY FB_HOMEY_SHS_PRIVATE_TERMS
```

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

## Live mutation gates

Read and write tests must use different least-privilege keys where SHS supports that workflow. The read-only probe needs
only `homey.system.readonly`, `homey.zone.readonly`, and `homey.device.readonly`. A write test additionally needs
`homey.device.control`; do not grant general device management.

No mutation harness is enabled yet. Any later write harness must refuse to start unless all of the following variables
are present and the live device/capability exactly matches both allowlist values:

```text
FB_HOMEY_SHS_WRITE_ENABLE=I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE
FB_HOMEY_SHS_WRITE_DEVICE_ID=<disposable device ID>
FB_HOMEY_SHS_WRITE_CAPABILITY_ID=<harmless capability ID>
FB_HOMEY_SHS_WRITE_VALUE=<validated scalar value>
```

Lifecycle mutations have a separate gate and may target only the designated disposable virtual/test device:

```text
FB_HOMEY_SHS_LIFECYCLE_ENABLE=I_ACKNOWLEDGE_THIS_MUTATES_A_DISPOSABLE_DEVICE
FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID=<disposable virtual/test device ID>
FB_HOMEY_SHS_LIFECYCLE_OPERATIONS=add,rename,zone-move,availability,remove
```

The implementation must validate the exact operation list, require a synthetic test-device marker established during
setup, and clean up only resources created by that run. It must never pair, rename, move, make unavailable, remove, or
unpair ordinary household devices.

## SDK artifact review

Artifact snapshot inspected on 2026-08-12:

| Property             | Finding                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Package              | `homey-api` `3.19.2`, published 2026-07-29                                                                 |
| Runtime declaration  | Node.js `>=24`; current agent/workspace guidance requires 24, while package manifests still declare `>=20` |
| License              | Use permitted with Homey products; source proprietary to Athom B.V.; no warranty                           |
| Installed size       | Approximately 1.19 MB unpacked across 128 files                                                            |
| Runtime dependencies | `engine.io-client ^3.5.5`, `socket.io-client ^2.5.0`, `node-fetch ^2.6.7`, `form-data ^4.0.0`              |
| Local entry point    | `HomeyAPI.createLocalAPI({ address, token })`                                                              |
| HTTP behavior        | Bearer authentication and generated manager paths described above                                          |
| Realtime behavior    | WebSocket-only Socket.IO client; live session/auth/subscription behavior not yet verified against SHS      |

### Provisional dependency decision

Do not add `homey-api` to a production package yet. Use direct, built-in HTTP only for the read-only compatibility and
fixture-capture gate. The final connector decision remains open until the live spike compares:

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
| Invalid key                               | Pending                             |                                                                                                                                                      |
| Missing system/zone/device scope          | Pending                             |                                                                                                                                                      |
| Bad URL and unavailable host              | Pending                             |                                                                                                                                                      |
| Request timeout                           | Pending                             |                                                                                                                                                      |
| Complete inventory and individual read    | Pass                                | Complete inventory captured: 118 devices and 16 zones; the selected individual-device response matched its pseudonymized inventory identity          |
| Suffixed capability IDs                   | Pass in inventory and explicit read | 1,142 capability entries, including 170 suffixed entries; 55 devices repeat a base ID; an explicit suffixed capability GET returned a numeric scalar |
| Socket.IO connect and subscribe           | Pending                             |                                                                                                                                                      |
| Capability and availability events        | Pending                             |                                                                                                                                                      |
| Allowlisted write, event, and read-back   | Pending                             |                                                                                                                                                      |
| Network interruption and restoration      | Pending                             |                                                                                                                                                      |
| SHS restart and reconnect                 | Pending                             |                                                                                                                                                      |
| API-key revocation and replacement        | Pending                             |                                                                                                                                                      |
| Disposable-device lifecycle sequence      | Pending                             |                                                                                                                                                      |
| Stable mDNS service before/after restart  | Pending                             |                                                                                                                                                      |

## Verification

The offline harness test covers exact-host validation, credential-bearing URL rejection, redirect blocking, read-only
methods, Bearer placement, deterministic identity replacement across inventory/detail reads, private address/name
removal, suffixed capability selection and preservation, and forbidden-value failure:

```bash
cd apps/backend
pnpm run test:homey-spike
```

## Sanitized live fixture corpus

The ignored full capture was reduced to ten distinct representative devices under
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

Capability bases are retained, while suffixes after the first `.` are consistently pseudonymized across every
representation because driver suffixes can contain household-derived semantics.

## References

- [Homey SHS installation and ports](https://support.homey.app/hc/en-us/articles/24010537261980-How-to-install-Homey-Self-Hosted-Server-with-Docker-on-Linux)
- [Homey local API factory](https://athombv.github.io/node-homey-api/HomeyAPI.html)
- [Homey local ManagerDevices API](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerDevices.html)
- [Homey local device capability/event API](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerDevices.Device.html)
