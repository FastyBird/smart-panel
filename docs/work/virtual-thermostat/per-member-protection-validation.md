# Per-member floor protection software acceptance

This change follows backend foundation `7b65c9d23` and uses only migration `1000000000041`. Migration 40 and the
initial schema remain unchanged. No comfort-branch code or hand-written client changes are included.

## Review boundaries

- A claim-keyed retained binding is distinct from the controller's ambient measurement and optional global floor.
- An absent row keeps the legacy singleton resolver/fingerprint/artifact path. Every parallel heating member requires
  an explicit binding; omission/null/display selection cannot remove existing protection.
- The full qualified catalog snapshot is nullable on legacy Shelly source rows. New format staging requires current
  complete reviewed public component/peripheral metadata; unknown or credential-bearing shapes retain no full snapshot
  and cannot stage the new format. This column is never sample freshness or independent protection evidence.
- The version-two artifact extends the exact packaged legacy script with explicit domain and stale-gap latch checks.
  Legacy script bytes are unchanged. No guarded ON/fence transport protocol or attestation kind changes.
- Each member's effective artifact cutoff is the minimum of common requested limit and reviewed installed ceiling.
  Native source format/converter output domain must contain cutoff and strict recovery. The same domain is embedded
  locally. Converted sources retain exact coefficients, input/output ranges, peripheral/configuration and MAC.
- Runtime latches are process-local authority. Persisted per-claim latch values are diagnostics only. Source guard
  continuity and synchronous invalid/producer intervals rearm latches; only new qualified below-recovery samples clear.
- Configuration/installation/recovery entry revokes captured ON admission before awaits. Graph/config/claim revisions,
  retained source contracts, producer revisions, qualification generations and installation leases gate final dispatch.
- Reconciliation still drains each leaf independently, including unsafe/missing protection inputs, and retains all
  unresolved commands/physical reservations. Parallel outputs remain mandatory and bounded to eight total members.

## Client completion before alpha

Coordinated Admin/Panel work must provide one room-demand section and member cards with relay identity, compatible
local-source picker, protection reading/age/quality, cutoff/latch/blockers, installed-profile readiness, pending ON and
release/recovery evidence. Show the common requested floor policy once. Installation review exposes the per-member
ceiling and derived source/calibration snapshot rather than asking users to retype it. Display selection references an
existing member. Retained missing/releasing claims remain visible and ordinary removal cannot erase their ownership.
Existing global floor protection needs an explicit, fenced removal action when adopting member protection.

Physical commissioning and electrical/calibration qualification remain after a published alpha. No test described here
certifies equipment or enables an unsupported provider/native-unit protective profile. No hardware actions were taken.

## Verification

All changes are local on `t3/virtual-device-branches` in
`/Users/akadlec/.t3/worktrees/smart-panel/t3-016d362e`, after exact foundation
`7b65c9d23ac992c3b9e2bd01f8513ce246358b82` (whose parent is
`ad5cf678d47eeae4f575c652e03e3c6f5f1998ba`). No push, PR, external comment, deployment or hardware action occurred.

The focused sweep used `pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand` with these exact paths:

```text
src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts
src/plugins/devices-virtual/services/thermostat-installation.integration.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts
src/plugins/devices-shelly-ng/services/shelly-guard-candidate.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-claims.service.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-transport.service.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-authoring.integration.spec.ts
src/plugins/devices-virtual/subscribers/virtual-thermostat-ownership.subscriber.spec.ts
src/plugins/devices-virtual/controllers/thermostat-installation.controller.spec.ts
src/plugins/devices-virtual/models/thermostat-response.model.spec.ts
src/plugins/devices-virtual/models/thermostat-installation-response.model.spec.ts
src/plugins/devices-shelly-ng/services/shelly-sample-sources.service.spec.ts
src/plugins/devices-shelly-ng/services/qualified-adoption.spec.ts
src/plugins/devices-shelly-ng/services/shelly-guard-rpc-session.spec.ts
src/plugins/devices-shelly-ng/services/guarded-shelly-http.spec.ts
src/plugins/devices-shelly-ng/services/guarded-shelly-rpc.spec.ts
src/modules/devices/services/property-value.service.spec.ts
src/modules/devices/services/property-qualified-state.integration.spec.ts
```

That sweep recorded 440 passed tests and two fixture failures: synchronized column ordering versus the additive
migration, and a test report timestamp advanced without its fake receiver clock. Both fixtures were corrected.
The final targeted rerun used the same command with these four paths and passed **172 tests / four suites**:

```text
src/plugins/devices-shelly-ng/services/shelly-sample-sources.service.spec.ts
src/modules/devices/services/property-qualified-state.integration.spec.ts
src/plugins/devices-virtual/services/thermostat-installation.integration.spec.ts
src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts
```

The rerun also includes the additional effective-cutoff/domain case. No failed test remains unresolved. Relevant
coverage includes actual SQLite old-schema upgrades, retained hashes/activation/generations/journals, two local Shelly
sources including a converter, exact latch boundaries, restart and observation gaps, wrong-device/peripheral/domain/
calibration rejection, source deletion, inspection and queued-send races, whole-branch release, eight-versus-nine
members, and unchanged qualified Shelly/ownership/opposed-output/installation regressions.

