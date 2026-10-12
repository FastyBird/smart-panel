# Task: Shared device editing and test infrastructure

ID: TECH-SHARED-DEVICE-INFRASTRUCTURE
Type: technical
Scope: backend, admin
Size: medium
Status: done
Tracking: #1402

## Context

Shared maintenance separated from the completed virtual-device epic #1336. The original audit is in [TECH-VIRTUAL-DEVICES-FOLLOWUPS](TECH-VIRTUAL-DEVICES-FOLLOWUPS.md), sections 3.4, 3a.3, 3a.8 and 3a.9.

## Acceptance

- [x] Every owned compiled Nest test module has awaited teardown, including factory and per-test modules. Application-owned modules close through the application.
- [x] Core, WLED, Shelly v1, Shelly NG and reTerminal edit forms share the submit lifecycle while preserving their schema, payload, messages, errors, draft behavior and room omission/null semantics.
- [x] Heavy virtual mapping/wizard suites release their wrappers and have measured, documented timeout budgets without a global timeout increase.
- [x] Plugin metadata supplies the device detail section; virtual sources/remap register through it, with physical and disabled-plugin behavior preserved.
- [x] Complete relevant suites, type checking and linting; confirm clean worker exit without `forceExit`.

## Implementation

`useDeviceEditFormSubmit` owns form validation, model parsing, working/error/success results, save behavior and change tracking. Each integration retains model/schema construction and payload-specific transformation. Shelly NG still sends changed addresses and room placement only; the other forms compare room placement to the session snapshot even when the model aliases the device.

The optional `deviceDetailSection` capability accepts the existing device. Core device views look it up by device type without importing virtual components. Existing devices retain diagnostics when the integration is disabled; an absent registration renders only the shared details.

TestingModule bindings are owned at their describe scope, or collected explicitly when factories produce several instances. Teardown runs before dependency cleanup and releases the binding before awaiting close. E2E/spike applications retain their existing ownership through `app.close()`.

Component measurements, teardown rules and the bounded 15-second exception for two real component suites are documented in [Test ownership and component runtime](../../docs/testing-lifecycle.md).

## Verification

The ownership audit covers 241 compilation sites across 222 backend test files. Resource-focused runs passed 107 factory/lifecycle tests and 204 Tailscale tests with `detectOpenHandles` and clean exit. Admin passed all 390 files / 3,635 tests; backend E2E passed all 23 suites / 268 tests. Admin/backend type checking, linting, API conventions, changed-file formatting and panel analysis pass (existing lint warnings remain).

The isolated [CI run on the implementation commit](https://github.com/FastyBird/smart-panel/actions/runs/38299564565) passed all 14 checks, including all 597 backend unit suites (9,440 tests passed; one existing skip), 23 E2E suites (268 tests), OAuth provider spikes (32 tests) and Homey compatibility spikes (250 tests). The three unchanged integration suites that timed out under shared-host load also pass in CI. No worker-exit warning appeared in the backend CI job. Merge remains gated on green current-head CI and a non-blocking CodeRabbit summary.
