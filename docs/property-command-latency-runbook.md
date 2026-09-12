# Property Command Latency Observer Runbook

## Overview

This runbook documents the retained measurement observer and procedures for validating
property command convergence and latency correlation under **Epic #1006**, **#1032**,
and diagnostic escalation **#1052**.

## Pipeline Stages & Clock Boundaries

The measurement observer captures distinct stages of property command execution without
cross-process clock alignment:

```
[Client / observer monotonic clock]
  listener-ready ──► subscription-acknowledged ──► dispatch ──► command-ack
                                                     │
                                                     ▼
[Backend `performance.now()` monotonic clock]
  provider-receipt ──► update-entry ──► write-complete ──► source-publication
       │                    │
       └── poll admission / drain diagnostics         └── existing event fan-out
                                                          │
                                                          ▼
[Client / observer monotonic clock]
                                              source-event ──► projection-event
```

The client and backend clocks are intentionally not aligned. The observer finalizes from its own
listener/dispatch/convergence records. A completed client trial is subsequently joined to one
immutable backend capture by request id, source, commanded value, invocation id, and command-window
generation. No backend timestamp is appended to the client record stream, and no duration is derived
across the two clocks.

### Monotonic Spans

- **`commandToAckMs`**: Elapsed time from dispatch to backend command acknowledgement (`dispatch` ──► `command-ack`).
- **`updateEntryToSourceMs`**: The core write-pipeline latency (`update-entry` ──► `source-publication`), measured wholly on the backend monotonic clock from `ChannelsPropertiesService.update()` entry before waiting on locks or the coordinator through canonical source event publication.
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

5. **Server-capture integrity:**
   - The collector is disabled unless a private `FB_COMMAND_LATENCY_CAPTURE` process setting names
     the exact canonical source and optional requested projection.
   - It retains no more than 4096 records and expires an armed trial after 30 seconds. Overflow,
     expiry, shutdown, sink failure, a missing capture, duplicate completed capture, missing generation,
     or non-monotonic server records makes the affected evidence invalid.
   - A stale report held by the command window is preserved as a `suppressed` diagnostic. It is not a
     completed source-publication capture and cannot satisfy a trial by itself.

## Scoped Server Capture and Live Adapter

The collector is an internal diagnostic (`CommandLatencyTraceCollectorService`), not an API, database
setting, or logging-mode change. It records synchronously in bounded process memory. Its NDJSON export
is scheduled only after a capture finishes, so the update path does not await I/O, log a timing record,
or acquire another lock.

On the private validation candidate, set a temporary service environment value with opaque/private
values only. Do not commit it or paste it into an issue:

```json
{
  "runId": "private-run-id",
  "sourcePropertyId": "private-canonical-source-id",
  "projectionPropertyId": "private-requested-projection-id",
  "sourceDeviceId": "private-source-device-id",
  "exportPath": "/private/validation/path/command-latency.ndjson"
}
```

The accepted bounds are `captureDurationMs <= 30000` and `maxRecords <= 4096`; omitting them selects
the maximum approved bounds. The collector starts a trial only for an existing WebSocket `request_id`
whose command targets the configured source or projection, then binds that trial to the already-created
intent and command-window generation. It captures the outer `ChannelsPropertiesService.update()` call
across its structural fallback, and only records publication immediately before the pre-existing source
value event emit. Shelly provider receipt, actual poll RPC (when the optional source-device scope is
provided), poll-coalescer admission, and poll-drain remain distinct diagnostic stages.

After each client observer trial has finalized, `CommandLatencyLiveAdapter` reads the private NDJSON
output together with the active collector `runId` and joins it with `joinServerTimingCapture()`. It
requires exactly one complete capture for that run and correlation id; it preserves the raw client and
server records separately.
Keep the source revision/hash of both observer and installed collector with the private report.

After the bounded run, remove the temporary private output and unset the environment value/restart the
service to restore normal operation. A collector that cannot export, expires, overflows, or observes a
shutdown is failed evidence, never a partial pass.

## Private Runner Evidence Retention

