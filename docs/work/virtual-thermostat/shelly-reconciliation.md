# Shelly thermostat reconciliation audit and offline protocol candidate

Status: native Shelly activation remains blocked; script candidate implemented and exercised offline.
This does not certify an installed heater, relay, firmware, independent floor limiter, or interlock.
No device was contacted, no script was installed, and no thermal or firmware defaults were selected.

## Native transport finding

The backend pins `shellies-ds9` to `f891f2c7e672a2c946c56612b2783658e06a724c`.
The inspected package's `dist/rpc/websocket.js`, `dist/rpc/auth.js`, and `dist/components/switch.js`
are the actual installed SDK sources. `WebSocketRpcHandler.request()` issues concurrent requests;
`handleRequest()` waits for connection before `sendRequest()`. Digest authentication recursively retries
using the original request parameters. `destroy()` rejects client requests and disconnects the socket.
It does not invoke a device command cancellation RPC.

The transitive `json-rpc-2.0` client's timeout resolves its response record, but `requestAdvanced()`
first waits for its send promise. Thus a connection wait can outlive the timeout, later send ON,
and only then expose the already-created timeout response to the caller. The local guarded handler
now supplies its own bounded deadline and checks that deadline plus request lifetime immediately
before **every** actual send, including retries and ordinary requests. The non-enumerable guard is
absent from wire JSON. Existing claim, connection and protective-generation guards remain in force.
This closes local delayed-send replay; it does not recall already transmitted requests.

