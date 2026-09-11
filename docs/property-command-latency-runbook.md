# Property Command Latency Observer Runbook

## Overview

This runbook documents the retained measurement observer and procedures for validating
property command convergence and latency correlation under **Epic #1006**, **#1032**,
and diagnostic escalation **#1052**.

## Pipeline Stages & Monotonic Tracking

The measurement observer captures distinct stages of property command execution without
cross-process clock alignment:

```
[Client/Transport]
  listener-ready ──► subscription-acknowledged ──► dispatch ──► command-ack
                                                     │
[Backend Pipeline]                                   ▼
  provider-receipt ──► update-entry ──► write-commit ──► source-event ──► projection-event
```

### Monotonic Spans

- **`commandToAckMs`**: Elapsed time from dispatch to backend command acknowledgement (`dispatch` ──► `command-ack`).
- **`updateEntryToSourceMs`**: The core write-pipeline latency (`update-entry` ──► `source-event`), measured from `ChannelsPropertiesService.update()` entry before waiting on locks or the coordinator through canonical source event publication.
- **`sourceToProjectionMs`**: Latency for virtual projection fan-out (`source-event` ──► `projection-event`).
- **`totalConvergenceMs`**: End-to-end convergence duration from client dispatch to final client-observable event (`dispatch` ──► `projection-event` or `source-event`).

## Invariants & Guardrails

1. **Ordering Invariants:**
   - Listeners MUST be attached before requesting exchange subscription (`listener-ready` precedes `subscription-acknowledged`).
   - Exchange subscription MUST be acknowledged by the server before command dispatch (`subscription-acknowledged` precedes `dispatch`).
   - Command acknowledgement and source events MUST follow dispatch; a projection event MUST follow its source event.

2. **Monotonic Timing:**
   - All stage records within a process MUST have monotonically non-decreasing timestamps ($t_{n} \ge t_{n-1}$).

3. **Timeout & Failure Integrity:**
   - If convergence events are not received within `timeoutMs` (default 5000 ms), the trial is recorded as an explicit `timeout` failure.
   - Timeouts MUST NOT be coerced into arbitrary latency values or treated as success.
   - Any transport reconnect invalidates an in-flight trial (`invalidated`).

4. **Poll Activity Correlation:**
   - Each trial records the observed Shelly staggered poll state: in-flight polls, active drains, slot index, and whether RPC was active.
   - Trials are partitioned into `idle` vs `poll-overlap` based on actual background activity.

## Engineering Latency Gates

For hardware release acceptance on Raspberry Pi staging:

- **Write-pipeline latency ($P_{95}$)**: `< 800 ms` across both `idle` and `poll-overlap` series.
- **Maximum latency ($Max$)**: `< 3000 ms` for every sample.
- **Timeouts**: Exactly `0` timeouts across 20 idle + 20 actual poll-overlap trials.
- **Complete samples**: Every trial must converge successfully and include an `update-entry` → `source-event` span. A
  missing stage, reconnect/invalidation, or command failure makes the gate fail; it is not omitted from the series.

## Offline Validation

Execute the unit test suite covering observer ordering, filtering, monotonic checks, timeout semantics, and session statistics:

```bash
pnpm --filter @fastybird/smart-panel-backend run test:unit src/modules/devices/services/command-latency-observer.spec.ts
```

Execute the property command convergence integration suite:

```bash
pnpm --filter @fastybird/smart-panel-backend run test:unit src/modules/devices/services/property-command-convergence.integration.spec.ts
```
