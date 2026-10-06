# Task: Matter bridge and controller

ID: EPIC-MATTER
Type: epic
Scope: backend, admin, installer, spec, website
Size: large
Parent: (none)
Status: planned
Created: 2026-10-06

## 1. Business goal

In order to control the devices connected to Smart Panel from Apple Home, Google Home, Alexa, SmartThings or
Home Assistant, even when those devices have no Matter support of their own,
As a Smart Panel owner who also uses a phone ecosystem,
I want Smart Panel to act as a Matter bridge that I pair once with every ecosystem I use, and, in a later
milestone, to bring Matter devices such as IKEA Matter bulbs into Smart Panel as native devices.

## 2. Context

- GitHub epic: [#1191](https://github.com/FastyBird/smart-panel/issues/1191); tasks are its sub-issues.
- Analysis and design: [`docs/superpowers/specs/2026-10-06-matter-integration-design.md`](../../docs/superpowers/specs/2026-10-06-matter-integration-design.md).
- Supersedes [`FEATURE-PLUGIN-MATTER`](../features/FEATURE-PLUGIN-MATTER.md) (controller-only draft, 2025-11-14),
  which becomes milestone 3 of this epic.
- Library: [matter.js](https://github.com/project-chip/matter.js) (`@matter/main` 0.17.x, Matter 1.6,
  Apache-2.0, pure JS, dual ESM/CJS), the stack behind Matterbridge, ioBroker.matter and the Open Home
  Foundation `matterjs-server` that Home Assistant switched to in June 2026.
- Reference implementations in this repo:
  - `apps/backend/src/plugins/devices-homekit` — export-only HAP bridge: managed service lifecycle, allow-list
    of exposed devices, mapper registry with staged bindings, command dispatch through `PropertyCommandService`,
    0700 pairing storage, admin-only status events, admin setup wizard with QR code.
  - `apps/backend/src/plugins/devices-wled`, `devices-zigbee2mqtt`, `devices-homey` — device providers with
    `@ChildEntity` entities, `IDevicePlatform`, wizard sessions and admin `IDeviceWizardAdapter`.
- Prior art: Matterbridge (bridge/childbridge/server modes, documented ecosystem quirks), Home Assistant Matter
  Hub, HA Thread integration documentation.

## 3. Scope

**In scope**

- Milestone 0 — compatibility spike and ADR (toolchain, ecosystems, networking, resources).
- Milestone 1 — bridge MVP: plugin runtime and lifecycle, commissioning, multi-admin fabrics, reset; lights,
  plugs, switches, sensors, batteries, reachability; admin settings and pairing wizard; host and Docker
  networking; website docs; hardware acceptance per ecosystem.
- Milestone 2 — bridge coverage: climate, covers, locks, fans, air purifiers, buttons, valves, energy meters,
  robot vacuums as standalone nodes, optional scenes as switches.
- Milestone 3 — controller: spec extensions, controller runtime and `devices-matter` device platform,
  commissioning by pairing code (multi-admin share, on-network, other vendors' bridges), mapping, admin wizard
  and node management, Thread routes on the host, docs, hardware acceptance with IKEA devices.
- Milestone 4 (optional) — BLE commissioning of new Wi-Fi Matter devices.

**Out of scope**

- Matter certification, a CSA Vendor ID, production attestation certificates, the Matter logo. Builds use test
  certificates (VID `0xFFF1`, PID `0x8000`).
- A Thread Border Router on Smart Panel and commissioning factory-new Thread devices without a phone
  ecosystem.
- Matter cameras/doorbells, media players/TVs, alarm panels, weather (no device type or no ecosystem support).
- Fabric Synchronization, Joint Fabric, groups, Matter scenes management, OTA updates of controlled devices.
- Re-exporting devices that Smart Panel controls through Matter back out through its own bridge.
- Panel (Flutter) changes.

## 4. Acceptance criteria

### Bridge

- [ ] The bridge pairs with Apple Home, Google Home, Alexa, SmartThings and Home Assistant, and can be paired
      with several of them at the same time; the admin lists and removes paired ecosystems and can open a new
      commissioning window.
- [ ] Only devices selected by the administrator are exposed (≤ 150; warning above 50 for Alexa); devices
      controlled through Matter are never offered.
- [ ] Lights (on/off, dimmable, colour temperature, colour), plugs, switches, temperature, humidity,
      illuminance, pressure, occupancy/motion, contact, leak, smoke/CO, air quality and battery are mapped
      (milestone 1); thermostats, covers, locks, fans, air purifiers, buttons, valves, energy and robot vacuums
      follow (milestone 2).
- [ ] State changes in Smart Panel reach the controllers; commands from the controllers go through
      `PropertyCommandService` and failures are reported back; offline devices show as not responding; renames,
      deletions and newly exposed devices apply without re-pairing.
- [ ] Pairing data lives in a 0700 directory under `FB_CONFIG_PATH`, is backed up, and the passcode is a secret
      shown only to owners/admins.
- [ ] Runs on the Raspberry Pi image and in Docker with host networking; mDNS coexists with avahi, the core
      `mdns` module and the HomeKit bridge.

### Controller

- [ ] A device shared from Apple Home, Google Home, IKEA Home smart, SmartThings or HA with a pairing code is
      commissioned into Smart Panel's fabric, adopted through the device wizard, kept in sync and controllable.
- [ ] Thread devices behind an existing border router are reachable on a fresh Raspberry Pi image.
- [ ] Devices behind another vendor's Matter bridge (e.g. IKEA DIRIGERA) become separate Smart Panel devices.
- [ ] A device can be shared from Smart Panel to another ecosystem and removed from Smart Panel without
      breaking it elsewhere.

### Quality

- [ ] Unit tests for converters, mappers (both directions), registries, listeners, dispatchers, wizard
      sessions, platform commands and config validation; real-library spike suite in its own Jest config.
- [ ] OpenAPI follows the backend conventions; admin and website documentation complete in six admin locales.
- [ ] Hardware acceptance matrices recorded below.

### Verification matrix

_Filled in by MT-8 (bridge) and MT-19 (controller)._

| Date | Build | Ecosystem / device | Result | Notes |
| ---- | ----- | ------------------ | ------ | ----- |

## 5. Example scenarios

### Scenario: Shelly relay in Apple Home and Google Home

Given a Shelly relay adopted in Smart Panel and the Matter bridge enabled
When the administrator selects the relay in the Matter bridge wizard and scans the QR code in Apple Home
And then uses "Pair another ecosystem" and enters the new code in Google Home
Then the relay appears as a plug in both apps
And switching it in either app switches the relay and updates Smart Panel and the other app.

### Scenario: Device goes offline

Given an exposed Zigbee2MQTT sensor
When the sensor stops reporting and Smart Panel marks it offline
Then the bridged node reports `reachable = false` and the ecosystems show it as not responding.

### Scenario: IKEA bulb shared to Smart Panel

Given an IKEA KAJPLATS bulb paired in Apple Home over Thread and an Apple TV acting as border router
When the user turns on pairing mode for the bulb in Apple Home and enters the code in the Smart Panel Matter
wizard
Then Smart Panel commissions the bulb into its own fabric, offers it as a lighting device and controls it
And the bulb keeps working in Apple Home.

### Scenario: Unsupported device category

Given a Smart Panel alarm panel device
When the administrator opens the Matter bridge wizard
Then the alarm panel is listed as incompatible with the reason "no Matter device type".

## 6. Technical constraints

- One plugin, `devices-matter`, owns the matter.js dependency and the single process-wide matter.js
  environment; bridge and controller are separate managed services and separate `ServerNode`s.
- All `@matter/*` packages pinned to the same exact version; upgrades are explicit PRs. The controller uses the
  `ClientNode` API (the legacy controller API is deprecated in matter.js 0.18).
- No Matter code in core modules except the websocket gateway's admin-only prefix/redaction lists and spec
  enum values.
- Incremental migrations only (device identity columns in milestone 3); never edit the initial migration.
- No hand edits of generated files; OpenAPI via backend decorators.
- New dependency justified by the epic: `@matter/main` (milestone 0/1); `@matter/nodejs-ble` only in the
  optional milestone 4.
- Unit tests must not load matter.js; real-library tests run in `test/jest-matter-spike.json`.

## 7. Implementation hints

- Mirror `devices-homekit` for lifecycle, mutation handling, storage permissions, mapper registry, binding
  registry, event listener and admin wizard; fix its known gaps (device rename/delete, offline state, one mapper
  per device).
- Map per channel, not per device; stable endpoint ids `sp-<deviceId>[-<channelId>]`.
- Power Source on the bridged node endpoint, never on the root endpoint.
- Disable matter.js process hooks (`@matter/nodejs/config`) and pin mDNS to the LAN interface.
- Controller wizard: follow the Zigbee2MQTT / Home Assistant wizard session pattern and the unified device
  wizard design (`docs/superpowers/specs/2026-07-31-unified-device-wizard-design.md`).

## 8. Child tasks

Tracked as GitHub sub-issues of [#1191](https://github.com/FastyBird/smart-panel/issues/1191):

| Task  | Milestone | Issue | PR title                                                                              | Status  |
| ----- | --------- | ----- | ------------------------------------------------------------------------------------- | ------- |
| MT-1  | 0         | #1198 | test(backend): add matter.js compatibility spike for bridge and controller            | planned |
| MT-2  | 1         | #1199 | feat(backend): add Matter plugin runtime and bridge lifecycle                         | planned |
| MT-3  | 1         | #1200 | feat(backend): expose lights, plugs and switches through the Matter bridge            | planned |
| MT-4  | 1         | #1202 | feat(backend): expose sensors and batteries through the Matter bridge                 | planned |
| MT-5  | 1         | #1203 | feat(admin): add Matter bridge settings and pairing wizard                            | planned |
| MT-6  | 1         | #1204 | feat(cross): prepare host and Docker networking for the Matter bridge                 | planned |
| MT-7  | 1         | #1205 | docs(website): document the Matter bridge                                             | planned |
| MT-8  | 1         | #1206 | hardware acceptance of the bridge per ecosystem                                       | planned |
| MT-9  | 2         | #1207 | feat(backend): expose climate, covers, locks and fans through the Matter bridge       | planned |
| MT-10 | 2         | #1208 | feat(backend): expose buttons, valves and energy meters through the Matter bridge     | planned |
| MT-11 | 2         | #1209 | feat(cross): expose robot vacuums as standalone Matter nodes                          | planned |
| MT-12 | 2         | #1210 | feat(cross): expose Smart Panel scenes as Matter switches (optional)                  | planned |
| MT-13 | 3         | #1211 | feat(spec): extend device specs for Matter controlled devices                         | planned |
| MT-14 | 3         | #1212 | feat(backend): add Matter controller runtime and device platform                      | planned |
| MT-15 | 3         | #1213 | feat(backend): map Matter device types to Smart Panel devices                         | planned |
| MT-16 | 3         | #1214 | feat(admin): add Matter device commissioning wizard and node management               | planned |
| MT-17 | 3         | #1215 | feat(installer): accept Thread routes from border routers for Matter devices          | planned |
| MT-18 | 3         | #1216 | docs(website): document Matter device commissioning                                   | planned |
| MT-19 | 3         | #1217 | hardware acceptance of the controller with IKEA and other devices                     | planned |
| MT-20 | 4         | #1218 | feat(cross): commission new Wi-Fi Matter devices over Bluetooth (optional)            | planned |

Execution order: MT-1 gates everything. Milestone 1 then runs MT-2 → MT-3 → MT-4 on the backend lane, MT-5 after
MT-3, MT-6 in parallel after MT-1, MT-7 after MT-5/MT-6, MT-8 last. Milestone 2 tasks depend only on MT-3 (MT-11
and MT-12 also on MT-5) and can run in parallel. Milestone 3 starts with MT-13 and MT-17 in parallel, then
MT-14 → MT-15 → MT-16 → MT-18 → MT-19. MT-20 is decided after MT-19.

## 9. AI instructions

- Read this file and the design spec before making changes; work one child task per PR, using the PR title
  from the table and `Closes #<issue>`.
- Do not start milestone 1 code before MT-1's ADR is merged; follow its toolchain decision.
- Keep Matter-specific logic inside `apps/backend/src/plugins/devices-matter` and
  `apps/admin/src/plugins/devices-matter`.
- For each acceptance criterion of the child issue, implement it or explain in the PR why it is skipped.
- Update the child-task table and the verification matrix as tasks complete.
