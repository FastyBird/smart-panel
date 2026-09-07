# Shelly NG: live power and energy updates — implementation plan

Status: **approved 2026-09-07** (decisions in §16). Epic [#973](https://github.com/FastyBird/smart-panel/issues/973). No implementation has started.

## 1. Goal and scope

Shelly NG (Gen2/Gen3/Gen4) devices adopted through `apps/backend/src/plugins/devices-shelly-ng` get
`electrical_power` and `electrical_energy` channels at adoption, but those channels do not track the
device afterwards. The goal is that every power/energy channel the plugin creates receives live values
for as long as the device is connected, through both transport paths (library WebSocket and the
sleeping-device WebSocket server), with the periodic `Shelly.GetStatus` poll as the fallback.

In scope:

- The switch, PM1, cover, light, RGB, RGBW and CCT components' `apower`, `voltage`, `current`
  and `aenergy` readings.
- The EM, EMData, EM1 and EM1Data meter components (Pro EM, Pro 3EM, EM Gen3, 3EM Gen3), whose
  channels were added in #792 without any live wiring.
- The Plus PM Mini and PM Mini Gen3 descriptors, whose meter component is never attached.
- Regression guards so the next mismatch of this kind fails a unit test instead of going quiet.

Out of scope (tracked separately, see §16):

- Descriptor drift unrelated to power (Plus Dimmer, Plus Uni, Pro Dimmer 2PM, Pro RGBW PM inputs).
- Cleaning up historical `energy_delta` rows that the bug may have corrupted.
- The Shelly v1 plugin. It uses the same coercion helper only for user-written values with an
  explicit fallback, so it is unaffected.
- Any admin or panel change. The frontends read channels by category and property, not by Shelly
  identifiers, so nothing there changes.

## 2. Source requirements and linked GitHub issues

Source: Adam's report of 2026-09-07 that Shelly NG energy/power channels are not updating, with the
suspicion of a component mapping or case-sensitivity fault.

GitHub tracking (milestone **Shelly NG live power and energy**, created 2026-09-07 after approval):

| Issue | Title | PR |
|---|---|---|
| [#973](https://github.com/FastyBird/smart-panel/issues/973) | `EPIC-SHELLY-NG-POWER-ENERGY: shelly ng power and energy channels never update` (epic) | — |
| [#974](https://github.com/FastyBird/smart-panel/issues/974) | `fix(backend): stop zeroing shelly ng energy counters` | PR1 |
| [#975](https://github.com/FastyBird/smart-panel/issues/975) | `fix(backend): attach the shelly pm mini meter component` | PR2 |
| [#976](https://github.com/FastyBird/smart-panel/issues/976) | `fix(backend): stream shelly ng power readings for lights and covers` | PR3 |
| [#977](https://github.com/FastyBird/smart-panel/issues/977) | `feat(backend): stream shelly ng energy meter readings` | PR4 |
| [#978](https://github.com/FastyBird/smart-panel/issues/978) | `chore(backend): align shelly ng descriptors with the library component map` (follow-up) | — |

Each PR description must end with `Closes #<n>` for its issue.

## 3. Current-state analysis

### 3.1 How a value travels today

```
Shelly device ──NotifyStatus──▶ shellies-ds9 WebSocket RPC handler
                                   └─▶ Device.statusUpdateHandler
                                         └─▶ Component.update(data)          (components/base.js)
                                               emits 'change', <characteristic>, <value>
                                                 └─▶ ShellyDeviceDelegate.handleChange
                                                       emits 'value', compKey, char, value
                                                         └─▶ DelegatesManagerService valueHandler
                                                               looks up `${delegate.id}|${compKey}|${char}`
                                                                 └─▶ handleNumericChange → coerceNumberSafe
                                                                       └─▶ scheduleWrite (250 ms) → ChannelsPropertiesService.update
```

Two additional producers feed the same `value` event:

- `DelegatesManagerService.pollAllDevices()` every `status_poll_interval` seconds (default 60)
  calls `Device.loadStatus()`, which routes `Shelly.GetStatus` through the same `Component.update()`.
- `ShellyWsServerService` (sleeping devices such as Plus H&T) parses `NotifyStatus` frames itself and
  emits `value` for every key **and** every dotted leaf (`battery` and `battery.percent`).

Channels and properties are created once by `DeviceManagerService.createOrUpdate()` from direct RPC
calls (`Switch.GetStatus`, `PM1.GetStatus`, …). The YAML mappings only decide the *switch/light/cover*
channel category; power and energy channels are hard-coded (`ensureElectricalPower`,
`ensureElectricalEnergy`, `ensureMeterChannel`), and the `power.yaml` mapping for `pm1` is not
consulted at runtime for power at all.

### 3.2 Root causes found

**RC1 — `aenergy` change events are written as 0.** *(confirmed by code, all switch-with-PM and PM1
devices)*

`Switch.aenergy`, `Cover.aenergy`, `Light.aenergy`, `Pm1.aenergy` are object characteristics
(`{ total, by_minute, minute_ts }`). The library emits the object. The handler registered in
`delegates-manager.service.ts` (switch block ~line 450, PM1 block ~line 1691) is:

```ts
this.handleNumericChange(comp.key, 'aenergy', consumption.id, val, (n) =>
	this.handleChange(consumption, toEnergy(n), false),
);
```

`handleNumericChange` runs `coerceNumberSafe(val)` **before** `toEnergy`. The shared helper in
`src/common/utils/transform.utils.ts` returns `0` for any non-primitive input, so every update
persists consumption `0`. The initial value written at attach time (`toEnergy(comp.aenergy)`) is
correct; the device's next minute tick overwrites it. The order of operations has been this way since
the plugin's first commits (#89, #95). It is **not** a regression from the casing fix in #793.

**RC2 — PM Mini descriptors point at a component id the library never registers.** *(confirmed by
code and by a throwaway audit run against every descriptor)*

`DESCRIPTORS.SHELLYPLUSPM` and `DESCRIPTORS.SHELLYPMMINIGEN3` declare
`{ type: ComponentType.PM1, ids: [1] }`. Both library classes construct `new Pm1(this)`, i.e. key
`pm1:0`. `ShellyDeviceDelegate` calls `hasComponent('pm1:1')`, gets `false`, and silently skips the
component, so `delegate.pm1` is empty and no handler is ever registered. Channels still exist because
`DeviceManagerService` derives them from `Shelly.GetComponents` (which reports `pm1:0`), so the user
sees `power:0` / `energy:0` frozen at their adoption-time values. The earlier "descriptor-first
category" change worked around the visible symptom (device classified as GENERIC) without fixing the
id. Even if a physical unit reported `pm1:1`, the library would drop its updates, so the descriptor
must follow the library.

**RC3 — Covers, lights, RGB, RGBW and CCT get power/energy channels but no handlers.** *(confirmed)*

`DeviceManagerService` calls `ensureElectricalEnergy` / `ensureElectricalPower` for cover (~551),
light (~700), RGB (~908), RGBW (~1143) and CCT (~1309). `DelegatesManagerService` only registers
`apower` / `voltage` / `current` / `aenergy` handlers inside the switch and PM1 loops. All other
component types' electrical channels are static after adoption. The library exposes `apower`,
`voltage`, `current` on all five and `aenergy` on all but CCT.

**RC4 — Energy meters (EM, EMData, EM1, EM1Data) have no live path.** *(confirmed)*

#792 added descriptors and channel provisioning for Pro EM / Pro 3EM / EM Gen3 / 3EM Gen3. The
delegate stores these components only in its generic `components` map (change listeners are attached,
so `value` events *are* emitted), but it has no typed maps for them and `DelegatesManagerService` has
no loop for them. Every meter channel is frozen at adoption.

**RC5 — `battery.percent` handler is keyed on a leaf the library never emits.** *(confirmed, minor)*

`DevicePower.battery` is an object characteristic. The library path emits `battery`; only the
sleeping-device WS server emits `battery.percent`. Plus H&T works today because it reports through
the WS server, but any path through the library drops the update. Same family as RC1 and fixed by the
same change.

### 3.3 What was checked and ruled out

- **Case sensitivity.** `ComponentType` values are lower-case; `DeviceManagerService` groups by the
  key prefix from `Shelly.GetComponents` (lower-case); the delegate builds `${type}:${id}` from the
  same enum; handler keys use the library's `comp.key`. All three agree. The existing
  `devices-shelly-ng.constants.spec.ts` guard ("declares every component type using the key the
  library reports") still passes. #793 did not break anything.
- **Polling.** `startStatusPoll()` in `shelly-ng.service.ts` is wired and defaults to 60 s.
- **Attach ordering.** `Shellies` is constructed with `autoLoadStatus: true`, so `comp.apower` /
  `comp.aenergy` are populated before `insert()` inspects them.
- **Property write path.** `ChannelsPropertiesService.update()` accepts value-only updates and emits
  `CHANNEL_PROPERTY_VALUE_SET`; nothing there filters the writes.
- **YAML loader.** `resolveComponentType()` lacks `em`, `emdata`, `em1`, `em1data` and falls back to
  `SWITCH`, but no mapping file uses those types, so it is inert. Worth closing as hygiene in PR4.

### 3.4 Collateral damage in the energy module

`EnergyIngestionListener` feeds every `CONSUMPTION` write to `DeltaComputationService`. A drop to 0
is treated as a "counter reset to zero" (baseline reset, no delta). When the true total is written
again — which happens on every `insert(device, true)` re-attach after an mDNS rediscovery — the
service computes `delta = total − 0`, i.e. the device's **lifetime kWh as one 5-minute bucket**. A
plain backend restart does not trigger this because baselines are in-memory, but device reboots and
network flaps do. Installations that have run PM-capable switches for a while may therefore carry
spurious spikes in `energy_delta`. See §14 and §16.

## 4. Target architecture

```
Component.update() ──'change'──▶ ShellyDeviceDelegate.handleChange
                                     └─▶ emitFlattenedValue(compKey, char, value)   ← shared util
                                           emits 'value' for the char AND each dotted leaf
                                                        │
ShellyWsServerService.handleStatusNotification ─────────┘ (same util, same shape)
                                                        │
                                                        ▼
                    DelegatesManagerService handlers keyed on LEAF keys for objects:
                      `${id}|switch:0|aenergy.total`, `${id}|devicepower:0|battery.percent`
                    and on the characteristic for scalars:
                      `${id}|switch:0|apower`, `${id}|em1:0|act_power`, …
```

Principles:

1. **One flattening rule, applied at the delegate boundary.** Both producers emit the same key
   shape, so a handler works regardless of transport.
2. **Handlers never receive objects for numeric properties.** `coerceNumberSafe` returns `null` for
   non-primitive input, which `handleNumericChange` already logs and drops. A future object leak
   becomes a warning, not a silent 0.
3. **Electrical wiring is one helper, not five copies.** `wireElectricalChannels(delegate, device,
   comp)` binds `apower` / `voltage` / `current` / `aenergy.total` for any component that has them.
   The switch and PM1 blocks are refactored onto it; cover, light, RGB, RGBW and CCT gain it.
4. **Descriptors are validated against the library, not against hand-typed expectations.** A guard
   test instantiates each model's library class and asserts every declared `${type}:${id}` exists.
5. **Meter components are first-class in the delegate** (typed maps `em`, `emData`, `em1`,
   `em1Data`) and wired to the channel identifiers `DeviceManagerService` already creates.

## 5. Key technical decisions

| Decision | Choice | Alternatives considered |
|---|---|---|
| Where to flatten object characteristics | In `ShellyDeviceDelegate.handleChange`, using a helper extracted from `ShellyWsServerService.emitFlattened` | Make each handler object-aware (`toEnergy` first). Rejected: leaves two producers with different key shapes and keeps `battery.percent` broken on the library path. |
| Key for energy consumption handlers | `aenergy.total` (leaf) and drop the `aenergy` parent handler | Keep `aenergy` and unwrap. Rejected: the parent event would still be emitted by both producers and coerced. |
| `coerceNumberSafe` on objects/undefined | Return `null` (drop + warn downstream) | Leave at `0`. Rejected: this is exactly what hid RC1 for ten months. The v1 plugin uses `?? 0`/`?? 3000` fallbacks so its behaviour is unchanged. |
| PM Mini fix | Change descriptor ids to `[0]` | Add `0` alongside `1`. Rejected: `1` can never match the library and would keep the lie in the descriptor. |
| Guard scope | Fail on "declared but not in library"; only *report* "library has, descriptor lacks" | Fail on both. Rejected for now: it would fail on four unrelated descriptors (see §16) and block this fix. |
| Electrical helper location | Private method on `DelegatesManagerService` | New service. Rejected: the handlers need the manager's maps and write helpers; a service would just pass them through. |
| Debounce | Keep `scheduleWrite` 250 ms for electrical values | Immediate writes. Rejected: PM devices push `apower` several times a second under load. |
| Migration | None. Channel/property identifiers do not change; PM Mini channels already carry `power:0` / `energy:0` from `GetComponents`. | — |

## 6. Detailed implementation design

### 6.1 PR1 — stop zeroing energy counters (foundation)

Files:

- `src/plugins/devices-shelly-ng/utils/transform.utils.ts` (or a new `value-flatten.utils.ts`):
  `emitFlattenedValue(emit, compKey, attr, value)` — emits `(compKey, attr, value)`, then recurses
  into plain-object values emitting `attr.leaf`. Arrays are leaves. Moved out of
  `shelly-ws-server.service.ts`, which becomes a caller.
- `delegates/shelly-device.delegate.ts`: `handleChange` calls the helper instead of a bare `emit`.
- `delegates/delegates-manager.service.ts`:
  - switch and PM1 blocks: register `${id}|${comp.key}|aenergy.total` → `handleNumericChange` →
    `handleChange(consumption, n, false)`. Remove the `aenergy` registration.
  - device-power block: unchanged key (`battery.percent`) — now reachable on both paths.
- `src/common/utils/transform.utils.ts`: `coerceNumberSafe` returns `null` for input that is not
  `null | number | string | boolean`.
- Tests: see §12.

Behavioural contract after PR1: an `aenergy` object arriving on either transport results in exactly
one consumption write with `total`; a bare object reaching a numeric handler is dropped with the
existing "Dropping invalid numeric update" warning.

### 6.2 PR2 — attach the PM Mini meter (independent)

Files:

- `devices-shelly-ng.constants.ts`: `SHELLYPLUSPM` and `SHELLYPMMINIGEN3` → `ids: [0]`. Update the
  delegate comment that claims `pm1:1`.
- `devices-shelly-ng.constants.spec.ts`: new guard `declares only component ids the library device
  class exposes`. For each descriptor model: `Device.getClass(model)`, construct with a stub RPC
  handler (`{ on, off, connected: false, request }`), iterate the device (public `Symbol.iterator`)
  and assert `hasComponent(\`${type}:${id}\`)` for every declared id. Report, but do not fail on,
  library components the descriptor omits.
- `delegates/shelly-device.delegate.spec.ts`: already uses `pm1:0`; no change expected.

### 6.3 PR3 — power readings for lights and covers (after PR1)

Files:

- `delegates/delegates-manager.service.ts`: extract
  `wireElectricalChannels(delegate, device, comp: { id, key, apower?, voltage?, current?, aenergy? })`
  from the switch block. It resolves `power:${id}` / `energy:${id}`, writes defaults, and registers
  `apower`, `voltage`, `current`, `aenergy.total` handlers. Call it from the switch, PM1, cover,
  light, RGB, RGBW and CCT loops. The PM1 block's "throw if property missing" behaviour is
  normalised to the switch block's "skip with comment" behaviour (both are provisioning races).
- No `DeviceManagerService` change: it already creates the channels.

### 6.4 PR4 — energy meter readings (after PR3)

Files:

- `delegates/shelly-device.delegate.ts`: typed maps `em`, `emData`, `em1`, `em1Data` populated in the
  descriptor loop (currently the `else if` chain has no branch for them, so they only land in
  `components`).
- `delegates/delegates-manager.service.ts`: four loops mapping library characteristics to the
  identifiers `DeviceManagerService` already creates:

  | Component | Channel identifier | Property identifiers |
  |---|---|---|
  | `em:{k}` | `power:{k}:a\|b\|c` | `{p}_act_power`, `{p}_voltage`, `{p}_current`, `{p}_freq` |
  | `em:{k}` | `power:{k}:total` | `total_act_power`, `total_current` |
  | `emdata:{k}` | `energy:{k}:a\|b\|c` | `{p}_total_act_energy`, `{p}_total_act_ret_energy` |
  | `emdata:{k}` | `energy:{k}:total` | `total_act`, `total_act_ret` |
  | `em1:{k}` | `power:{k}` | `act_power`, `voltage`, `current`, `freq` |
  | `em1data:{k}` | `energy:{k}` | `total_act_energy`, `total_act_ret_energy` |

  Meter values are flat numbers; a `null` phase (CT not connected) is dropped by
  `handleNumericChange` (`allowNull` not set → currently 0; set `allowNull: true` so a disconnected
  CT does not write 0 — matches how `ensureMeterChannel` skips them).
- `mappings/mapping-loader.service.ts`: add `em`, `emdata`, `em1`, `em1data` to
  `resolveComponentType()` so a future YAML mapping cannot silently become `switch`.

## 7. Issue-to-execution mapping

| Issue | Outcome | Depends on | Model / effort | File ownership | PR title |
|---|---|---|---|---|---|
| #974 | Energy counters track the device on both transports; objects can no longer coerce to 0 | — | sonnet / medium | `delegates/shelly-device.delegate.ts`, `delegates/delegates-manager.service.ts` (switch, PM1, device-power blocks), `services/shelly-ws-server.service.ts`, `utils/*`, `common/utils/transform.utils.ts` + specs | `fix(backend): stop zeroing shelly ng energy counters` |
| #975 | PM Mini (Gen2/Gen3) meter attaches; a guard fails on any declared id the library lacks | — | haiku / low | `devices-shelly-ng.constants.ts`, `devices-shelly-ng.constants.spec.ts`, delegate comment | `fix(backend): attach the shelly pm mini meter component` |
| #976 | Cover, light, RGB, RGBW, CCT electrical channels update live; one wiring helper | #974 | sonnet / medium | `delegates/delegates-manager.service.ts` (all component loops) + spec | `fix(backend): stream shelly ng power readings for lights and covers` |
| #977 | EM/EM1/EMData/EM1Data channels update live | #976 | sonnet / medium-high | `delegates/shelly-device.delegate.ts`, `delegates/delegates-manager.service.ts` (new loops), `mappings/mapping-loader.service.ts` + specs | `feat(backend): stream shelly ng energy meter readings` |

## 8. Dependency graph

```
PR1 (energy counters, flatten, coerce) ──▶ PR3 (electrical helper, lights/covers) ──▶ PR4 (meters)
PR2 (PM Mini descriptor + id guard)   ── independent, touches only constants + its spec
```

PR2 and PR4 both touch `shelly-device.delegate.ts` (comment vs. new maps) — trivial to rebase.
PR3 and PR4 both edit `delegates-manager.service.ts`; PR4 appends new loops after PR3's helper lands,
so serialising them avoids a conflict in the largest file of the plugin.

## 9. Execution strategy

**HYBRID.** PR1 and PR2 run in parallel (disjoint files, disjoint concerns). PR3 starts when PR1
merges; PR4 starts when PR3 merges.

Rationale:

- PR1 changes the event key contract that PR3 and PR4 build on. Starting them earlier means
  re-keying twice.
- PR2 is a two-line fix plus a test; there is no reason to hold it behind PR1, and it lets the PM
  Mini be verified on hardware independently of the switch-side fix.
- PR3 and PR4 edit the same 2 600-line service; serialising them avoids a merge round with
  CodeRabbit on a file that is already hard to review.

**Maximum useful concurrency: 2** (PR1 ∥ PR2). After that, strictly one PR in flight.

## 10. Implementation phases

1. **Approve plan, create issues** — done 2026-09-07 (milestone, epic #973, sub-issues #974–#978).
2. **Phase A — PR1 ∥ PR2.** Each on its own branch from `origin/main`, own worktree. Both must land
   with CodeRabbit clean and green CI.
3. **Phase B — PR3.** Branch from `main` after PR1 merges.
4. **Phase C — PR4.** Branch from `main` after PR3 merges.
5. **Phase D — hardware validation** on the testing Raspberry Pi with a PM-capable switch, a PM
   Mini and (if available) a Pro EM / 3EM. Draft alpha release per the usual epic close-out.
6. **Phase E — follow-ups** filed, not implemented here (§16).

## 11. Expected PR boundaries and linked issues

| PR | Title | Issue | Size estimate |
|---|---|---|---|
| PR1 | `fix(backend): stop zeroing shelly ng energy counters` | #974 | ~150 lines src, ~200 lines tests |
| PR2 | `fix(backend): attach the shelly pm mini meter component` | #975 | ~10 lines src, ~60 lines tests |
| PR3 | `fix(backend): stream shelly ng power readings for lights and covers` | #976 | net negative src (dedup), ~150 lines tests |
| PR4 | `feat(backend): stream shelly ng energy meter readings` | #977 | ~250 lines src, ~250 lines tests |

All four are `backend`-scoped; none touch `spec/`, the admin, the panel, or migrations.

## 12. Testing and verification strategy

Unit (Jest, next to the source):

- `common/utils/transform.utils.spec.ts`: `coerceNumberSafe({})`, `([])`, `(undefined)` → `null`;
  primitives unchanged.
- New flatten helper spec: nested objects emit parent then leaves; arrays are leaves; the WS server
  spec's existing `battery` / `battery.percent` / `battery.V` expectation keeps passing against the
  shared helper.
- `shelly-device.delegate.spec.ts`: a component `change` with an object emits both `aenergy` and
  `aenergy.total`.
- `delegates-manager.service.spec.ts` (the fixture already types `aenergy?: number | { total }` but
  no test uses it):
  - `emitValue('switch:0', 'aenergy.total', 12.345)` → consumption update with `12.345`.
  - `emitValue('switch:0', 'aenergy', { total: 12.345 })` → **no** write and one warning (proves the
    silent-zero path is closed).
  - Same pair for `pm1:0`.
  - Cover/light/RGB/RGBW/CCT: `apower` and `aenergy.total` reach the `power:{id}` / `energy:{id}`
    properties.
  - EM: `em:0` `a_act_power` → `power:0:a` / `a_act_power`; `em1data:1` `total_act_energy` →
    `energy:1`; a `null` phase reading does not write.
- `devices-shelly-ng.constants.spec.ts`: the id guard from §6.2. It must fail on `main` today for
  the two PM Mini descriptors and pass after PR2.

Existing suites that must stay green: the whole plugin (`pnpm run test:unit -- devices-shelly-ng`),
the energy module (delta computation is untouched but exercised by ingestion tests), and
`test:e2e`. Remember the coverage and e2e steps in CI are known to flake; check which step failed
before chasing the diff.

Manual, on the testing RPi (Phase D). Available hardware: **Shelly Pro 4PM** (four PM switches,
Ethernet + WiFi) and **Shelly Pro Dimmer 2PM** (two PM lights). No PM Mini and no EM meter are
available, so RC2 and PR4 are covered by unit tests only.

1. **Pro 4PM, after PR1.** Put a load on `switch:0`. Within one poll interval `power:0` moves and
   `energy:0` increases monotonically. Watch for one full minute: the value must never drop to 0
   while the relay is on (this is the RC1 symptom). Repeat on one more relay to prove per-id keys.
2. **Pro 4PM, after PR1.** Reboot the device so mDNS rediscovery forces `insert(device, true)`.
   The energy module must log no "Meter reset" or "Counter reset to zero" for it, and the energy
   tile must show no spike.
3. **Pro 4PM, multi-interface.** With both Ethernet and WiFi attached (two delegates, one device),
   confirm a single consumption write per tick, not two, and no warnings about dropped updates.
4. **Pro Dimmer 2PM, after PR3.** Dim `light:0` up and down. `power:0` follows the brightness and
   `energy:0` grows; `light:1` maps to `power:1` / `energy:1`. This is the first hardware proof that
   the shared electrical helper works for a non-switch component.
5. **Pro Dimmer 2PM, after PR3.** Backend log shows no "Dropping invalid numeric update" for either
   light over a ten-minute window.

## 13. Integration validation

- **Energy module.** After PR1, the `CONSUMPTION` stream for a Shelly meter is monotonic between
  genuine resets. Validate with `energy-ingestion.listener` metrics: `negativeDeltaCount` should stop
  incrementing for Shelly devices under normal operation.
- **WebSocket / admin.** Value writes still go through `ChannelsPropertiesService.update()`, so the
  admin live view and the panel receive `CHANNEL_PROPERTY_VALUE_SET` exactly as before. No contract
  change.
- **OpenAPI.** No decorator, DTO or model changes, so `spec/api/v1/openapi.json` is untouched. Run
  `pnpm run generate:openapi` once in PR4 to prove the diff is empty.
- **Sleeping devices.** The WS server path keeps emitting the same key shape; H&T battery keeps
  working, now on both paths.

## 14. Escalation criteria

Stop and ask before proceeding if any of these occur:

- A PM Mini on real hardware reports a component key other than `pm1:0` in `Shelly.GetComponents`.
  The descriptor would then need to follow the hardware *and* the library would need a patch
  (fastybird/node-shellies-ds9 is a fork we control).
- Changing `coerceNumberSafe` breaks a v1 plugin test or any test outside `devices-shelly-ng`.
  Fallback: keep the global helper and add a stricter local variant for the NG delegate manager.
- PR3's helper extraction cannot preserve the PM1 block's default-value ordering without touching
  the connection-state handling further down the same method (indicates the method needs a larger
  split than this fix should carry).
- The energy module's history contains lifetime-total spikes on the testing RPi after the fix. This
  confirms §3.4 and turns the cleanup follow-up from optional into required.
- Any of the four PRs grows past roughly 500 changed lines excluding tests.

## 15. Definition of done

- All four PRs merged to `main` via squash with the titles in §11, CodeRabbit threads resolved, CI
  green.
- The descriptor id guard is in `main` and passes.
- `delegates-manager.service.spec.ts` contains at least one assertion per component type that an
  electrical value reaches its property, and one that an object value cannot.
- Hardware validation steps 1–3 in §12 pass on the testing RPi and are recorded in the epic issue.
- The epic issue is closed with a note on §16 follow-ups filed as separate issues.
- Memory notes updated: `shelly-plugin-component-keys` gains the "declared ids must exist in the
  library class" rule; a new note records that `coerceNumberSafe` now rejects objects.

## 16. Decisions taken (2026-09-07, Adam)

1. **Historical energy data: leave and document.** Installations affected by §3.4 may hold
   `energy_delta` rows equal to a device's lifetime kWh. No cleanup ships with this epic. The
   release notes for the alpha that carries PR1 must state the cause and that affected buckets can
   be identified as a single 5-minute delta far above the device's rating. No energy-module guard
   is filed at this time.
2. **Descriptor drift: report only, follow-up issue.** The audit also found descriptors that omit
   components the library exposes (Plus Dimmer `input:1`, Plus Uni `input:2` vs declared `input:3`,
   Pro Dimmer 2PM `input:2/3`, Pro RGBW PM `cct:1`) and two that declare components the library
   lacks (Plus Wall Dimmer `input:0`, Plus Dimmer `light:1`). PR2's guard fails only on
   "declared but absent from the library" for the PM Mini pair; the rest are logged by the same
   test and tracked in issue 5.
3. **`coerceNumberSafe` change is acceptable** inside the `backend`-scoped PR1. The v1 plugin's
   call sites all carry explicit fallbacks, and PR1 must keep the v1 spec green as proof.
4. **Hardware for Phase D:** Shelly Pro 4PM and Shelly Pro Dimmer 2PM (§12). PM Mini and EM
   meters are validated by unit tests only; the alpha release notes must say so.
5. **Issue creation approved.** Epic, milestone and sub-issues are created as listed in §2.
