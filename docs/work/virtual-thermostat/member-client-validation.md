# Local mandatory-member clients and authoring context

This local batch follows independently accepted composed comfort/foundation head
`5cabef74eb9f914d6970e3cfd526df5a8c4f4608` on `feat/virtual-thermostat-comfort-branches`.
It incorporates per-member source `23a00e3f3466643e264ca7a634b97ecf9ef1f98c` and safety correction
`6ef96756a80a24bfdbb4afafb18e4487863198fd`. The initial source required safety corrections; the later original-owner correction
`46504173bdcc8bdba8112421c53c24d4d33c039b` passed independent local review and is integrated as
`075baf6de394549a56a44b01116dd7c2353a78bc`. This is local software acceptance, without publication or commissioning.
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

The independently accepted Panel-only stack is now integrated: `81d47453` → `85f3b9214`, `94fa3e31` →
`3f0957e80`, `51fb6ddd` → `17717bf99`, and `3774fe49` → `896c10e6f`. These changes retain ordinary comfort
intents, all-member diagnostics, protective expiry/gap withholding, and config/runtime claim watermarks. The
separate Panel worker still owns the small follow-up for the new public activity/qualification fields; no extra
Panel handwritten changes were made in the integration clone.

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

At the initial Backend/Admin checkpoint, separate physical relay expiry and guard qualification fields were still
pending. The later independently accepted runtime checkpoint `879a27be5efc4fac20e68c0f45fee70c8052873b` now
provides them; its composed validation is recorded below. The initial checkpoint evidence remains historical.

No issue is marked merged or alpha-ready by this local work. Parent independent review, composed software acceptance,
published alpha and later separately authorized installed commissioning remain distinct gates.

## Independent checkpoint review corrections

The independent review of `d7a815e1f3b6c23912c1226f52c8461713b6b6eb` requested two client corrections.
Release responses now preserve policy/source intent edited before or during the request, while replacing retained
member identities/revisions/states from the authoritative response. Fully released claims leave the editable member
set and cannot be resurrected from a dirty draft. Successful release invalidates the preview and runtime context.
The real form tests defer the response and cover releasing, fully released and refused outcomes without sleeps.

Member staging now requires the **selected** protective candidate's actual installation snapshot. The specific
`selected_protective_source_installation_snapshot_missing` blocker disables Stage and its request builder, with no
HTTP mutation. An unrelated incomplete candidate does not block a complete selected native/converter source, and
legacy setup payloads remain unchanged. Reloading current complete metadata clears the blocker. The real SQLite
catalog test retains historical null metadata rather than fabricating a positive snapshot.

Focused correction validation: 3 Admin files / 23 tests passed with two workers
(`/tmp/vd-members-review-admin-tests-final.log`); the backend authoring-context suite passed 3 tests
(`/tmp/vd-members-review-backend-context.log`). Backend types, Admin types and scoped backend/Admin lint/format
passed in the correction run (`/tmp/vd-members-review-backend-types.log`, `/tmp/vd-members-review-admin-types.log`,
`/tmp/vd-members-review-backend-lint.log`, `/tmp/vd-members-review-admin-lint.log`), and the final incremental Admin type/lint checks passed after the last refinement
(`/tmp/vd-members-review-admin-types-final.log`, `/tmp/vd-members-review-admin-lint-final.log`). No API contract changed, so generation was not repeated.
These corrections passed fresh independent review at `4052a42a`; they do not establish final composed acceptance.

## Current composed runtime and Admin field wiring

Accepted safety correction `46504173` had one integration conflict, in runtime-test setup: retain the real comfort
and registered-config service initialization while adopting the optional real transport seam. Production runtime
and installation/CAS paths merged without conflict. No safety barrier was reimplemented independently.

Runtime source `879a27be5efc4fac20e68c0f45fee70c8052873b` adds nullable `qualification_ready`,
`activity_sampled_at` and `activity_expires_at`. These are detached read-only diagnostics at both publication and
cached reads. The activity and both timestamps come from the same current good physical boolean sample, with its
original sample time and existing 30-second feedback window. Current registry/graph/runtime epoch, target identity
and source lease checks withdraw unproven fields. Newer dispatched pending/in-flight ON supersedes older feedback.
Journal/ACK/history/metadata never renew observation evidence. Guard qualification is explicitly distinct from full
admission, installation readiness and physical certification; sanitized contexts cannot retain a positive value.
Existing policy, transport, journals, release proof and virtual STATUS publication retain their original paths.

