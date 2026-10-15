# Local mandatory-member clients and authoring context

This local batch follows independently accepted composed comfort/foundation head
`5cabef74eb9f914d6970e3cfd526df5a8c4f4608` on `feat/virtual-thermostat-comfort-branches`.
It incorporates per-member source `23a00e3f3466643e264ca7a634b97ecf9ef1f98c` and safety correction
`6ef96756a80a24bfdbb4afafb18e4487863198fd`. These individual backend revisions are not claimed accepted:
parent-directed safety review/follow-up remains open until its later correction and composed acceptance.
Only incremental migrations 39, 40 and 41 exist in this batch. No hardware was contacted or operated.

## Integration resolutions

Source 23a conflicted in three files. Runtime policy retains effective comfort setpoints/user OFF and all-member
branch evidence, disables only the absent legacy global-floor policy when explicit member guards provide the common
floor policy, and independently evaluates every member guard. Config integration retains migration 39 before 40/41
and excludes only the newly added comfort/display fields when proving legacy column values unchanged. Runtime tests
retain registered-command value mocks alongside the new source-continuity guard.
Correction 6ef conflicted only on runtime-test imports: both the comfort/config service and the config event constant
are retained. No safety path was reimplemented independently.

## Admin and source-owned authoring API

The editor keeps one room-demand/policy section and heating/cooling arrays capped at eight total nonreleased
members, including missing/releasing/suspended ownership. Member drafts preserve claim IDs, original property IDs,
protective source IDs, recovery generations and proof. Ordinary removal exists only for unpersisted entries. Existing
controller release and claim recovery routes remain the explicit fenced ownership paths. Released evidence is shown
separately. Legacy global-floor removal requires a deliberate acknowledgement plus source removal; the global source
otherwise remains a real additional guard. Display-floor selection references an existing member and does not alter
its protective set. No native-unit activation option was added.

Read-only `/producers/thermostat-member-authoring/actuators/:property` and `/claims/:claim` return qualified local
Celsius choices and public catalog/component/peripheral/calibration snapshots. Selection first narrows to the actual
Shelly lineage, then applies the same backend protection resolver, with a bounded local catalog. A connected delegate
provides only cached public switch configuration and firmware; this seam makes no RPC. Unknown or credential-bearing
configuration shapes and missing current metadata do not produce a staging-ready snapshot. Metadata never produces
a temperature sample or hardware qualification.

Member setup review takes actual operator ceiling, timing, endpoint/script slot, comfort bounds and evidence
references. Derived metadata is read-only. Empty evidence rows make no assertions. Staging alone never calls verify,
deploys scripts or writes a physical relay. New UI requests include optional config/claim/recovery-generation CAS
fences checked under the existing structural lock; old singleton setup payloads remain compatible. An absent or
changed context blocks submission. Safety limits, local bindings and global-guard removal retain backend restaging
and runtime admission requirements.

Member diagnostics use qualified individual runtime observations, age/expiry, cutoff/latch, observed activity,
pending ON/release, retry timing, current proof and retained evidence. Failed reads, disconnects and expired samples
withhold readings rather than promoting cached values. Config/source/profile changes and disposal fence delayed
responses. The six existing locales retain comfort translations and gain translated member controls.

Panel ordinary intents and all-member diagnostics are implemented by the separate Panel worker; that worker owns its
handwritten code/localizations/tests and its result will be integrated separately. This record does not claim those
changes are already present.

## Verified source checkpoint

The Backend/Admin checkpoint is `ebc33cf32a39627c1f62df3cfc489097bbe4f6c0`, based on
`0cb553e536ee8a2aedde93e714741d440dde5242`. This documentation-only follow-up records that exact tested source.
The checkout was clean after the source commit. No Panel handwritten files, localization files or generated
clients were committed; no PR or push was performed.

## Validation

Authoring/context, principal and installation checks passed 3 suites / 62 tests after the local same-Shelly catalog
query and staging revision fences were complete (`/tmp/vd-members-context-stage-final.log`). Separate earlier delegate
checks proved cached-switch mutation/disconnect refusal without RPC. The final source-owned OpenAPI and Admin type
generation passed (`/tmp/vd-members-api-generation-final2.log`); generated files remain ignored.
The thermostat Admin set passed **11 files / 49 tests** with `pnpm exec vitest run thermostat --maxWorkers=2`
(`/tmp/vd-members-admin-thermostat-final.log`). It exercises real two-member create/edit controls, missing retained
members at the eight-member cap, explicit fenced recovery, versioned staging from read-only metadata, source
capability refusal, revision conflict without draft loss, original protective expiry, resource generation/disposal
races, legacy singleton/request behavior and all six locales. API conventions and strict Spectral passed
(`/tmp/vd-members-api-conventions.log`, `/tmp/vd-members-spectral.log`). Final Admin type checking passed (`/tmp/vd-members-admin-types-final3.log`). Backend type checking passed (`/tmp/vd-members-backend-types-final.log`), as did scoped backend/Admin lint
(`/tmp/vd-members-backend-lint-final3.log`, `/tmp/vd-members-admin-lint-final3.log`,
`/tmp/vd-members-admin-lint-checkpoint.log`) and scoped formatting. These checks cover the source checkpoint above, not the pending final safety/Panel/diagnostics composition. Generated outputs remain ignored and are never force-added.

Current public runtime does not yet carry a separately qualified relay sample expiry or qualification diagnostic.
The proposed additive fields await parent review and the original safety owner’s handback; clients must show unknown
where current proof is absent. This provisional record is not final composed acceptance.

No issue is marked merged or alpha-ready by this local work. Parent independent review, composed software acceptance,
published alpha and later separately authorized installed commissioning remain distinct gates.
