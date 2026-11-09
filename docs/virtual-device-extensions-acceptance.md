# Virtual device extensions: software acceptance reconciliation

Final software and alpha delivery reconciled on 2026-11-09 against merged #1544,
`976fa55aa803cc0472abab6f00d7da5826d50200`, and published alpha.66 source `54090f341d16235e65ce1a1b4bbce2da571ad4fa`.
All fourteen prerequisite software children are closed; #1462/#1447 close with this final record.
All 139 fixed original residuals now have current scoped/replacement bindings; all 261 identities and their
per-row semantic limits remain in [the canonical ledger](work/virtual-thermostat/original1473-case-map.json).
The governed bridge, schedules, occupancy, native HA/Zigbee and cover/HomeKit implementations remain delivered.

The [final software/alpha record](work/virtual-thermostat/final-software-alpha-validation.md) records
640/640 focused consumers and #1544's hosted 13,473 unit passes (one unrelated existing mapper skip),
then all 29 ordinary E2E suites/**426/426 without skips**, including combined HTTP/manual priorities and
upgrade from alpha.64. All 139 residuals retain their scoped/replacement limits.

[Alpha.66](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.66) completed all 19 release
jobs, including packages, Panel/server payloads, three Raspbian images and both native Docker runtime checks
plus their shared manifest. Final asset names/checksums and the Raspbian post-run normalization are recorded
in the linked delivery record. Installed #1463 remains separate and no hardware was operated.

## Software delivery state

| Work                                                                  | State and evidence                                                            | Remaining boundary                                                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Numeric policy, numeric/binary aggregates and authoring (#1448–#1450) | Complete; #1464/#1465, child issues already closed                            | Preserve through final composition                                                                                                      |
| Switch/outlet group foundation (#1451)                                | Complete; #1464, child already closed                                         | No new room intent domain is implied                                                                                                    |
| Fan/cover backend (#1452)                                             | Software complete; #1467/#1505                                                | Qualified percentage POSITION/TILT merged; installed motors remain #1463                                                                |
| Group authoring and controls (#1453)                                  | Software complete; #1466/#1467                                                | Unsupported profiles retain refusals; installed equipment remains separate                                                              |
| Provider-neutral parallel branches (#1454)                            | Software complete; #1469/#1470/#1471                                          | Installed HA/Zigbee/Shelly qualification remains separate                                                                               |
| Presets and durable overrides (#1455)                                 | Software complete; #1469/#1470 and native intent follow-ups #1488–#1493/#1498 | Schedule/occupancy composition is adopted under #1458; original-reference bindings are delivered in alpha.66                                            |
| Activity climate bridge (#1458)                                       | Software complete; #1498/#1501/#1502 and composed criterion map below                        | Independent manual priorities and UNKNOWN input are covered; original-reference bindings are delivered in alpha.66                                    |
| Dew point and cooling protection (#1459)                              | Software complete; #1471                                                      | Installed cooling qualification is #1463                                                                                                |
| Home Assistant native units (#1456)                                   | Software complete; merged #1504                                               | Installed-unit qualification remains #1463; named software composition is qualified below                                                                      |
| Zigbee2MQTT native units (#1457)                                      | Software complete; merged #1504                                               | Installed-unit qualification remains #1463; named software composition is qualified below                                                                      |
| SDK operators (#1460)                                                 | Complete; #1468, child already closed                                         | Preserve version/lifecycle/failure contracts                                                                                            |
| HomeKit (#1461)                                                       | Software complete; #1466/#1505                                                | Atomic native modes and HAP composition merged; actual Apple pairing remains #1463                                                      |
| Final software and alpha (#1462)                                      | Complete; #1544 and alpha.66 | Final version/tag/jobs/artifacts recorded; installed checks remain #1463                                     |
| Parent epic (#1447)                                                   | Software/alpha complete; closes with this record | Installed qualification remains #1463                                                                                     |
| Installed acceptance (#1463)                                          | Open, after the published alpha                                               | Named equipment/firmware and separately reviewed actual procedure, including Apple Home pairing                                         |

A dependency remaining open does not revoke a completed child's supported-software scope. In particular,
#1453 does not promise commands that #1452 explicitly refuses. Unavailable optional domain actions retain
existing disabled/no-targets/unsupported/partial semantics; this epic does not silently acquire the unrelated
security epic or require the optional camera input.

## Reused activity issues

| Issue | Disposition                                 | Evidence or exact remainder                                                                                                                                                     |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1292 | Already closed; preserve                    | Definitions, per-space configuration and disabled/unset climate defaults, #1472                                                                                                 |
| #1293 | Software complete; closure on reconciliation merge | Combined all-available-domain HTTP and unit witnesses, including failed-media and rejected-climate variants; see criterion map below |
| #1294 | Software complete                           | Authenticated activation/configuration endpoints, revision/identity events and generated contracts, #1472                                                                       |
| #1295 | Software complete                           | Mounted Admin configuration, reset/preview/conflict handling and six locales, #1472/#1498                                                                                       |
| #1296 | Software complete                           | Panel selection, loading, truthful results, manual clear, reconnect and localization, #1472                                                                                     |
| #1297 | Software complete; merged #1501             | Persisted weekly schedules, timezone/DST gap/fold, durable watermark/dedup and manual selection/clear until the next trigger; see scheduling evidence below                     |
| #1298 | Software complete; merged #1501             | Mounted weekly Admin editor with entry CRUD, per-space enablement/timezone, six locales, validation, CAS conflicts and space rebinding                                          |
| #1362 | Software complete; merged #1501             | Read-only Panel current/next plan and manual indication, transitions, unknown/unavailable states and owned refresh/disposal; no Panel editor                                    |
| #1299 | Software complete; merged #1502             | Occupancy state machine, selected/multiple sensors, vacancy timeout, manual priority and truthful unavailable state                                                             |
| #1300 | Software complete; merged #1502             | Admin sensor selection, timeout and occupied/vacant mode mapping                                                                                                                |

The original #1293 combined-domain requirement is now exercised by one actual HTTP operation, not inferred from
separate domain suites. #1458 reuses the delivered scheduler and occupancy engine. The closed issues listed above
retain their full software scope and the approved disabled/unset climate-default amendment.

## Composed activity and automation criteria

| Issue and criterion | Named current witness | Acceptance boundary |
| --- | --- | --- |
| #1293: all available domains in one activation | [combined HTTP][activityCombinedHttp]: `composes all configured activity domains through ordinary HTTP and real adapters; media fails=%s` | Authenticated migrated AppModule; lighting/climate/covers/media execute together; failed media preserves the other outcomes; security stays UNSUPPORTED. |
| #1293: unit fan-out, results and partial failure | [mode service unit][activityCombinedUnit]: `orchestrates every available domain and persists each result when climate rejects=%s` | Real mode/domain services and SQLite, controlled domain I/O; preview preserves the complete saved configuration and creates no activity-state row, events or commands; rejecting climate still dispatches the other three domains and persists all five results. |
| #1458: reuse existing features and dormant climate defaults | [authored defaults][activityCurrentDefaults], existing #1292/#1294–#1300/#1362 evidence above | No duplicate scheduling/presence engine; no preset or numeric setpoint is inferred from a mode name. |
| #1458: explicit configured preset mapping | [configured HTTP][activityConfiguredHttp]: `previews without native writes, activates %j through HTTP and deactivates the exact installation` | Separate configured eco and numeric heat variants; preview is write-free and activation installs the actual private source/slot. |
| #1458: room/thermostat precedence and UNKNOWN | [manual-priority HTTP][activityPriorityHttp]: `composes scheduled and observed activity with independent room and thermostat manual precedence` | Due schedule selects eco, fresh motion selects heat, disconnected input becomes UNKNOWN without vacancy; room hold and thermostat hold remain independent after occupancy Resume. |
| #1458: DST/restart/dedup | [schedule clock][activityCurrentClock] and [scheduler integration][activityCurrentScheduler] | Missing spring time, first autumn fold, half-hour fold, durable occurrence claims, backward clock, manual-until-next-trigger and restart without replay. |
| #1458: current baseline/preset and manual-hold guard | [schedule HTTP][activityScheduleHttp] and [motion HTTP][activityMotionHttp], each with `thermostat manual hold=%s` | Both routes use the governed climate bridge and refuse to overwrite the independent thermostat manual baseline. Protective ON/floor/expiry guards retain their separate [runtime witnesses][activityCurrentRuntime]. |

The complete seven-file local invocation passed **67/67**, zero failures/skips: mode service 12, domain adapters 9,
schedule clock 9, scheduler integration 20, occupancy state 5, occupancy inputs 4 and occupancy integration 8.
Report SHA-256 `1a5cf00ed36fa63f682157613222a6145dce15a28d8a8de6fa503ab902fdb4a3`.
The retained preceding fan-out control makes only the rejected-climate variant fail (five expected
results versus two); the success control passes, with ten other file cases unrun. Production was restored
byte-for-byte. Control report SHA-256 `7d3faa2d9b45d1c118ec028c459b986863d77f783ae3bcb532230353d6ec033f`.

The current variants additionally compare the entire saved configuration before and after preview, including
fields such as display order that could change without a revision update. A production control increments
`activityOrder` inside preview without changing the revision: both strengthened variants fail, with ten other
cases unrun (report SHA-256 `69b8da1d7593f012e0406ad5e6cb316e11b68cb0d43f9138fde0336374ef90e9`).
The same mutation passes both variants when only the new snapshot assertions are removed (report SHA-256
`23d90401864daae62e77cadd9f5991142d89a98895c2d4c34c42a013e0261779`). Production and the strengthened
tests are restored byte-for-byte before the complete positive invocation above. The fan-out control retained
above predates this snapshot strengthening; it was not replayed in this invocation.

The already merged HTTP and scheduler/occupancy witnesses also passed in
[ordinary hosted backend CI](https://github.com/FastyBird/smart-panel/actions/runs/42205235236/job/127850109421)
at sibling test-only head `d1018936dc786a788f11811da0c791e45b37482a`: 727 unit suites / 13,345 passes, one existing
unrelated skipped mapper case, then all 29 ordinary E2E suites / 426 passes without skips. The hosted HTTP, scheduler and occupancy files
match that reconciliation's summary base; these hosted counts precede the two unit variants added then.
The final #1544 hosted results and alpha.66 delivery are recorded above.

This accepts the supported software scope of #1293/#1458. The physical qualification boundary in the HTTP fixture
is controlled separately; these criteria do not grant installed protective qualification. At that historical checkpoint the original ledger was unchanged; #1543 subsequently completed its current bindings.
Final software and alpha.66 delivery complete #1462/#1447 with this record; installed #1463 remains separate.

## Time-scheduling follow-up (#1297, #1298, #1362)

The scheduler reuses `SpaceModeService` and the existing governed climate adapter. It creates no second thermostat
or presence engine. Default schedules are disabled/empty; climate mode names still imply no presets or temperatures.
The configured preset and thermostat manual-hold cases execute through the real migrated AppModule and native ledger.
#1458 combined acceptance is adopted in the criterion map above; presence/occupancy and unavailable-input semantics merged in #1502.

| Acceptance boundary                                                                                     | Current source/test witnesses                                                                                              |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Weekday patterns, timezone, DST gap/first fold and half-hour transitions                                | [schedule clock](../apps/backend/src/plugins/spaces-home-control/schedule/schedule-time.spec.ts)                           |
| Native claim dedup, manual selection/clear, restart without replay, clock rollback, disable/delete/stop | [scheduler integration](../apps/backend/src/plugins/spaces-home-control/services/space-mode-scheduler.integration.spec.ts) |
| Disabled upgrade backfill, retained manual rows, reopen and space cascade                               | [migration 50 test](../apps/backend/src/migrations/__tests__/1000000000050-AddSpaceModeSchedules.spec.ts)                  |
| Authentication, validation, configuration CAS and explicit preset/manual hold composition               | [activity/climate HTTP fixture](../apps/backend/test/space-climate-automation.e2e-spec.ts)                                 |
| Actual weekly Admin editor, local draft CRUD, six locales, conflicts and space changes                  | [mounted schedule editor](../apps/admin/src/plugins/spaces-home-control/components/space-mode-schedule-section.spec.ts)    |
| Panel planned state, manual indication, read-only transitions, disconnect and polling disposal          | [Panel schedule tests](../apps/panel/test/plugins/spaces-home-control/mode_schedule_test.dart)                             |

[Execution policy and API](space-activity-modes.md#time-schedules) distinguish planned state, original activity
admission and actual device convergence. These are software fixtures; published-alpha and installed-equipment gates
remain separate. Historical RED/UNKNOWN evidence remains attached to its original source and is not erased by this work.

## Occupancy follow-up (#1299, #1300)

The occupancy implementation merged in #1502 after all 14 checks and completed main review at `95a191b`.
Its scoped child issues are closed. The criterion map above adopts the combined #1458 acceptance; installed-equipment
qualification remains separate.

| Acceptance boundary                                                                                                | Current source/test witnesses                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Occupied/Vacant/Unknown, monotonic timeout, clock changes and unavailable reset                                    | [occupancy state machine](../apps/backend/src/plugins/spaces-home-control/occupancy/space-occupancy.spec.ts)                                                                                                           |
| Explicit selected/multiple motion or presence inputs, fresh live reports, offline/degraded/membership refusal      | [occupancy input tests](../apps/backend/src/plugins/spaces-home-control/services/space-occupancy-inputs.service.spec.ts)                                                                                               |
| Vacancy action, exact prior-selection restore, empty restore, manual hold/resume CAS and native rollback           | [occupancy SQLite integration](../apps/backend/src/plugins/spaces-home-control/services/space-occupancy.integration.spec.ts)                                                                                           |
| Dormant existing-installation backfill, persisted configuration, reopen and cascade                                | [migration 51](../apps/backend/src/migrations/__tests__/1000000000051-AddSpaceOccupancy.spec.ts)                                                                                                                       |
| Authentication, validated config, live motion and thermostat manual precedence through the existing climate bridge | [composed activity HTTP](../apps/backend/test/space-climate-automation.e2e-spec.ts)                                                                                                                                    |
| Sensor metadata remains valid after unrelated state writes; real eager plugin dependency edits still invalidate it | [metadata regression](../apps/backend/src/modules/devices/services/property-metadata.service.spec.ts)                                                                                                                  |
| Actual localized Admin controls, sensor/mode/timeout save, conflict, lost response and route-owned drafts          | [occupancy editor](../apps/admin/src/plugins/spaces-home-control/components/space-occupancy-section.spec.ts), [configure navigation](../apps/admin/src/plugins/spaces-home-control/views/view-space-configure.spec.ts) |
| Panel status/manual indication, foreign/stale requests, disconnect, deadline, polling and page disposal            | [Panel occupancy tests](../apps/panel/test/plugins/spaces-home-control/occupancy_test.dart)                                                                                                                            |

[Occupancy execution policy and API](space-activity-modes.md#room-occupancy) define the fail-closed input,
manual-resume and admitted-operation boundaries. Camera input remains optional. Software results do not establish
that installed lighting, heating or other equipment converged; original per-domain outcomes still apply.

## Native HA and Zigbee2MQTT follow-up (#1456, #1457)

The native strategy binds one canonical adopted unit to an ordinary virtual thermostat and reserves its Smart Panel
mode/setpoint aliases. It keeps requested settings, qualified provider observations and unconfirmed operation outcomes
separate. It delegates regulation to the unit and adds no protective floor, parallel-output or opposed-output authority.
Delivered in [#1504](https://github.com/FastyBird/smart-panel/pull/1504), squash `12b0bda95df843b5009432fea2da936508863978`. All 14 checks and the completed nonblocking main review passed at `d16b7929b03e778b0fde16bfaab7c4890238035f`. Installed equipment remains separate.

| Acceptance boundary                                                                                                                                      | Source/test witnesses                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry-backed HA entity, units/ranges, explicit heat/cool and advertised heat_cool compounds, exact service calls, original connection and sample ages | [HA native adapter](../apps/backend/src/plugins/devices-home-assistant/services/home-assistant-native-climate.service.spec.ts), [prior ordinary work fence](../apps/backend/src/plugins/devices-home-assistant/platforms/home-assistant.native-climate.spec.ts)                                                                          |
| Canonical IEEE/model/exposes/default endpoint, exact scalar publication, explicit auto/compound refusal and qualified raw feedback                       | [Zigbee native adapter](../apps/backend/src/plugins/devices-zigbee2mqtt/services/native-climate-adapter.service.spec.ts)                                                                                                                                                                                                                 |
| Exclusive durable binding, UUID/revision journaling, original completion, release, observation guard and restart without replay                          | [native lifecycle](../apps/backend/src/plugins/devices-virtual/services/native-thermostat.integration.spec.ts), [incremental migration 52](../apps/backend/src/migrations/__tests__/1000000000052-AddNativeThermostats.spec.ts)                                                                                                          |
| Queued operations preserve their original async context while receiving a fresh structural owner                                                         | [structural lock regressions](../apps/backend/src/modules/devices/services/device-structure-lock.service.spec.ts)                                                                                                                                                                                                                        |
| Authenticated AppModule creation, ordinary virtual commands and reserved physical writes                                                                 | [virtual device HTTP fixture](../apps/backend/test/devices-virtual.e2e-spec.ts)                                                                                                                                                                                                                                                          |
| Explicit authoring/commands, truthful outcomes, refresh and old-response fencing                                                                         | [mounted Admin editor](../apps/admin/src/plugins/devices-virtual/components/native-thermostat-editor.spec.ts), [actual six-locale rendering](../apps/admin/src/plugins/devices-virtual/components/native-thermostat-locales.spec.ts), [Panel native detail](../apps/panel/test/modules/devices/presentation/native_thermostat_test.dart) |

The [native thermostat guide](native-thermostats.md) names supported and refused profiles, release semantics and
external-writer drift. Protocol fixtures exercise production transport adapters with component fakes; they do not
qualify installed equipment, every Zigbee model/firmware, HomeKit composition or alpha publication.

## Cover groups and HomeKit follow-up (#1452, #1461)

The follow-up implements calibrated Shelly native POSITION and capability-qualified slat percentage TILT through
existing composite admission, motor ordering and deadlines. A fresh post-response full status must contain the exact
requested target at rest. Native percentages and explicit degree tilt remain separate contracts; no inversion or
angle conversion is guessed. Unsupported providers/profiles retain explicit refusals.

Named witnesses: [real RPC/SQLite/core/HAP covering tests](../apps/backend/src/plugins/devices-shelly-ng/services/shelly-cover-command.integration.spec.ts),
[degree/percentage compatibility](../apps/backend/src/plugins/devices-virtual/services/virtual-typed-group.utils.spec.ts),
[real HAP/native journal composition](../apps/backend/src/plugins/devices-virtual/services/native-thermostat.integration.spec.ts),
[managed HAP feedback, expiry and unavailable setpoints](../apps/backend/src/plugins/devices-homekit/services/homekit-virtual-state.integration.spec.ts),
[existing HomeKit component lifecycle](../apps/backend/src/plugins/devices-homekit/services/homekit-command-convergence.integration.spec.ts),
[Admin controls](../apps/admin/src/plugins/devices-virtual/components/virtual-light-group-detail.spec.ts) and
[Panel controls](../apps/panel/test/modules/devices/presentation/actuator_group_flow_test.dart).

Delivered in [#1505](https://github.com/FastyBird/smart-panel/pull/1505), squash `54e2c92c57d4aa2a906cd7744e3d60294c203377`,
after exact-head green CI and completed main review. #1452/#1461 are closed. These witnesses do not claim physical
actuation, real Apple pairing, complete original-scenario reconciliation or alpha publication.

## Complete child acceptance and named evidence

The following criterion-level mappings retain the initial reconciliation pinned at `b0bfd429ae9f015911d1baad37583652b62d3995`.
Later delivery and final composition evidence is recorded above; those earlier links do not certify the new final batch.
Closed child software criteria neither close #1447 nor grant installed qualification.

### #1453: feat(cross): expose actuator group profiles in device and room controls

Merged delivery: [#1466](https://github.com/FastyBird/smart-panel/pull/1466), [#1467](https://github.com/FastyBird/smart-panel/pull/1467), [#1471](https://github.com/FastyBird/smart-panel/pull/1471).

| Original criterion                                                                                                      | Current source/test witnesses                    |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Admin profile selection, candidate compatibility, create/edit/repair and explicit capability-change diagnostics.        | [groupAuthor], [wizard], [repair], [groupPolicy] |
| Panel handles fan/cover/switch/outlet group mixed/unknown state and member command outcomes without synthetic averages. | [groupPanel], [feedback], [partial]              |
| Scenes and room intents use existing composite path with actual supported controls.                                     | [groupRoom], [scene], [groupCommand]             |
| Regenerate contracts and test existing lights, locales, partial failures and reconnect/repair.                          | [reconnect], [repair], [wizard]                  |

### #1454: feat(backend): add provider-neutral parallel thermostat branches

Merged delivery: [#1469](https://github.com/FastyBird/smart-panel/pull/1469), [#1470](https://github.com/FastyBird/smart-panel/pull/1470), [#1471](https://github.com/FastyBird/smart-panel/pull/1471).

| Original criterion                                                                                                                                           | Current source/test witnesses                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Version provider-neutral actuation/observation/qualification before extending Shelly-specific contracts.                                                     | [actuation]                                         |
| Migrate existing claims/journals to singleton groups preserving identity/generation and global physical ownership; bounded8 total mandatory members.         | [migration], [bounds], [legacy]                     |
| Same-mode parallel members differ from opposed branches; persist leaf dispatches and unresolved outcomes, whole-branch inhibit/release on mandatory failure. | [dispatch], [lateOn], [retirement], [branchRuntime] |
| Require all opposed leaves OFF/drained before changeover; test restart/remap/delete/recovery/partial late ON and unchanged legacy qualified Shelly behavior. | [opposed], [restart], [retirement], [legacy]        |

### #1455: feat(cross): add thermostat presets and durable temporary overrides

Merged delivery: [#1469](https://github.com/FastyBird/smart-panel/pull/1469), [#1470](https://github.com/FastyBird/smart-panel/pull/1470), [#1488](https://github.com/FastyBird/smart-panel/pull/1488), [#1489](https://github.com/FastyBird/smart-panel/pull/1489), [#1490](https://github.com/FastyBird/smart-panel/pull/1490), [#1491](https://github.com/FastyBird/smart-panel/pull/1491).

| Original criterion                                                                                                                      | Current source/test witnesses                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Explicit comfort/eco/away configurations validate branches, ranges and deadband; old controllers remain manual/disabled automation.     | [defaults], [validation], [comfortService]                                       |
| Persist override identity/actor/source/revision/absolute expiry and expose effective source/preset/expiry in admin/panel.               | [overrideIdentity], [comfortAdmin], [comfortPanel], [comfortDocs]                |
| Explicit OFF and all protective guards precede automation; overrides survive background changes and expiry recomputes current baseline. | [off], [priority], [baseline], [queuedGuard]                                     |
| Test exact expiry, restart, clock rollback, stale command revisions, mode changes and final-dispatch guard checks.                      | [baseline], [overrideRestart], [rollback], [validation], [queuedGuard], [manual] |

### #1459: feat(cross): add dew point sensors and cooling protection

Merged delivery: [#1471](https://github.com/FastyBird/smart-panel/pull/1471).

| Original criterion                                                                                                                                         | Current source/test witnesses                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Typed two-input versioned dew-point producer preserves both identities, quantity/unit/domain, bounded skew, source ages and earliest expiry.               | [dewFormula], [dewRuntime], [dewFresh], [dewSkew], [dewRepair]   |
| Dew point cannot masquerade as ambient/floor Celsius; add authoring/repair/quality presentation and reference-vector/domain tests.                         | [dewRole], [vectors], [dewAdmin]                                 |
| Separate cooling guard trips at surface<=dewpoint+margin, strict hysteresis recovery and required-input failure; optional explicit absolute floor minimum. | [cutoff], [coolingFault], [coolingEligibility], [coolingRelease] |
| Preserve heating high guard; preview and activation expose actual provider protection eligibility, never reusing a heating-only artifact as cooling proof. | [coolingEligibility], [coolingRecord], [legacy]                  |

### #1294: feat(backend): expose activity mode activation endpoints and events

Merged delivery: [#1472](https://github.com/FastyBird/smart-panel/pull/1472).

| Original criterion                                      | Current source/test witnesses                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| REST endpoints, websocket events, OpenAPI regeneration. | [activityAPI], [activityAPITest], [activityService], [activityDocs] |

### #1295: feat(admin): configure space activity modes

Merged delivery: [#1472](https://github.com/FastyBird/smart-panel/pull/1472).

| Original criterion                                        | Current source/test witnesses                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Space detail page shows "Activity Modes" section          | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| Admin can enable/disable each mode for the space          | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| Admin can click on a mode to edit its configuration       | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| Mode editor shows per-domain settings with current values | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| Admin can override default values for any domain          | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| Admin can reset mode to defaults                          | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| Changes are saved via API and reflected immediately       | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| Disabled modes are hidden from panel UI                   | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| UI is responsive and follows existing admin patterns      | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |
| All strings are localized (en-US at minimum)              | [activityAdmin], [activityValidation], [activityPanel], [activityDocs] |

### #1296: feat(panel): add activity mode quick actions to space pages

Merged delivery: [#1472](https://github.com/FastyBird/smart-panel/pull/1472).

| Original criterion                                       | Current source/test witnesses                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| SpacePage shows "Modes" section when modes are available | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Each enabled mode is shown as a tappable button          | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Buttons show mode icon and localized name                | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Active mode button is visually highlighted               | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Tapping a mode activates it (API call)                   | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Loading indicator shown during activation                | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Success feedback on completion                           | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Partial failure shows warning indicator                  | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Tapping active mode deactivates it (returns to manual)   | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| Modes section hidden when no modes enabled for space     | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| UI is responsive across different panel sizes            | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |
| All strings are localized (en, cs at minimum)            | [activityPanel], [activityNarrow], [activityPartial], [activityDocs] |

The original legacy actor-tagged baseline priority test is not used as live automation evidence. Its replacement
witness is the actual native opt-in/manual-hold path, alongside explicit OFF, override and queued-command tests.

## Parent acceptance and original PR #1473

Merged software includes aggregates, groups, comfort/overrides, dew point/cooling guards, guarded parallel branches,
SDK operators, schedules, occupancy, native HA/Zigbee units and HomeKit composition. The named combined activity,
schedule/motion/independent-manual-priority and published-alpha64 upgrade files pass in #1543's complete
ordinary E2E job, and again in #1544. The final reference inventory is **139/139 residuals bound, zero unbound**, with 269
witnesses across all 261 original rows: 173 scoped invariants, 82 replacements and six descriptor controls.
The [per-row source/semantic map](work/virtual-thermostat/original1473-case-map.json) preserves every
original hash and supported current replacement boundary. Whole retired private-protocol equivalence
and installed safety are not claimed.

Frozen [#1473](https://github.com/FastyBird/smart-panel/pull/1473) at `2c19907` is a historical reference,
not a remaining patch to rebase/merge. Its200 PASS/61 FAIL describes that old source only. Preserve the
source/history when closing the draft as superseded. The replacement implementation and original-reference
witnesses are merged through #1543, with final cleanup/acceptance #1544 and complete alpha.66 delivery above.
No remaining patch is to be taken from the frozen draft. Hardware remains #1463.

## Boundaries retained

- Climate defaults are disabled/unset. Activity names never manufacture presets or setpoints.
- Explicit OFF, manual hold, overrides, protective admission and original ownership remain authoritative.
- A graph refresh during pending installation settlement may fail and retire that activation. Original runtime
  work is joined; newer graph authority is not adopted and physical work is not automatically retried. This is the
  explicitly accepted availability boundary, not a claim of seamless pending continuation.
- Native-unit adapters use the explicitly supported HA and Zigbee2MQTT contracts above. Unsupported native shapes and cover commands remain refused.
- Historical timeout/worker-warning causes remain unknown. Later passing results do not diagnose them.
- Alpha.66 software/artifact delivery is verified above; no equipment was operated or commissioned.

## Pinned source and test links from the initial reconciliation

[activityAPI]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/spaces-home-control/controllers/space-modes.controller.ts#L23
[activityAPITest]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/spaces-home-control/controllers/space-modes.controller.spec.ts#L24
[activityAdmin]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/spaces-home-control/components/space-activity-modes-section.spec.ts#L147
[activityDocs]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/docs/space-activity-modes.md#L1
[activityNarrow]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/panel/test/plugins/spaces-home-control/activity_modes_test.dart#L925
[activityPanel]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/panel/test/plugins/spaces-home-control/activity_modes_test.dart#L471
[activityPartial]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/spaces-home-control/services/space-mode.service.spec.ts#L68
[activityService]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/spaces-home-control/services/space-mode.service.ts#L72
[activityValidation]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/spaces-home-control/components/space-activity-modes-section.spec.ts#L310
[actuation]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/contracts/thermostat-actuation.contract.ts#L6
[baseline]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts#L312
[bounds]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts#L830
[branchRuntime]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.ts#L214
[comfortAdmin]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/devices-virtual/components/virtual-thermostat-comfort.spec.ts#L87
[comfortDocs]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/docs/climate-architecture.md#L73
[comfortPanel]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/panel/test/modules/devices/presentation/virtual_thermostat_comfort_test.dart#L62
[comfortService]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.service.ts#L51
[coolingEligibility]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/thermostat-cooling-dependency.service.ts#L70
[coolingFault]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point.utils.spec.ts#L36
[coolingRecord]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/docs/work/virtual-thermostat/dew-point-cooling-validation.md#L40
[coolingRelease]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L4555
[cutoff]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point.utils.spec.ts#L27
[defaults]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts#L251
[dewAdmin]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/devices-virtual/components/virtual-dew-point-editor.spec.ts#L52
[dewFormula]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point.utils.ts#L2
[dewFresh]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point-runtime.integration.spec.ts#L171
[dewRepair]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point-runtime.integration.spec.ts#L187
[dewRole]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point-runtime.integration.spec.ts#L235
[dewRuntime]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point-runtime.service.ts#L52
[dewSkew]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point-runtime.integration.spec.ts#L216
[dispatch]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3209
[feedback]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/devices-virtual/components/virtual-light-group-detail.spec.ts#L213
[groupAuthor]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/docs/virtual-light-groups.md#L200
[groupCommand]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-light-group-command.service.ts#L45
[groupPanel]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/panel/test/modules/devices/presentation/actuator_group_flow_test.dart#L214
[groupPolicy]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-group-profile.ts#L31
[groupRoom]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/docs/virtual-light-groups.md#L280
[lateOn]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3439
[legacy]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/thermostat-installation.integration.spec.ts#L1306
[manual]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/thermostat-comfort-selection.integration.spec.ts#L3125
[migration]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts#L896
[off]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts#L612
[opposed]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3467
[overrideIdentity]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts#L294
[overrideRestart]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts#L367
[partial]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/devices-virtual/components/virtual-light-group-detail.spec.ts#L110
[priority]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-automation.integration.spec.ts#L864
[queuedGuard]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L831
[reconnect]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/devices-virtual/components/virtual-light-group-detail.spec.ts#L89
[repair]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/devices-virtual/components/virtual-light-group-detail.spec.ts#L299
[restart]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3515
[retirement]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts#L991
[rollback]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts#L338
[scene]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/panel/test/modules/scenes/group_scene_transport_test.dart#L94
[validation]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts#L263
[vectors]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/backend/src/plugins/devices-virtual/services/virtual-dew-point.utils.spec.ts#L11
[wizard]: https://github.com/FastyBird/smart-panel/blob/b0bfd429ae9f015911d1baad37583652b62d3995/apps/admin/src/plugins/devices-virtual/views/view-light-group-wizard.spec.ts#L68

[activityCombinedUnit]: ../apps/backend/src/plugins/spaces-home-control/services/space-mode.service.spec.ts
[activityCombinedHttp]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/test/space-climate-automation.e2e-spec.ts#L271
[activityConfiguredHttp]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/test/space-climate-automation.e2e-spec.ts#L1278
[activityPriorityHttp]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/test/space-climate-automation.e2e-spec.ts#L556
[activityScheduleHttp]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/test/space-climate-automation.e2e-spec.ts#L851
[activityMotionHttp]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/test/space-climate-automation.e2e-spec.ts#L727
[activityCurrentDefaults]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/src/plugins/spaces-home-control/activity/space-activity.defaults.spec.ts#L7
[activityCurrentClock]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/src/plugins/spaces-home-control/schedule/schedule-time.spec.ts#L15
[activityCurrentScheduler]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/src/plugins/spaces-home-control/services/space-mode-scheduler.integration.spec.ts#L126
[activityCurrentRuntime]: https://github.com/FastyBird/smart-panel/blob/1213149b8960a55536dfd6cd4687aaaea96a701d/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L779