Final checks and generation:

```sh
# Explicit changed TypeScript file list; migration formatted and verified by SQLite integration tests.
pnpm --filter @fastybird/smart-panel-backend exec eslint --max-warnings 0 <changed non-migration TypeScript files>
pnpm --filter @fastybird/smart-panel-backend exec prettier --write <changed TypeScript files>
pnpm --filter @fastybird/smart-panel-backend run type-check
pnpm --filter @fastybird/smart-panel-backend run lint:api
pnpm --filter @fastybird/smart-panel-extension-sdk run build
pnpm run generate:spec
pnpm run generate:openapi
pnpm --filter @fastybird/smart-panel-backend run lint:openapi:spec
PATH="/Users/akadlec/Development/Flutter/v3.41.5/bin:$PATH" flutter pub get
PATH="/Users/akadlec/Development/Flutter/v3.41.5/bin:$PATH" melos run rebuild-api --no-select
PATH="/Users/akadlec/Development/Flutter/v3.41.5/bin:$PATH" melos run rebuild-spec --no-select
git diff --check
```

Types, scoped ESLint (zero warnings), formatting, API conventions, strict Spectral (`--fail-severity warn`), SDK build,
Backend/Admin specs/OpenAPI and Flutter 3.41.5 Panel API/spec generation passed. Generated files remain ignored and
were neither manually edited nor force-added. No hand-written Admin/Panel/comfort files changed.

Local logs (ignored, retained in this worktree):

- `.vd1454-protection-final-tests.log`: full focused sweep and the two corrected fixture failures.
- `.vd1454-protection-final-integration.log`: final green four-suite / 172-test rerun.
- `.vd1454-protection-races.log`: green runtime/configuration rerun (98 tests) before the additional rapid-fault case.
- `.vd1454-protection-lint.log`, `.vd1454-protection-format.log`, `.vd1454-protection-types.log`.
- `.vd1454-protection-api.log`, `.vd1454-protection-spectral.log`.
- `.vd1454-protection-sdk.log`, `.vd1454-protection-spec.log`, `.vd1454-protection-generation.log`.
- `.vd1454-protection-flutter-pub.log`, `.vd1454-protection-panel-generation.log`, `.vd1454-protection-panel-spec.log`.

## Changed files

33 source/test/documentation files, including the single new migration 41:

- `apps/backend/src/migrations/1000000000041-AddThermostatMemberProtection.ts`
- `apps/backend/src/modules/devices/services/property-qualified-state.integration.spec.ts`
- `apps/backend/src/modules/devices/services/property-value.service.ts`
- `apps/backend/src/plugins/devices-shelly-ng/contracts/member-guard-script-source.ts`
- `apps/backend/src/plugins/devices-shelly-ng/contracts/native-temperature.contract.ts`
- `apps/backend/src/plugins/devices-shelly-ng/entities/shelly-sample-source.entity.ts`
- `apps/backend/src/plugins/devices-shelly-ng/services/shelly-guard-candidate.spec.ts`
- `apps/backend/src/plugins/devices-shelly-ng/services/shelly-sample-sources.service.spec.ts`
- `apps/backend/src/plugins/devices-shelly-ng/services/shelly-sample-sources.service.ts`
- `apps/backend/src/plugins/devices-virtual/controllers/thermostat-installation.controller.ts`
- `apps/backend/src/plugins/devices-virtual/devices-virtual.plugin.ts`
- `apps/backend/src/plugins/devices-virtual/dto/thermostat-config.dto.ts`
- `apps/backend/src/plugins/devices-virtual/dto/thermostat-installation.dto.ts`
- `apps/backend/src/plugins/devices-virtual/entities/thermostat-member-protection.entity.ts`
- `apps/backend/src/plugins/devices-virtual/entities/virtual-thermostat-runtime.entity.ts`
- `apps/backend/src/plugins/devices-virtual/entities/virtual-thermostat.entity.ts`
- `apps/backend/src/plugins/devices-virtual/models/thermostat-installation-response.model.ts`
- `apps/backend/src/plugins/devices-virtual/models/thermostat-response.model.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-installation-artifact.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-installation-bindings.service.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-installation.integration.spec.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-installation.service.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-installation.types.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-member-protection.service.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-protection-source.utils.ts`
- `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-config.integration.spec.ts`
- `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-config.service.ts`
- `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts`
- `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.ts`
- `apps/backend/src/plugins/devices-virtual/subscribers/virtual-thermostat-ownership.subscriber.ts`
- `apps/backend/test/support/thermostat-protection-fixture.ts`
- `docs/climate-architecture.md`
- `docs/work/virtual-thermostat/per-member-protection-validation.md`


## Safety-review follow-up after `23a00e3`

The three confirmed findings are fixed locally in the same 016 worktree:

