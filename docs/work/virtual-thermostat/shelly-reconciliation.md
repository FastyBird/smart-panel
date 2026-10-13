# Shelly thermostat reconciliation audit and guarded HTTP candidate

Status: SDK deadline fencing, a qualified HTTP guard bridge and a device script candidate are implemented
and tested offline. Installed heater activation remains unqualified. No device was contacted by this
implementation task, no script/configuration was installed, and no thermal or firmware defaults were selected.

## Native transport finding

The backend pins `shellies-ds9` to `f891f2c7e672a2c946c56612b2783658e06a724c`. The inspected installed
`dist/rpc/websocket.js`, `dist/rpc/auth.js`, and `dist/components/switch.js` are the actual SDK sources.
Requests run concurrently. The handler waits for connection before sending, and digest authentication
recursively retries with the original request parameters. Destroy rejects client requests and disconnects;
it does not invoke a device command-cancellation operation.

The transitive `json-rpc-2.0` timeout resolves its response record while `requestAdvanced()` is still waiting
for send to complete. A connection wait can therefore outlive the timeout, later send ON, and only then
expose the timeout to its caller. The local guarded handler now supplies its own bounded deadline and
checks deadline plus request lifetime immediately before every actual send, including retries and ordinary
pre-claim requests. The non-enumerable guard is absent from wire JSON. This prevents local delayed-send
replay; it does not recall transmitted requests.