Shelly documents [`Switch.Set`](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/)
with a relative `toggle_after` flip-back timer and a `was_on` result describing state before execution.
`Switch.GetStatus.output` describes current output. Neither supplies a cancellation token, an absolute
expiry for queued ON, or a global barrier across connections. The documented
[RPC channels](https://shelly-api-docs.shelly.cloud/gen2/General/RPCChannels/) include separate HTTP,
WebSocket and MQTT paths; HTTP allows multiple concurrent requests.

A currently OFF sample cannot prove an earlier ON will never execute later. Closing a socket or
waiting one lease duration cannot turn that sample into proof: the lease starts when ON executes,
not when the backend timed out. Completing known local requests can establish a useful partial
ordering, but cannot cover unknown pre-restart or external writer requests. The native adapter
therefore still reports `canReconcile=false`; `pendingOnDrained=false` is retained on native results.
This is an implementation limitation, not a qualification checkbox that can safely be bypassed.

## Implemented script candidate

[`shelly-guard-candidate.js`](shelly-guard-candidate.js) is a standalone device script artifact exercised
by the backend Jest VM fixture. It is deliberately not installed or registered as a production
thermostat transport. The exact artifact is tested, rather than a second implementation of its logic.

The candidate uses the documented
[custom RPC handlers](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/RPCHandlers/),
[script core APIs](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Shelly/),
[timers](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Timer/), and KVS RPCs.
Exact installed firmware must support these APIs. Current documentation does not establish support
on the user's unspecified installed firmware. The artifact has three inbound RPC handlers, one
periodic timer and one status subscription. It uses named callbacks, no promises/classes, and at
most a serial local switch operation, one KVS operation, and one emergency OFF concurrently.
These stay within documented [script resource limits](https://shelly-api-docs.shelly.cloud/gen2/Scripts/LanguageReference/).
Inbound custom RPC calls have a documented five-second response timeout. A timeout is unknown;
Status/Fence are recovery reads/actions, and ON must never be blindly replayed.

| Method                 | Behavior                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Script.SPGuardStatus` | Returns device/component/firmware identity, persistent epoch, device uptime, floor readiness, fault, output and local IO state.                                               |
| `Script.SPGuardOn`     | Requires exact current epoch, absolute device-uptime deadline, fresh live floor report and qualified lease bounds; rejects while any fence or serial IO is pending.           |
| `Script.SPGuardFence`  | Revokes prior epoch immediately, persists the increment, observes genuine earlier ON completion, sends absolute OFF, then obtains matched native `Switch.GetStatus` readback. |

The custom RPC's standard `id` selects the installed script slot. `componentId` selects the native
relay inside the script. An ON uses the remaining absolute lifetime as the native `toggle_after`
value. A returned ON acceptance is not physical output confirmation. Fence acknowledgement reports
`localOnDrained`, and explicitly reports `externalWriterBarrier=false`; it is not a backend release
proof. A production adapter may establish broader proof only from independently qualified writer
exclusion plus the script protocol's exact correlated evidence and accepted live property sample.

The script starts by incrementing a commissioned persistent KVS epoch, sending OFF and reading
back OFF before accepting ON. Missing/reset epoch storage, an identity mismatch, and any unknown
local ON execution leave admission closed. The counter deliberately refuses overflow instead of
wrapping. Cached startup floor status is never used to refresh freshness. Actual floor reports
must arrive; invalid values or error status inhibit heat. Floor >= the protective limit immediately
requests OFF, and recovery requires a value **strictly below** limit minus hysteresis. A stale report
or expired ON deadline requests OFF on the next configured watchdog tick. When ON's callback is
stalled, the watchdog still issues an emergency OFF, without claiming drainage. A completed ON is
followed by serial OFF/readback if superseded. Native finite flip-back provides a second OFF bound
if the script stops after dispatch, subject to exact firmware qualification.

## Installation qualification hook and remaining work

The candidate requires a prepended `SP_GUARD_CONFIG` object. There is no example containing invented
limits. This object is an **internal installation-qualification artifact**, not a public thermostat
request or an administrative switch that supplies safety proof. Required fields are:

- Exact `deviceId`, `model`, `firmware`, native `componentId`, and native Celsius `floorComponentId`.
- Commissioned `epochKey` and evidence record identifier `evidenceId`.
- Tested `minLeaseMs`, `maxLeaseMs`, `watchdogMs`, and `floorMaxAgeMs`.
- User/installer-selected `floorLimitC` and positive `floorHysteresisC`.
- Verified `scriptRestartDrainQualified` and `nativeWritersExcluded` assertions.

Those last assertions have **not** been established for this installation. They cannot be derived
from OFF readback or the script hash alone. A stopped script's external calls receive 503, but the
reviewed documentation does not promise cancellation of an already-issued inner `Shelly.call`
`Switch.Set`. Startup OFF/readback alone cannot prove such a previous ON is gone. Qualification
must test this on the identified firmware; if it cannot be proven, startup must remain quarantined
until a verified device reboot/isolation barrier or a different device-side mechanism is available.
Absolute expiry is checked at script admission; the firmware must additionally qualify bounded
execution of already-issued local native ON. The candidate does not invent that guarantee.

A native writer can bypass the custom handler. Shelly's general authentication applies to the
whole device and is not documented as method-level authorization. Sharing a password between
script and native RPC clients does not exclude native writers. A reachable deployment needs an
isolated device network plus a narrow authenticated relay/gateway that permits only the guard RPCs
for controller credentials. Cloud, MQTT commands, UDP RPC, schedules, webhooks, other scripts,
physical input modes and automatic ON must be disabled or independently excluded and verified.
Commissioning must drain prior native writers before guard activation. Keep `initial_state=off`,
qualified finite auto-OFF/flip-back behavior and an independent physical floor/thermal cutoff;
opposed heat/cool outputs additionally require the installation's verified interlock.

After exact firmware and installed safety evidence exist, implementation still required before
activation is:

1. Persist script hash/slot, firmware identity, commissioning epoch, writer isolation, lease timing,
   restart-drain and independent-protection evidence through the existing **internal** qualification
   registry. No HTTP DTO may register an adapter or assert these facts.
2. Implement a guarded custom-RPC adapter using the real SDK transport. Verify identity and script
   version before every lease; correlate Fence acknowledgement to command coverage and readback;
   admit the readback through physical sample storage with current connection/source guards.
3. Extend runtime reconciliation to consume the newly obtained OFF sample rather than requiring
   byte-for-byte timestamps of the sample captured before provider IO. Preserve physical identity,
   claim revision, current authority, live provenance and all pending command coverage checks.
4. Exercise real hardware OFF timing, native ON pending across script stop/restart, device reboot,
   authentication retry, alias removal, stale floor/equal reports, host disconnect and opposing-output
   interlock. Record actual observed bounds and fail closed when any row cannot be established.

The offline implementation is a concrete protocol candidate, not completion of the production
Shelly reconciliation capability. The supplied floor threshold and firmware/interlock evidence are
still required to complete usable thermostat commissioning.
