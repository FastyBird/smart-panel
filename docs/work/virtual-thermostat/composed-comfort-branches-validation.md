# Local comfort and mandatory-branch integration

## Scope and base

This local integration combines accepted VD3-10 backend foundation and VD3-7 comfort work on merged aggregate
PR #1465, base `4f4dd1f346fa5e9508c729f5b0d11a23a416f465`. Branch:
`feat/virtual-thermostat-comfort-branches`. No PR, push, issue update, release, hardware actuation or installation
qualification is part of this task. The original accepted implementation commits remain separate cherry-picks.

Source order: `7b65c9d23`, `cd5424134`, `90d9d0aa9`, `341506c3e`, `205a7b803`, `783ebdbaa`, `ae428d1b3`,
`4833588d1`. Only incremental migrations 39 and 40 are added. Covering-group and other pending branch work is excluded.
Generated backend/Admin specs, OpenAPI and Panel API were regenerated; ignored outputs were not force-added.

## Conflict resolutions

- `thermostat-config.dto.ts`: retain both optional `control_strategy` and optional atomic comfort replacement.
- `virtual-thermostat-config.integration.spec.ts`: retain both migrations and tests; the legacy singleton fixture now
  applies 39 then 40, preserving every existing config value, claim identity/state/generation and unresolved journal,
  while asserting a null legacy comfort value.
- `virtual-thermostat-runtime.service.ts`: effective comfort setpoints and explicit user OFF feed the existing shared
  controller decision. Heating/cooling evidence still includes every mandatory leaf; singleton `find()` evidence was
  not restored. Final-send comfort expiry/revision admission and per-leaf journals remain in place.
- `EPIC-VIRTUAL-DEVICE-EXTENSIONS.md`: preserve both local stages, reconcile already merged #1449/#1450, and keep
  #1454/#1455 and broader acceptance open pending composed review and outstanding work.
- All six Panel ARBs: retain aggregate diagnostics plus comfort keys. Seven generated localization Dart files were
  regenerated with Flutter 3.41.5, preserving both feature sets and generator formatting.

No other cherry-pick conflict occurred. Config, claims, models, transport and authorization changes that merged
cleanly were retained from both accepted implementations.

## New composed interaction coverage

The runtime suite adds three parallel-group scenarios: override expiry, explicit OFF and manual settings.
Independent review found that the initial sibling-OFF assertion could match startup reconciliation and that its
manual/OFF changes edited the config entity directly. Those assertions did not establish the claimed command-path
and post-mutation release coverage; the reviewed cases replace that weaker evidence.

Each scenario now waits on explicit transport promises proving that the first leaf entered its queued ON gate and
that the sibling actually sent ON and published ON feedback. Before mutation it asserts two durable ON journals
with the same decision revision, a `dispatching` queued journal, a settled `accepted` sibling ON journal without a release proof,
sibling ON feedback and its latest ON send, and no
ON send from the queued leaf. It records `sentTargets.length` immediately before mutation, then requires a **new**
sibling OFF in the slice after that boundary. Startup OFF cannot satisfy this assertion. The queued leaf must never
send ON, its exact prepared journal must finish cancelled, and the sibling's exact prepared journal must finish
confirmed with a nonempty qualified drainage proof. Both identities remain in the durable journal, with no pending ON diagnostics.

Manual and OFF mutations use the real `VirtualThermostatConfigService.command()` with persisted virtual local
properties, real `VirtualThermostatSettingEntity` registrations and matching contract fingerprints. The manual case
commands the registered heating setpoint from a selected comfort preset with no temporary override and verifies
that selection clears while the new setpoint persists. The OFF case commands registered `heating_enabled = false`
and verifies user OFF while preserving its active temporary override. The property value service and physical
transport remain controlled test doubles; this is the real configuration command path, not an end-to-end
`PropertyCommandService` test or hardware evidence.

Expiry advances the comfort clock to its exact deadline and uses a new evaluation for release proof bound to its
newly persisted configuration revision. Existing tests retain all-opposed fresh OFF/last-OFF timing, late ON,
partial capacity, missing members, restart and release ownership coverage.

## Initial integration validation (head `8c4f794a03df341f4a2076aec89d84e6499cf353`)

The expanded backend command is:

```sh
pnpm exec jest --runInBand --testPathPatterns='virtual-thermostat|thermostat-ownership|thermostat-actuation|thermostat-installation|thermostat-response.model|guarded-shelly|shelly-guard-rpc-session'
```