Shelly documents [`Switch.Set`](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/)
with a relative `toggle_after` flip-back timer and a `was_on` result describing state before execution.
`Switch.GetStatus.output` describes current output. These supply no cancellation token or absolute expiry
for queued ON. The [RPC channels](https://shelly-api-docs.shelly.cloud/gen2/General/RPCChannels/) include
independent HTTP, WebSocket and MQTT paths, with concurrent HTTP requests supported.

A currently OFF sample cannot prove an earlier ON will never execute later. Closing a socket or waiting
one lease duration cannot make that proof: the lease starts when ON executes. The native-only adapter
therefore cannot reconcile. Complete **internal installed script qualification** enables the separate
HTTP bridge below. Individual send results still retain `pendingOnDrained=false` until scoped release
reconciliation succeeds. Missing installation evidence leaves ON admission closed.

## Device script candidate for firmware 1.7.5

[`shelly-guard-candidate.js`](shelly-guard-candidate.js) is the exact standalone artifact executed by the
backend Jest VM fixture. It uses
[`HTTPServer.registerEndpoint`](https://shelly-api-docs.shelly.cloud/gen2/0.14/Scripts/ShellyScriptLanguageFeatures/#http-handlers),
[script core APIs](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Shelly/),
[timers](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Timer/), and KVS RPCs.
The [official changelog](https://shelly-api-docs.shelly.cloud/gen2/changelog/) added HTTP handlers in
0.11.0 and `Shelly.getUptimeMs` in 1.5.0. The supplied pilot runs **1.7.5**; the candidate avoids
`Script.addRpcHandler`, introduced in 2.0.0. It does not require a firmware upgrade.

The artifact has one HTTP endpoint, one periodic timer and one status subscription. Named callbacks,
no promises/classes, and at most serial switch IO, one KVS operation and one emergency OFF concurrently
fit documented [script limits](https://shelly-api-docs.shelly.cloud/gen2/Scripts/LanguageReference/).
Actual firmware behavior still requires installed verification.

The endpoint is `/script/<slot>/spguard`:

| Query                                                      | Behavior                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action=status`                                            | Returns device/component/firmware identity, persistent epoch, device uptime, floor readiness, fault, output and local IO state.                       |
| `action=on&epoch=<epoch>&untilMs=<device uptime deadline>` | Requires exact current epoch, absolute expiry, fresh live floor report and qualified lease bounds; refuses pending fences or serial IO.               |
| `action=fence`                                             | Revokes the previous epoch immediately, persists its increment, observes prior ON completion, sends absolute OFF and obtains matched native readback. |

Every request also includes a unique `nonce`. Replies echo it in explicit result/error envelopes with
`Cache-Control: no-store`; the backend refuses older or missing correlation, including cached OFF responses. ON uses the remaining
absolute lifetime as native `toggle_after`; acceptance is not physical confirmation. Fence acknowledges
`localOnDrained` and explicitly returns `externalWriterBarrier=false`. The backend combines this **local**
evidence with separately qualified commissioning/writer isolation before creating broader release proof.

Startup sends immediate emergency OFF, increments a commissioned persistent KVS epoch, and sends serial
OFF/readback before accepting ON. Missing/reset epoch storage and identity mismatches cannot silently
establish a fresh epoch. Overflow is refused. Any unknown native ON execution closes admission and cannot
mint drainage proof, even if later OFF readback exists. Emergency OFF does not claim cancellation.

Cached startup floor status never refreshes freshness. Actual reports are required. The candidate accepts
native `temperature.tC` or native Celsius `voltmeter.xvoltage`/`input.xpercent` helpers. Helper expression
and Celsius unit must exist and the full current native component configuration must match its installed
snapshot. Raw voltage/percent never counts as Celsius without an explicit qualified conversion. The candidate also supports
raw NTC voltage through an explicit Steinhart–Hart calibration profile: reference voltage, series resistance and
three coefficients. Non-finite/missing readings, voltage outside `(0, referenceVoltage)`, invalid resistance or
non-positive inverse Kelvin inhibit heat immediately. Calibration and component snapshot are part of the installed
script hash; no parameters or limits default from the existing script. Invalid/stale/error input inhibits heat. Floor >=
limit immediately requests OFF; recovery requires a value **strictly below** limit minus hysteresis.
The configured watchdog issues OFF after stale floor/absolute expiry even with a stalled ON callback. Reading
`Shelly.getComponentStatus` provides an internal cached snapshot, not a new physical measurement. This candidate
never refreshes freshness from that snapshot: actual source reports are required, and equal-report/measurement
notification behavior must be qualified. The local raw-floor calculation shares those report timestamps.
Native finite flip-back provides a second OFF bound if the script stops, subject to firmware qualification.

## Implemented provider bridge and runtime proof

The backend bridge:

- Checks live SDK device identity and bounded complete `Script.GetCode` chunks, matching the installed
  SHA-256 before guard endpoint commands. MAC, firmware, component, slot, endpoint and evidence must match. Qualification requires a fixed IP endpoint
  (with optional explicit port), avoiding an unresolved DNS alias change between SDK and HTTP connections.
- Guards the HTTP header send after socket connection, immediately before `request.end()`. Expired or
  settled requests cannot later send. HTTP responses are bounded; authentication failures/redirects
  are refused; ON is never automatically retried. Transmitted timeout remains unknown execution.
- Requires an internal `guardScript` installation profile with separate commissioning-barrier,
  writer-isolation, endpoint-authentication, restart-drain and local-execution-bound evidence identifiers.
  No public DTO may construct a profile or register an adapter. The existing registry remains process-local;
  restart closes admission until verified evidence is explicitly reinstalled by the qualification workflow.
- Admits OFF readback through ordinary physical `reportSample`. Runtime proof matches the newly accepted
  current live OFF sample, source/authority guard, observation timing, physical identity, controller/config
  revision, claim/revision, contract fingerprint and every pending command. It no longer requires timestamps
  from the old pre-IO sample. Cached, retained, unaccepted and mismatched evidence retain the reservation.

The [endpoint documentation](https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/HTTPServer/) says device
authentication applies to script endpoints. The bridge does not invent HTTP credentials or reuse an SDK
digest challenge as HTTP authentication. A 401 remains refused. An authentication-enabled installation
needs a separately verified gateway/authentication arrangement before qualification.

## Installation qualification and unresolved hardware facts

A prepended `SP_GUARD_CONFIG` is an internal installation artifact, not a public request or safety bypass.
Required fields have no defaults: exact device/model/firmware/component; native floor component type/ID,
attribute/configuration snapshot and, for raw NTC mode, explicit calibration; commissioned KVS key/evidence ID; tested lease/watchdog/freshness
bounds; installer-selected limit/hysteresis; verified restart-drain and writer-exclusion assertions.

The script cannot guarantee native writer exclusion. Shelly device authentication is not documented as
method-level authorization. A reachable deployment needs device network isolation plus a narrow gateway
that denies native ON/toggle/config/script mutation and every bypass path, while allowing audited identity
and code reads and absolute native OFF for repair. Exclude cloud/MQTT/UDP commands, schedules/webhooks,
other scripts, physical input changes and automatic ON. Drain pre-commissioning native writers before
activation. Require `initial_state=off`, tested finite OFF behavior, independent physical floor/thermal
protection and, for opposed heat/cool outputs, a verified installation interlock.

Documentation does not promise cancellation of an already-issued inner `Shelly.call('Switch.Set')` when
a script stops. Startup OFF/readback alone cannot prove an older ON is gone. Qualify script stop/restart
and bounded native execution on the identified firmware; otherwise startup must stay quarantined until
a verified reboot/isolation barrier or a different mechanism exists. Absolute expiry is checked at script
admission; bounded execution of native IO already issued is a separate hardware fact.

The parent task's authorized read-only inspection identified pilot `SNSW-001P16EU`, firmware
`20260311-095847/1.7.5-g9979d16`. Its raw `voltmeter:100` is named Bathroom Floor Temperature but the helper
expression/unit are null. The DS18B20 `temperature:100` is named Bathroom Temperature and has not been
assumed to be the floor sensor. Input is `follow`, `in_locked=false`, and native auto-OFF is disabled.
These facts are **not** guard/protection/writer-exclusion evidence.

The user subsequently identified existing script 1, `NTC Conversion`, as the floor calculation. The parent
read it without mutation. Its supplied calibration is `Vref=10`, `Rseries=10000`,
`A=0.0010351024725298568`, `B=0.0002338353574079741`, `C=7.917851073336009e-8`:
`R=Rseries*V/(Vref-V)` and `T=1/(A+(B+C*ln(R)^2)*ln(R))-273.15`, rounded to two decimals.
The reported 6.68 V corresponds to about 18.45 °C. The existing script reads the internal raw-voltage
snapshot every 30 seconds, logs the result, and sends OFF only for temperature strictly greater than
30 °C. It exports no Celsius property/HTTP endpoint. Missing voltage returns without OFF, and its
`typeof` check does not exclude NaN. It is preserved and is not treated as qualified independent
protection or freshness evidence. The candidate does not overwrite it or copy its cutoff as a default.
A separately commissioned guard must use a different explicitly chosen slot and actual qualification.

Still required before installed activation:

1. Choose/configure the actual native Celsius floor helper and limit/hysteresis; retain installed
   helper/peripheral identity through the existing source qualification registry.
2. Separately authorize commissioning/installation changes, verify configured code hash/slot, epoch storage,
   endpoint authentication and each safety evidence item, and persist/load the installed record through an
   operator-controlled workflow. The current internal process-local hook is deliberately not a public API.
3. Verify hardware OFF timing, pending native ON across stop/restart/reboot, auth retry, aliases, floor/equal
   reports, disconnects and opposing interlocks. Record observed bounds; refuse qualification if any fails.

Offline tests establish software behavior, not firmware execution bounds or an installed heater's safety.

## Release barrier regression corrections

A fence cannot borrow an earlier watchdog OFF/readback. Epoch persistence must succeed first, and the
acknowledging OFF plus readback cycle must have started for that persisted fence epoch. The candidate
serializes existing native IO without overwriting its busy ownership; an older callback can only trigger
the later cycle. Emergency OFF stays available while persistence is pending and cannot mint proof.

Runtime release evidence is bound to the exact immutable installed qualification object and the stable
provider connection/configuration lease. Replacing qualification under the same physical identity or
claim revision invalidates the earlier barrier and queued ON admission. A newly qualified profile must
complete its own OFF/drain reconciliation. This stable source lease is separate from a single evaluation
window so ordinary new sensor reports do not permanently suspend a correctly reconciled controller.