The first expanded backend run exposed four fixture failures (`/tmp/vd-members-composed-backend.log`). The three
comfort/queued-leaf cases needed the new all-member post-drain protective reports after a comfort revision changes
the floor basis. Their old Date.now-only freeze also disagreed with physical samples created by new Date. Fixtures
now use coherent receiver packet time, prove current all-member OFF/drain, then incorporate later protective reports
before ON. The tests still prove an actually ON sibling and queued relay before mutation, a NEW sibling OFF after
the send boundary, no queued relay ON, both exact journals retained/drained, real registered setting commands, and
actual comfort expiry settlement. The lower-demand override test now drains the preceding configure notification
before the override phase. No production barrier was relaxed. The targeted failures and read-projection contracts
passed 2 suites / 18 tests (`/tmp/vd-members-composed-regressions.log`).

At exact runtime source `879a27be5efc4fac20e68c0f45fee70c8052873b`, the final composed command passed
**26 suites / 508 tests** (`/tmp/vd-members-composed-backend-final.log`):

```sh
pnpm exec jest --runInBand --testPathPatterns='virtual-thermostat|thermostat-ownership|thermostat-actuation|thermostat-installation|thermostat-response.model|thermostat-authoring-context|guarded-shelly|shelly-guard|shelly-sample-sources|qualified-adoption|property-qualified-state'
```

Backend types/scoped lint/format passed (`/tmp/vd-member-observation-{types,lint,format}-checkpoint.log`).
Backend/Admin specs, OpenAPI/Admin types and ignored Panel API/build_runner generation passed serially
(`/tmp/vd-members-final-{backend-spec,admin-spec,openapi,panel-api}.log`). Panel generation used installed Flutter
3.41.5. No ignored generated client was edited or force-added. Final API conventions and strict Spectral passed
(`/tmp/vd-members-final-api-conventions.log`, `/tmp/vd-members-final-spectral.log`).

Admin field wiring source `d2b1d27df07872d621aa62ce48ebcd007fd5797a` uses the existing shared helper/card to
withdraw activity and qualification on original relay expiry and missing old fields. Independent review found that a cached refetch with a new receipt time could revive expired evidence after wall-clock rollback and could admit an older still-unexpired report.
False and null remain distinct. Read-only labels/help in all six locales distinguish the server guard/target check
from admission/certification. It adds no authoring controls. All thermostat Admin tests passed **11 files / 59 tests**
with two workers; final Admin types/scoped lint/format passed
(`/tmp/vd-members-observation-admin-{tests,types,lint,format}.log`). This initial count predates the freshness correction below. The separate Panel field follow-up is independently accepted and awaits local integration. Final composed Panel validation will be recorded after that
reviewed follow-up is integrated, rather than reusing the worker's individual counts as a composed pass.

The Admin correction uses an editor-owned bounded per-claim cache shared by member cards. Independent activity and
protective-floor watermarks reject older reports and permanently withdraw equal-timestamp expired evidence.
Equal-timestamp refetches cannot extend either the original expiry or a monotonic remaining-lifetime budget;
unchanged values with genuinely newer timestamps can recover. Loading, runtime-null and card remounts preserve
this memory. Only authoritative membership removal (including the last accepted nonreleased runtime membership)
or a controller identity change prunes it. The two authoritative snapshots are bounded to sixteen retained entries;
capacity overflow withholds a new observation rather than evicting retained evidence.

Correction validation passed two focused Admin files / 28 tests with two workers, including the actual editor reload
and card remount paths, independent field expiry, cached refetch after rollback, older report refusal, new report
recovery, false versus null, monotonic lifetime and bounded ownership (`/tmp/vd-admin-freshness-tests-current.log`).
Final Admin types passed (`/tmp/vd-admin-freshness-types-current.log`); scoped lint and formatting passed
(`/tmp/vd-admin-freshness-lint.log`, `/tmp/vd-admin-freshness-format.log`). The correction awaits independent review.

The current tracked source diff is 114 paths versus cached merged-main base. No tests/locales are omitted to change
that count; parent publication may split an identical final tree to meet the external 100-file review limit.
No issue #1447/#1454/#1455 is marked merged or alpha-ready. No push, PR, hardware action, deployment or release was
performed by this integration task.
