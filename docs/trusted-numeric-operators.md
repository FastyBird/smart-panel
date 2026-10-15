# Trusted extension numeric operators

Backend extensions can opt in to synchronous, single-input numeric conversion. These are trusted Node/Nest packages,
not user expressions or a sandbox. There is no enforceable CPU or memory budget: an infinite loop can block Node.
Do not install code you do not trust. Async operators are unsupported; Promise/thenable results are unavailable and
rejections are consumed without awaiting them.

## Package and configuration ownership

Set both `numericOperatorsExport` and `configOwnerType` in the existing `fastybird.smartPanelBackend` manifest:

```json
{
  "kind": "plugin",
  "routePrefix": "example-extension",
  "extensionExport": "ExampleExtensionModule",
  "numericOperatorsExport": "exampleNumericOperators",
  "configOwnerType": "example-extension"
}
```

The same backend entry exports the operator definitions, config model and config update DTO. Its Nest module really
registers that model/DTO mapping and extension metadata, including `packageName` equal to the discovered npm name.
Discovery alone does not register a config owner. The host compares the mapper's class identities with the actual
entry exports, the explicit owner kind/type and metadata package identity after all modules initialize. Conflicting
owner/package claims and overwrites of an existing owner's metadata are ineligible. Metadata's package field alone
is not proof of ownership. Existing extensions without numeric opt-in retain their existing registration behavior.

The host derives an ID such as `@fastybird/smart-panel-extension-example:temperature_offset` from discovery. A package
cannot supply a different namespace in an operator definition. Only one version of each local name may be active;
versions are immutable positive integers, selected explicitly. There is no `latest`, implicit upgrade or hot loader.
Package replacement/removal takes effect through ordinary backend restart. The example package includes a typed
bounded temperature-offset fixture and genuine, disabled-by-default config owner registration.

## Contract and persisted policy

Use the exported SDK `NumericOperatorDefinition`. Contract version 1 permits existing canonical pairs: temperature/°C,
humidity/%, concentration/ppm, illuminance/lx and voltage or raw value/V. Definitions declare exact input/output
measurements, finite inclusive supported domains and up to 32 finite numeric parameter schemas with explicit
`required`, `minimum` and `maximum`. Local names are lowercase identifiers of at most 64 characters. Unknown keys,
unsupported contracts, nonnumeric parameters, missing required parameters and out-of-domain values are refused.
Descriptors and validated parameter objects are detached and frozen before retention/evaluation.

A transform continues to use schema version 1 and its existing simple-json policy column. For example:

```json
{
  "operator": "extension",
  "contractVersion": 1,
  "operatorId": "@fastybird/smart-panel-extension-example:temperature_offset",
  "operatorVersion": 1,
  "inputRange": { "minimum": -40, "maximum": 100 },
  "outputRange": { "minimum": -50, "maximum": 110 },
  "parameters": { "offset": 2 }
}
```

The configured domains must be subsets of the descriptor domains. The physical source quantity/unit and immutable
output quantity/unit must match exactly. Existing qualification, finite/range checks, graph/config revisions and
source evidence rules still apply. Transforms do not nest; the existing restricted temperature-transform-to-aggregate
composition remains available. Preview uses the same resolver and always returns `qualified: false`.

The four built-ins retain their original JSON, validation and formulas (affine, piecewise linear, NTC beta and
Steinhart–Hart). Swagger has explicit wire-operator variants; generated API/spec clients must come from the source
pipeline. No database migration or schemaVersion change is needed. Unknown persisted extension IDs/versions remain
readable, unavailable and repairable; they never fall back to a built-in. Admin shows available exact versions,
canonical domains and bounded numeric parameter fields in all six locales, while preserving unavailable saved policy.
Unsupported stored contracts stay distinct even if their operator ID/version is installed. Unknown parameters/fields
are retained or rejected until the operator explicitly selects or resets a definition; repair does not silently drop them.

## Lifecycle and current publication

Operators activate through their real owner's managed service and enabled configuration. Each activation has a distinct
identity. Disposal is idempotent and an old disposer cannot remove a later activation. Config updates revoke matching
registrations synchronously, before async service resynchronization. Stop/restart, reset, disposal and shutdown also
close live authority before asynchronous cleanup. Coordinated service shutdown invokes an optional synchronous
`revokeCurrentAuthority` hook before awaiting any other service; unregister's global record-only semantics are unchanged.

A transform captures operator identity before database/connectivity waits, then composes it with the graph guard on
its actual producer lease. Publication checks `canCommit` before queuing, inside the queue and at commit. Revocation
synchronously invalidates matching outputs and dependent aggregates, retaining unavailable overlays over history.
Reactivation installs a fresh-source barrier again: reports accepted during the disabled interval are insufficient.
Neither registration nor recomputation renews physical source age, acceptance generation or sampling timestamps.
Thrown errors, nonfinite/nonnumeric results and unsupported async results affect the output's availability.

An already-entered asynchronous history write can complete after disposal and can have touched the history queue or
internal cache. This implementation does not roll back that write. Its guarantee is that the old activation cannot
commit a current publication, expose history as current, renew source evidence or resurrect on re-registration.

## Protective boundary and software evidence

Extension operators never grant protective authority, including an operator named Steinhart–Hart or a Celsius output.
Floor admission explicitly requires the reviewed built-in Steinhart–Hart policy before staging; existing qualified
native/voltmeter, same-Shelly lineage and matched local-artifact checks remain mandatory. The SDK has no protection
flags, provider evidence, source clocks or local compiler callbacks. No equipment action or commissioning is involved.

Regression coverage includes real discovered fixture exports and config ownership through managed activation,
unqualified preview, SQLite persistence, fresh physical evaluation, disposal, immediate aggregate invalidation and
history retention; exact-version/collision/owner-spoof checks; invalid result isolation; and delayed database/history
publication across disposal and reactivation. Admin tests exercise actual numeric input bounds and missing-version
repair. Exact commands, commit and outcomes belong to the local implementation handoff; installed equipment remains
unqualified by these software tests.
