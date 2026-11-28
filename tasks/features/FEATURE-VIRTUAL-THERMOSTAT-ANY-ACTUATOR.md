# Task: Virtual thermostat outputs on any switch, with provider-owned safety extensions
ID: FEATURE-VIRTUAL-THERMOSTAT-ANY-ACTUATOR
Type: feature
Scope: backend, admin
Size: large
Parent: EPIC-VIRTUAL-DEVICE-CAPABILITIES
Status: done — merged #1696, #1781 and #1782

## 1. Business goal

In order to build a thermostat from the devices people actually own,
As an installer or home owner,
I want to use any writable switch from any device plugin (a Zigbee2MQTT wall plug, a Home Assistant switch, a Shelly
Gen1 or Gen2 relay, a Modbus relay, or a plugin added later) as a heating or cooling output, with optional safety
features that a device's integration offers.

## 2. Context

- The virtual thermostat's guarded branches accept only Shelly NG `switch:N` `output` properties. `devices-virtual`
  imports `devices-shelly-ng` in about 18 files: actuator identity (`virtual-thermostat-contract.utils.ts`, built
  from the Shelly MAC), config and repair checks (`virtual-thermostat-config.service.ts`), runtime activity
  (`virtual-thermostat-runtime.service.ts`), the transport and its `shelly-ng.guarded-switch` profile, claims and
  qualification (`virtual-thermostat-claims.service.ts`), installation bindings, loader and artifact (the Shelly guard
  script), authoring context, the remote dew point cooling adapter, floor protection sources
  (`thermostat-protection-source.utils.ts`), and the raw-voltage converter check (`virtual-transform-contract.utils.ts`).
- The Shelly guarded profile relies on a script on the device: ON carries a lease (the relay turns itself off when
  Smart Panel stops renewing it), OFF goes through an ordered fence that also proves OFF, and the floor limit can run
  on the device.
- `devices-shelly-ng` does not import `devices-virtual` (except in specs), so the dependency can be inverted.
- Native thermostats (`native_unit`, Home Assistant and Zigbee2MQTT climate) are out of this change.
- Zigbee2MQTT publishes its state after a `/set` once the device acknowledges the command; that proves acceptance,
  not the physical state. `IDevicePlatform` has no way to request a fresh read of a property.

## 3. Decisions (2026-11-19)

- `devices-virtual` has no lock to, and no import of, any provider plugin. Provider plugins may depend on
  `devices-virtual`.
- Any writable boolean switch property of any device plugin can be a thermostat output. `devices-virtual` never lists,
  checks or special-cases plugins; it uses only the device module's platform contract (`IDevicePlatform`) and
  property metadata, so a plugin added later works without changes to `devices-virtual`.
- No failsafe by default. A provider may register an optional **safety extension** for its own devices (Shelly's
  guard script and lease, a Zigbee2MQTT `on_time` auto-off, ...) through a contract defined in `devices-virtual`.
  Each integrator implements its own; the UI offers it when available.
- OFF is proven only by a device state report observed after the OFF command, never by the acknowledged command
  echo. This applies to every output, so deferred item 1 from #1652 is resolved here.
- Requesting a fresh read is an **optional** platform capability. A plugin that implements it gets faster OFF proof;
  a plugin without it still works, and OFF is proven by its next report or poll after the command. Until OFF is
  proven the output stays unproven: its claim is held, the opposite output is not allowed, and the detail page shows
  why. Read-back support never decides whether a switch can be selected.
- Floor protection with any switch: Smart Panel enforces the limit in software, and the operator acknowledges a
  hardware floor limiter (as installation qualification already asks). A provider extension may add an on-device
  limit.
- Virtual thermostats are not in use anywhere yet, so there is no compatibility to keep: no data migration of
  existing claims, no legacy readiness paths (`legacy-null-managed-shelly`, capability v2, NULL-qualification
  continuity) and no fallback defaults such as the `shelly-ng.guarded-switch` column default. Remove them instead of
  adapting them. Schema changes still go in a new incremental migration.

## 4. Scope

**In scope**

- An optional read-back capability on `IDevicePlatform` (request a fresh device read of one property, resolved by the
  next sample observed after the request), plus the generic OFF proof that uses it when present and waits for the
  next report otherwise. Implement it in the plugins whose devices allow a fresh read (for example Zigbee2MQTT
  `/get`, Shelly NG `Switch.GetStatus`, Shelly v1 status, Home Assistant, Modbus); a plugin that lacks it is not
  excluded.
- A provider-neutral actuator identity (device, channel and property identity, no MAC), a generic supervised output
  path (send through the platform, confirm OFF by read-back) and generalized claims, qualification and runtime.
- A safety extension contract and registry in `devices-virtual`; the Shelly guard script, its lease, fence,
  installation artifact and remote dew point cooling move to `devices-shelly-ng` and register through it.
- Floor and cooled-surface sources and raw-voltage converters accept any provider's properties; Shelly-specific
  qualifications move behind provider extensions.
- A lint rule or spec that fails when `devices-virtual` imports another plugin.
- Removal of the legacy readiness and qualification-continuity paths and Shelly defaults.
- Admin: output picker for any switch, extension options when offered, acknowledgements, detail diagnostics.
- Docs: Virtual Devices page and `docs/climate-architecture.md`.

**Out of scope**

- New provider safety extensions beyond moving Shelly's (a Zigbee2MQTT `on_time` extension is a follow-up).
- Native thermostats.

## 5. Acceptance criteria

- [x] `devices-virtual` contains no import from another plugin, enforced by a check.
- [x] A writable switch of any plugin can be bound, qualified and activated as a heating or cooling output; tests use
      a stub platform with and without read-back, not only real plugins.
- [x] OFF requires a fresh report of the switch property after the read or OFF command. An acknowledgement or a
      device report carrying a cached switch value keeps the claim held and the opposite output blocked.
- [x] Without a safety extension, the editor and detail page state that the output has no device-side failsafe, and
      activation requires the operator's acknowledgement of independent protection.
- [x] A Shelly output with the Shelly safety extension still gets its device lease, fence and on-device floor limit.
- [x] No legacy readiness or continuity path and no Shelly default remains in `devices-virtual`.
- [x] Floor protection works with any switch through the software limit and the acknowledgement.
- [x] Tests cover the generic path, read-back proof and the extension registry.

## 6. Delivery plan (separate PRs)

1. Optional read-back capability on `IDevicePlatform` and its implementations in the plugins whose devices allow a
   fresh read; no plugin is required to implement it.
   - 1a: the contract (`requestPropertyRead`), the `commandEcho` sample mark, the generic proof
     (`PropertyReadProofService` waits for the first independent, property-specific report after dispatch) and the
     Zigbee2MQTT implementation (command echo windows and `/get`).
   - 1b: read support in further plugins (Shelly NG, Shelly v1, Home Assistant, Modbus, ...), each marking its own
     command acknowledgements where it publishes them as state.
2. Safety extension contract and registry in `devices-virtual`; move the Shelly guarded profile, guard script artifact
   and remote dew point cooling into `devices-shelly-ng`; no behavior change.
3. Provider-neutral actuator identity, generic supervised output, claims and runtime with read-back OFF proof;
   remove the legacy paths.
4. Provider-neutral floor/surface sources and converters; import check.
5. Admin and docs.

## 7. Technical constraints

- Keep the existing safety rules: opposed outputs are never active together, invalid or stale inputs release output,
  and configuration or preview never energizes an output.
- Migrations are incremental; never edit the initial migration.
- Tests are expected for each step.
