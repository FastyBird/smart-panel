# Virtual temperature aggregates

The backend aggregate profile accepts canonical Celsius float temperature properties on temperature channels.
Physical inputs must be readable. The existing read-only derived temperature transform is also accepted; forwarded
virtual aliases, nested aggregates and arbitrary units are excluded. Preview, persistence and runtime share this
profile; graph validation quarantines incompatible aggregate outputs without changing physical source authority.
Other numeric quantities, binary aggregates and UI authoring are separate work.

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

The threshold is a positive finite number in canonical Celsius units. Freshness, source compatibility and domain
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
