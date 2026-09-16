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

6. **Concurrent poll-record ownership:**
   - Records observed before `update-entry` remain pending until the unique active invocation starts.
   - While exactly one invocation is active for the bound trial, unassigned provider/poll/coalescer
     records are appended to that invocation in backend-clock order, including equal timestamps.
   - If no unique active invocation exists, the record remains pending and existing ambiguity rules apply;
     the collector never guesses a trial, generation, or invocation. Records after terminal publication
     cannot be added to the immutable completed capture.
  - A missing poll marker is therefore inconclusive. Later export fetches cannot add activity to an already
    completed capture; poll-overlap qualification must use markers in the joined trial capture itself, not
    restoration or another request's records.

7. **Scoped poll-placement diagnostics:**
   - The optional private `FB_SHELLY_POLL_PLACEMENT` setting enables a bounded, read-only observer for
     the scheduler's actual sorted delegate array. It records the same cycle anchor, interval, target
     slot, computed delay, registration bounds, generation and skip decision used by the scheduler.
   - The observer is disabled for absent or invalid configuration, expires after at most 180 seconds,
     retains at most 64 observations/256 KiB, and never changes polling, provider calls, concurrency,
     timers or command handling. Writes are owner-only and atomic; any stale, failed or mismatched
     snapshot is non-selectable.
   - Placement forecasts are not poll activity. A timing row qualifies as `poll-overlap` only when
     the joined trial capture contains canonical poll RPC/coalescer/drain records between its explicit
     `command-received` and `source-publication` timestamps. Restoration-only, pre-command, late or
     unrelated markers do not qualify.

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
      "outcome": "pending | success | rejected | timeout | transport-failure | malformed | runner-exception | not-dispatched",
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
File-backed checkpoints use a `0600` temporary file, file sync, atomic rename and parent-directory sync. A
failure after rename replaces the destination with an explicitly invalid commit-uncertain artifact, so a
runner-reported finalization failure cannot leave final-valid evidence behind.
`evidence.valid` reports only that the runner retained a structurally complete successful acknowledgement
and cleanup record; it is never a convergence, server-capture, timing-gate, or acceptance result.

## Bounded Acknowledgement Diagnostics

When a command's acknowledgement boundary needs diagnosis, the backend can be armed with the private,
process-only `FB_COMMAND_ACK_TRACE` setting. It is disabled when absent or malformed and must never be
used in timing-acceptance measurements. The setting names one source property target, one trial request ID,
one restoration request ID with the opposite Boolean value, and a separate owner-only JSON snapshot path.
Its lifetime is bounded to 30 seconds from the first matching Socket.IO receipt, 256 records, and a 256 KiB
snapshot.

The private wrapper must allocate the two IDs before arming the service and then pass that exact pair through
its existing `requestIdFactory`. Before dispatch, it must retain both the private trace configuration and the
runner's initial durable artifact, then verify their request IDs, target, and values agree. The trace records
only these boundaries: Socket.IO receipt, gateway entry, registered-handler outcome, Nest's automatic
acknowledgement callback invocation, and socket close. It does not record payloads, credentials, endpoints,
other traffic, or timing acceptance values.

The callback mark means only that the server invoked its Socket.IO acknowledgement delegate; it is not proof
that a peer received the acknowledgement. Conversely, a missing mark is unknown rather than proof of a lost
command. Incomplete, invalid, stale, or failed exports remain diagnostic evidence only. The wrapper must keep
late callback observations and retain the snapshot before cleanup, even if the trial acknowledgement fails.

The normal finalizer has one total 25-second bounded retrieval attempt. It must fetch the existing latency
NDJSON and the separate acknowledgement snapshot during that same attempt, retaining independent result
statuses before removing either temporary export. Trace-enabled runs never enter the 20 idle + 20 actual
poll-overlap matrix or its p95 calculation. After any diagnostic run, restore the temporary setting, trace
artifact, collector setting, and target baseline; verify that restoration separately.

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
