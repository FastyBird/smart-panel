# Native HA and Zigbee2MQTT thermostat controllers

ID: FEATURE-VIRTUAL-NATIVE-THERMOSTATS
Type: feature
Scope: backend, admin, panel, spec
Status: done — merged #1504
Issues: #1456, #1457
Parent: #1447

## Outcome

Bind one canonical adopted HA climate entity or Zigbee2MQTT climate unit to an ordinary virtual thermostat.
Preserve requested settings, qualified observations and provider operation outcomes as separate facts. Native
regulation delegates to the unit and cannot acquire guarded protective authority.

## Acceptance

- [x] Canonical exclusive native binding, ordinary virtual identity/history and role-checked authoring.
- [x] Actual HA service calls with validated modes, ranges, temperature units and compound shape.
- [x] Actual Zigbee publication qualified by model/exposes, with explicit unsupported compound/auto refusal.
- [x] Durable request/revision and per-operation outcomes; aliases reserved against conflicting Smart Panel writes.
- [x] Original request fencing, offline/late/cache/restart handling, drift diagnostics without continuous replay.
- [x] Explicit release joins original issued work and relinquishes only metadata ownership, without an OFF claim.
- [x] Local protocol, native lifecycle/HTTP, client and compatibility suites pass; generated APIs come from source.
- [x] Exact-head hosted CI (14 passed) and completed nonblocking main CodeRabbit review passed at `d16b792`; merged #1504 (`12b0bda`).

See [native thermostat guide](../../docs/native-thermostats.md) and the native section of the
[extensions design](../../docs/superpowers/specs/2026-10-15-virtual-device-extensions-design.md).
Installed equipment and alpha/HomeKit/final composed acceptance remain separate.