- A process-local trip barrier survives an immediate below-recovery report. Only the runtime can acknowledge it,
  after every nonreleased heating leaf has a current, post-barrier qualified OFF/drain proof, no unresolved ON and
  no in-flight command. The acknowledgement re-arms the sample boundary; a new strictly below-recovery report is
  required afterward. Scheduling an evaluation never acknowledges release. Startup, reconnect, source invalidation,
  stale gaps and binding/configuration changes conservatively establish the barrier again. Existing final-send
  epoch/graph/configuration/claim/qualification checks still fence queued ON; unsafe OFF remains available.
- Both backend bounds and the generated version-two local script require recovery strictly inside the lower domain
  boundary. Equality is rejected because the admitted sample domain otherwise cannot supply a recovering value.
  The version-two source hash intentionally changes and requires reviewed restaging/explicit activation for an old
  version-two artifact. Legacy source, artifact hashes and upgrade behavior remain unchanged.
- Legacy fallback refuses any controller with more than one nonreleased heating claim, counting missing, releasing
  and suspended claims. Stage, inspection, explicit verification and background renewal fail closed before machine
  inspection. True singleton and existing cooling/opposed legacy regression behavior remains intact.

Fresh focused validation (all commands run from this worktree root, with no hardware or server actions):

```sh
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand virtual-thermostat-runtime.service.spec.ts thermostat-installation.integration.spec.ts shelly-guard-candidate.spec.ts
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand virtual-thermostat-config.integration.spec.ts virtual-thermostat-claims.service.spec.ts virtual-thermostat-transport.service.spec.ts virtual-thermostat-authoring.integration.spec.ts virtual-thermostat-ownership.subscriber.spec.ts shelly-sample-sources.service.spec.ts qualified-adoption.spec.ts property-qualified-state.integration.spec.ts shelly-guard-rpc-session.spec.ts guarded-shelly-http.spec.ts guarded-shelly-rpc.spec.ts
# Final installation rerun includes an additional explicit no-machine-inspection assertion for background renewal.
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand thermostat-installation.integration.spec.ts
```

The first run passed 157 tests / three suites (`.vd1454-review-focused.log`); the second passed 209 tests / eleven
suites (`.vd1454-review-regressions.log`). New runtime cases energize a sibling while another ON is queued, deliver
trip then recovery in one synchronous event turn, and verify a new sibling OFF, refusal of the queued ON, retained
journals, one-leaf proof insufficiency, no cached recovery and eventual safe resumption after all-leaf proof plus a
new recovery report. Source-gap and reconfiguration variants and restart reconciliation are covered. Bounds tests
exercise exact equality rejection and a just-inside reachable boundary in both backend staging and generated local
artifact execution. SQLite tests preserve the legacy upgrade/artifact/activation/UUID/generation/journal assertions.

No API DTO/model/decorator/schema or generated client contract changes in this follow-up; unchanged Admin/Panel
and client generation are not rerun. Coordinated authoring/diagnostics UI completion described above remains needed
before alpha; physical commissioning remains after published alpha. No new migration is added, and migration 41,
migration 40 and the canonical legacy script bytes are unchanged. Fresh independent safety review remains required.

The final installation rerun passed **54 tests / one suite** (`.vd1454-review-installation-final.log`). All 14 focused
suites passed: 366 distinct tests, plus the final 54-test installation rerun after adding the renewal assertion.
No failed test remains unresolved.

Final static checks passed:

```sh
# Run from apps/backend with the eight changed TypeScript paths listed below, relative to apps/backend.
pnpm exec prettier --check <changed TypeScript files>
pnpm exec eslint --max-warnings 0 <changed TypeScript files>
# Run from worktree root.
pnpm --filter @fastybird/smart-panel-backend run type-check
pnpm --filter @fastybird/smart-panel-backend run lint:api
pnpm --filter @fastybird/smart-panel-backend run lint:openapi:spec
git diff --exit-code 23a00e3 -- apps/backend/src/migrations apps/backend/src/plugins/devices-shelly-ng/contracts/guard-script-source.ts docs/work/virtual-thermostat/shelly-guard-candidate.js
git diff --check
```

Logs: `.vd1454-review-format.log`, `.vd1454-review-lint.log` (zero warnings), `.vd1454-review-types.log`,
`.vd1454-review-api.log`, `.vd1454-review-spectral.log` (strict warning threshold). Prettier initially formatted the
changed TypeScript files, then its final check passed. All logs are ignored local files retained in this worktree.

Nine files changed relative to `23a00e3f3466643e264ca7a634b97ecf9ef1f98c`:

- `apps/backend/src/plugins/devices-shelly-ng/contracts/member-guard-script-source.ts`
- `apps/backend/src/plugins/devices-shelly-ng/services/shelly-guard-candidate.spec.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-installation-bindings.service.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-installation.integration.spec.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-member-protection.service.ts`
- `apps/backend/src/plugins/devices-virtual/services/thermostat-protection-source.utils.ts`
- `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts`
- `apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.ts`
- `docs/work/virtual-thermostat/per-member-protection-validation.md`
