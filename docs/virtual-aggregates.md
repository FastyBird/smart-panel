# Virtual aggregate sensors

The backend accepts these exact canonical channel/property profiles. Physical inputs must be readable.
Preview, persistence, source candidates and runtime share the same capability policy. Graph validation quarantines
incompatible outputs without changing physical source authority.

| Profile/channel | Property | Type | Unit | Output precision |
| --- | --- | --- | --- | --- |
| temperature | temperature | float | °C | Existing declared output step; full floating precision if absent |
| humidity | humidity | uchar | % | Whole percent, step 1 |
| carbon_dioxide | concentration | float | ppm | Whole ppm, step 1 |
| illuminance | illuminance | float | lx | One decimal, step 0.1 |
| contact, motion, occupancy | detected | bool | none | Strict boolean |

Numeric rounding occurs once after aggregation, to the nearest grid point with ties toward positive infinity.
The profile grid is fixed for new numeric quantities; a contradictory explicit output step is rejected. Source numeric
values retain their original units and spec-supported types. Humidity is bounded to 0–100; CO₂ and illuminance to
0–100000, in addition to source property validation. Illuminance's qualitative `level` is optional in the source spec:
no aggregate invents brightness thresholds. CO₂ `detected` and carbon-monoxide concentration are separate quantities.

Only the existing read-only canonical temperature transform can compose into an aggregate. Forwarded aliases,
aggregate nesting, cross-quantity composition, arbitrary units and cycles are excluded. A Celsius unit or aggregate
mode alone never grants thermostat temperature eligibility; non-temperature quantity metadata is rejected.

`GET /plugins/devices-virtual/producers/aggregate-profiles` exposes supported profile capabilities.
`GET /plugins/devices-virtual/producers/aggregate-profiles/{profile}/sources` returns structurally eligible source UUIDs.
Candidates still require live qualification at runtime. Configuration responses expose the profile, effective output
grid, rounding policy, fixed source identities, age and exclusions. Existing temperature configuration URLs are unchanged.

Existing `mean`, `median`, `min` and `max` configurations retain their interpretation. `weighted_mean` accepts an
optional `weight` on each input, defaulting to 1. Weights must be finite numbers in the inclusive interval
**0.000001–1000000**, bounding their ratio to 10¹². The evaluator scales values and normalizes weights before compensated
summation, then renormalizes over retained inputs. Only the final result is rounded onto the existing output step.
`minimum_valid_inputs` always counts distinct retained source identities, regardless of weight.

Filtering is explicit and disabled when `outlier_filter` is omitted or null. For example:

```json
{
  "kind": "absolute_deviation_from_median",
  "threshold": 2
}
```

The threshold is a positive finite number in the profile’s canonical units. Freshness, source compatibility and domain
validation run first. At least three qualified inputs are required for comparison, independently of quorum. Their
unweighted median defines the comparison point. Inputs strictly farther than the threshold are marked `outlier`;
equality is retained. Filtering runs once, then quorum is checked. Insufficient comparison inputs produce
`insufficient_comparison_cohort`; too few retained inputs produce `quorum_lost`. Both make the output unavailable.
A result with excluded inputs is degraded. No outlier is silently rejected when filtering is disabled.

Retained samples determine the output sample time. Every comparison sample, including an excluded outlier, bounds
output expiry because its removal can change the median or invalidate the comparison cohort. Reading, recalculation
and cached events do not refresh sample age. A new equal-valued live report can supply new evidence without another
scalar history entry. Restart requires fresh process-local evidence; history never becomes live authority.

The incremental policy migration gives existing input rows weight 1 and leaves filtering null. Output and binding
UUIDs, source identities, missing bindings, history and configuration revisions are preserved. Configuration writes
continue to use the existing graph/revision fences and producer leases. These software policies do not qualify or
command physical equipment.


## Binary aggregates

Contact, motion and occupancy retain distinct profiles even though they all use `detected`. Only actual boolean reports
are admitted. Numeric/string truthiness is never evidence. The `any` and `all` operators use fixed membership, explicit
quorum and the same source freshness/expiry, identity and graph fences as numeric aggregates. Weights and outlier
filters are rejected for binary authoring and omitted from binary input diagnostics.

Quorum must be met before any result is available. Then:

| Operator | Qualified decisive input | Every member qualified, no decisive input | Unknown member, no decisive input |
| --- | --- | --- | --- |
| any | true → true | all false → false | unavailable |
| all | false → false | all true → true | unavailable |

A decisive result with an excluded/missing member is degraded. Missing member deletion never shrinks quorum; the stored
binding UUID and original source identity remain repairable. Output evidence uses the oldest contributing sample and
expires at the earliest contributing deadline. Equal live reports preserve evidence rules, while reads/recomputation
and history do not manufacture fresh samples. Restart waits for new process-local evidence.

The incremental profile migration defaults existing aggregate configurations to `temperature`, retaining output/input
identities, revisions and prior policy. No smoke/leak alarm or security decision policy is provided.

## Authoring and diagnostics

The admin aggregate editor obtains available profiles and eligible sources from the backend. Choose the quantity,
sources, operator, minimum valid input count and maximum sample age. Numeric profiles additionally expose weights for
weighted mean and an optional outlier threshold labelled in the profile's unit. Binary profiles expose only `any` and
`all`; they do not offer weights, numeric grids or outlier filtering. Existing outputs retain their profile and UUID.
Missing sources retain their original binding identity so they can be explicitly replaced without recreating the sensor.

Preview evaluates the proposed configuration on the backend, including unsaved policy changes during creation, editing
and repair. Its `preview_result` contains the value, quality, source exclusions, evaluation/sample timestamps and expiry.
The create route is `POST /plugins/devices-virtual/producers/aggregates/draft-preview`; existing outputs use
`POST /plugins/devices-virtual/producers/aggregates/{id}/preview`. These snapshots use the same qualified evidence and
evaluation policy as runtime. They do not write values/history, publish producer state, renew source leases or consume
the fresh-input barrier used after creation. Preview availability does not promise that the saved sensor will immediately
produce a live value; runtime still requires its own current evidence.

The editor distinguishes the draft result from saved runtime diagnostics. Changing a draft or its selected sources
invalidates its preview, and superseded responses cannot authorize a newer draft. A preview with a finite expiry is
discarded at that deadline. Run preview again before saving changed or expired drafts. A validated configuration can
still be saved while its current result is unavailable; missing or stale evidence remains unavailable after saving.

Admin and panel diagnostics identify missing, stale, disabled, incompatible and outlier inputs without presenting
historical values as current evidence. The panel respects each numeric output's precision and distinguishes binary
`false` from unavailable data. A degraded decisive binary result remains labelled as degraded rather than implying
that every member reported.