The private Socket.IO wrapper must use
`apps/backend/test/support/command-latency-smoke-runner.ts`; it owns the failure-safe evidence protocol
without embedding credentials, endpoints, or target defaults. The private wrapper creates an owner-only
artifact directory, supplies the actual command payload/restore adapter, and retains the wrapper source
hash alongside `getCommandLatencySmokeRunnerSourceHash()`, the observer hash, and the installed collector
hash. The artifact path is private and task-specific; `raw-smoke.json` is written atomically with mode
`0600` and is the only record to use for the associated trial.

Before emitting, the runner allocates the outbound `requestId`, initializes this durable shape, and writes
it successfully. A failed initial write aborts before dispatch. It injects that same ID as the Socket.IO
payload's `request_id` and retains it as both `trial.requestId` and `trial.emittedRequestId`; cleanup
receives a new `cleanup.correlationId` so a restoration request cannot be confused with the trial.

```json
{
  "schemaVersion": 1,
  "runnerHash": "sha256",
  "wrapperHash": "private-wrapper-sha256-or-null",
  "runId": "private-run",
  "observerHash": "sha256-or-null",
  "collectorHash": "sha256-or-null",
  "target": "private target metadata",
  "baseline": "private pre-command state",
  "trial": {
    "requestId": "outbound request id",
    "dispatchAttempted": true,
    "emittedRequestId": "outbound request id",
    "acknowledgement": {
      "outcome": "success | rejected | timeout | transport-failure | malformed | runner-exception",
      "envelope": "exact private acknowledgement or null",
      "handlerResult": "exact private property result or null",
      "failureReason": "string or null"
    },
    "observation": "private client/collector result or null"
  },
  "cleanup": {
    "correlationId": "separate restoration request id",
    "attempted": true,
    "restored": true,
    "result": "private restoration result or null"
  },
  "failures": {
    "original": "original failure or null",
    "cleanup": "cleanup failure or null",
    "acknowledgementPersistence": "acknowledgement checkpoint failure or null",
    "finalization": "evidence-write failure or null"
  },
  "evidence": {
    "initialPersisted": true,
    "finalPersisted": true,
    "valid": true
  }
}
```

Persist the entire acknowledgement envelope immediately, before client observation or cleanup, including
nested per-device failure details.
An explicit negative acknowledgement, no acknowledgement timeout, transport failure, malformed envelope,
and later runner exception remain separate outcomes. Finalization is attempted on every exit path. A
checkpoint or final-write failure invalidates the evidence but never prevents target restoration; the
original failure and restoration outcome remain separate. Never substitute an older success, a restoration
request, a matching value, or an approximate timestamp for the trial's exact request correlation.
`evidence.valid` reports only that the runner retained a structurally complete successful acknowledgement
and cleanup record; it is never a convergence, server-capture, timing-gate, or acceptance result.

## Engineering Latency Gates

For hardware release acceptance on Raspberry Pi staging:

- **Write-pipeline latency ($P_{95}$)**: `< 800 ms` across both `idle` and `poll-overlap` series.
- **Maximum latency ($Max$)**: `< 3000 ms` for every sample.
- **Timeouts**: Exactly `0` timeouts across 20 idle + 20 actual poll-overlap trials.
- **Complete samples**: Every trial must converge successfully and include a validated backend `update-entry` →
  `source-publication` span. A missing stage, reconnect/invalidation, command failure, or invalid server-capture
  join makes the gate fail; it is not omitted from the series.

## Offline Validation

Execute the unit test suite covering observer ordering, filtering, monotonic checks, timeout semantics, and session statistics:

```bash
pnpm --filter @fastybird/smart-panel-backend run test:unit src/modules/devices/services/command-latency-observer.spec.ts
```

Execute the property command convergence integration suite:

```bash
pnpm --filter @fastybird/smart-panel-backend run test:unit src/modules/devices/services/property-command-convergence.integration.spec.ts
```

Execute the private-runner retention suite before any future bounded physical command:

```bash
pnpm --filter @fastybird/smart-panel-backend run test:unit src/modules/devices/services/command-latency-smoke-runner.spec.ts
```
