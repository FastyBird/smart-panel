# VD3-10 backend foundation — local validation

Issue: [FastyBird/smart-panel #1454](https://github.com/FastyBird/smart-panel/issues/1454).
Base: `ad5cf678d47eeae4f575c652e03e3c6f5f1998ba` (merged PR #1464).
Worktree: `/Users/akadlec/.t3/worktrees/smart-panel/t3-016d362e`.
Branch: `t3/virtual-device-branches`.

The generated worktree was clean before fetching `origin main` and resetting this branch to the specified base.
No other checkout was changed. No push, PR, external comment, release, script deployment or hardware action was performed.
The local implementation is ready for the parent's independent ownership/concurrency/protection review; this record
is software evidence and does not qualify installed equipment or complete the whole extension milestone.

## Implementation and review boundaries

- `contracts/thermostat-actuation.contract.ts` defines versioned provider-neutral transport, observation, qualification,
  OFF/drain proof and mutually exclusive guarded/native strategy types. The existing Shelly profile is explicitly
  `shelly-ng.guarded-switch`, version 1; legacy internal evidence is normalized only to that actual implemented profile.
  Unsupported provider/profile versions cannot borrow a protective claim or registration-based qualification.
- Migration `1000000000040` is the only new migration. It alters existing tables in place, preserves the physical unique
  reservation index, removes singleton role uniqueness, and adds profile/version and `guarded_branches` strategy defaults.
  Missing, releasing and suspended reservations count toward the eight-total-member bound. Downgrade refuses active
  parallel reservations instead of deleting them. Initial migrations were not edited.
- Group identity is the stable `(controllerId, role)` tuple; it does not replace a physical claim UUID. Existing
  `(controllerId, decisionRevision)` journal scope is the shared decision identity, with a separate durable command UUID
  for each physical send. Existing schema-v1 flat `actuators` arrays remain compatible; repeated roles form a group.
- Branch evaluation uses every mandatory member. Internal demand hysteresis recognizes a partially running branch;
  public activity requires unanimous member observations. Per-member minimum-OFF admission still applies. Accepted but
  unobserved ON is incomplete capacity, and partial/late ON remains unresolved until that leaf's qualified drainage.
- Parent review should examine the detached-I/O boundary: in-flight outcomes override snapshots loaded before the SQL
  lock, and outcomes publish to the current context before and after persistence. Failed members fence all contexts by
  claim/revision until qualified OFF/drain settlement. Parallel settlement feedback does not revoke sibling sends;
  external settings, input, graph, mapping and qualification changes retain their existing revocation fences.
- Opposed output admission requires every other-branch member fresh OFF and drained. The branch OFF clock uses the
  last qualified member OFF. Release settlement still checks the full unresolved journal under the exclusive lock,
  exact scope, installed qualification identity, live source lease and admitted OFF sample.
- The real Shelly guarded queue, session, HTTP/RPC retry, local bounds and installation proof implementation is retained.
  Same-mode siblings do not require an opposed-output attestation. Every member still needs the actual installed local
  protective profile; the existing loader requires the floor input to be local to each physical Shelly. A shared virtual
  floor input cannot qualify extra hardware. With one controller floor binding, the current installation workflow
  cannot qualify a multi-Shelly floor-protected group using that binding. Removing this limitation requires a reviewed
  per-member protective-input/profile design; these groups remain ineligible. No protection flags or substitute
  transport were invented.

## Executed validation

Commands were run from the worktree root unless stated otherwise. Logs below are local files under `/tmp`, not CI
or hardware records. Generated outputs remain ignored and were not edited manually or force-added.

```sh
pnpm install --frozen-lockfile --prefer-offline
pnpm --filter @fastybird/smart-panel-backend run generate:spec
pnpm --filter @fastybird/smart-panel-extension-sdk run build
pnpm run generate:openapi
pnpm --filter @fastybird/smart-panel-backend run lint:api
pnpm --filter @fastybird/smart-panel-backend run lint:openapi:spec
PATH="/Users/akadlec/Development/Flutter/v3.41.5/bin:$PATH" flutter pub get
PATH="/Users/akadlec/Development/Flutter/v3.41.5/bin:$PATH" melos run rebuild-api --no-select
```

All passed. Backend device/channel specs, OpenAPI, Admin types and Panel API/build-runner artifacts were regenerated.
Strict Spectral lint reports no warnings. The default Flutter 3.47.1 failed the repository's `<3.41.6` constraint;
the already-installed compatible 3.41.5 completed generation without changing constraints or dependencies.
Logs: `/tmp/vd1454-spec.log`, `/tmp/vd1454-sdk.log`, `/tmp/vd1454-openapi-generation.log`,
`/tmp/vd1454-api-conventions.log`, `/tmp/vd1454-openapi-strict.log`, `/tmp/vd1454-dart-pub-compatible.log`,
`/tmp/vd1454-panel-generation.log`.

```sh
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand \
  src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts \
  src/plugins/devices-virtual/services/virtual-thermostat-branch.utils.spec.ts
```

Passed: **2 suites, 67 tests**, log `/tmp/vd1454-runtime-final-green.log`. This includes same-mode groups, mandatory
missing/offline members, accepted/unobserved and partial late ON, shared journal decisions, opposed all-OFF/drain,
last-OFF boundary timing, restart drainage per leaf, stale-generation final sends and context replacement during a
member refusal, plus the existing runtime/ownership/reconciliation/history tests. An earlier contended run had 64
passes and three 30-second timeouts (one in SQLite setup); the rerun above passed after concurrent generation ended.

```sh
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand \
  src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts \
  -t 'bounds mandatory|upgrades actual|sibling ownership|migration matches'
```

Passed: **4 selected tests**, log `/tmp/vd1454-upgrade-exact.log`. Upgrade coverage recreates the actual old schema with
migrations 31, 32 and 34, inserts preexisting configuration, claim generation/release state, unknown ON journal and
branch release evidence, then applies 40 and compares retained records. Configuration tests cover eight total mixed
members, ninth-member rejection in API/SQLite, duplicate same/opposed physical members, stable IDs, exclusive writers
and sibling-preserving disable/delete/remap/recovery.

The broader regression command also included these suites, all of which passed:

```text
src/plugins/devices-virtual/services/thermostat-installation.integration.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-authoring.integration.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-transport.service.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-claims.service.spec.ts
src/plugins/devices-virtual/subscribers/virtual-thermostat-ownership.subscriber.spec.ts
src/plugins/devices-virtual/models/thermostat-response.model.spec.ts
src/plugins/devices-shelly-ng/services/guarded-shelly-http.spec.ts
src/plugins/devices-shelly-ng/services/guarded-shelly-rpc.spec.ts
```

Command: `pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand` followed by the runtime suite and the nine
paths above. Log: `/tmp/vd1454-focused-final.log`. That earlier combined command had two failures in the new runtime
phase-timing assertions; explicit phase evaluation corrected them, and the complete runtime rerun above passed.
The nine supporting suites passed in that combined run. Stronger final configuration cases passed separately above.

## Required before alpha

Admin needs multi-member creation/edit/repair while retaining missing reservations and enforcing the combined limit.
Admin/Panel must render every member's readiness/fault, uncertain ON, release retry/proof, recovery generation and
retained release evidence. Existing clients selecting only the first matching branch role must be updated; generated
models alone do not deliver that UI. `released_actuators` exposes historical member evidence independently of active
capacity. The existing claim recovery audit endpoint remains available.

HA/Zigbee native-unit adapters are separate work. This foundation reserves exactly-one-unit strategy types, rejects
native activation, and grants no protective qualification through registration, service ACK or requested mode.
The parent must independently review and compose this backend work with the client follow-up before publishing an
alpha. Equipment qualification and physical tests remain a separate post-publication activity.

## Final source checks

```sh
pnpm --filter @fastybird/smart-panel-backend run type-check
pnpm --filter @fastybird/smart-panel-backend exec eslint --no-warn-ignored \
  src/plugins/devices-virtual/contracts/thermostat-actuation.contract.ts \
  src/plugins/devices-virtual/services/virtual-thermostat-branch.utils.ts \
  src/plugins/devices-virtual/services/virtual-thermostat-branch.utils.spec.ts \
  $(git diff --name-only -- '*.ts' | sed 's|apps/backend/||')
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand \
  src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts \
  -t 'mandatory member is|mandatory refusal|unobserved parallel|publishes detached binding'
```

All passed on the final source. The targeted runtime check passed **5 tests** after the final per-member fault
presentation change. Logs: `/tmp/vd1454-types-final.log`, `/tmp/vd1454-lint-final-pass.log`,
`/tmp/vd1454-diagnostics-final.log`. ESLint excludes migration files by repository configuration; migration 40 is
formatted with Prettier and exercised by the actual SQLite upgrade tests. Changed/new TypeScript files also pass the
explicit Prettier check recorded in `/tmp/vd1454-prettier-final.log`. `git diff --check` passes.