Commands run in this integration clone, with Jest `--runInBand`, Vitest `--maxWorkers=2` and Flutter
`--concurrency=2`. The source tree under test includes the semantic resolutions and new interaction cases above;
individual source-branch results are not counted as composed passes. The initial interaction result is superseded
by the strengthened review follow-up below; unchanged Admin/Panel and other earlier checks remain historical context.

- Expanded backend thermostat runtime/comfort/config/claims/installation/ownership/model and actual Shelly
  HTTP/RPC guard/session suites: 20 suites, 317 tests passed (`/tmp/vd-composed-backend-final.log`).
- Backend runtime/config interaction pass: 2 suites, 101 tests passed (`/tmp/vd-composed-interactions-final.log`).
- Admin comfort: 4 suites, 21 tests passed (`/tmp/vd-composed-admin.log`).
- Admin thermostat authoring: 4 suites, 13 tests passed (`/tmp/vd-composed-admin-authoring.log`).
- Panel comfort, detail/recovery, commands, input and socket widgets: 26 tests passed
  (`/tmp/vd-composed-panel-tests.log`).
- Backend `tsc --noEmit` and Admin `type-check` passed (`/tmp/vd-composed-backend-types.log`,
  `/tmp/vd-composed-admin-types.log`).
- ESLint and Prettier on every changed backend/Admin TypeScript/Vue source passed
  (`/tmp/vd-composed-{backend,admin}-{eslint,prettier}-final.log`).
- API conventions and Spectral with `--fail-severity warn` passed
  (`/tmp/vd-composed-api-conventions.log`, `/tmp/vd-composed-spectral.log`).
- Scoped Dart analysis of thermostat detail/comfort/commands/inputs and comfort/detail/socket tests passed
  (`/tmp/vd-composed-dart-analyze.log`).
- `pnpm run generate:spec`, `pnpm run generate:openapi`, compatible Flutter `melos run rebuild-api --no-select`
  and `flutter gen-l10n` passed (`/tmp/vd-composed-spec.log`, `/tmp/vd-composed-openapi.log`,
  `/tmp/vd-composed-panel-api.log`, `/tmp/vd-composed-locales.log`).

The first broad backend run exposed the legacy fixture's missing migration 39; it was corrected as described above.
A first new expiry assertion required a subsequent current-revision evaluation for qualified drainage, matching the
existing conservative proof fence. Neither failure was hidden or counted as a pass.

## Independent-review test correction

This follow-up changes only `virtual-thermostat-runtime.service.spec.ts` and this evidence record. No production,
migration, generated-contract, Admin or Panel code changes were needed; no production integration fault was found.
The three strengthened interaction cases passed (`/tmp/vd-composed-review-interactions-final.log`), and the focused
runtime/config/comfort suites passed **3 suites / 117 tests** (`/tmp/vd-composed-review-focused.log`). Scoped test
ESLint, Prettier and backend `tsc --noEmit` passed (`/tmp/vd-composed-review-lint.log`,
`/tmp/vd-composed-review-format-check.log`, `/tmp/vd-composed-review-types.log`). Unchanged Admin/Panel checks were
not rerun for this correction. The parent handoff records the final commit and committed-head focused log.

```sh
pnpm exec jest --runInBand src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts --testNamePattern='fences a queued parallel leaf'
pnpm exec jest --runInBand src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts src/plugins/devices-virtual/services/virtual-thermostat-comfort.integration.spec.ts
pnpm exec eslint src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts
pnpm exec prettier src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts --check
pnpm exec tsc --noEmit
```

## Remaining acceptance boundary

Parent independent composed review remains required. Multi-member Admin/Panel authoring and diagnostics are not
implemented by this integration: current single-member authoring and all existing comfort controls/locales remain.
Multi-Shelly floor-protected groups remain ineligible pending a separately reviewed per-member protective design;
no qualification bypass, fake flag, native-unit activation or installed evidence has been introduced. Native-unit
support remains a typed seam whose activation is refused. Existing installation artifact hashes and legacy identities
are preserved. Hardware commissioning and alpha publication remain separate authorized work.

The later [member client integration](member-client-validation.md) supersedes the client-work backlog above; its
local code and acceptance are tracked separately and do not retroactively change this historical validation result.
