# Private poll-placement adapters

These are local diagnostic tools, not an HTTP endpoint or a device command runner. They are the
reviewable versions of the private reader/selector used for #1077. They require Node.js, Bash and jq.
Keep snapshots, configuration, freshness and retained owner records in an owner-only directory.

- `read.sh snapshot owner expected-config freshness output` verifies process/config ownership and
  conservatively translates a bracketed UTC read using the snapshot's paired backend clock anchor.
  It calls the adjacent `select.sh` (or `FB_COMMAND_LATENCY_SELECTOR`).
- `select.sh snapshot expected-config output` needs `NOW_MONOTONIC_MS`, `NOW_UNCERTAINTY_MS` and
  `DISPATCH_ALLOWANCE_MS`. Use the reader in live work; invoking the selector alone does not establish
  process provenance. V2 validates the original activation pair, distinguishes preparation from
  measurement, and still requires the latest two adjacent observed target decisions before forecasting.
  Observed cycle/registration times and v2 decision times must be no later than the conservative
  lower bound of the current time. UTC observations must agree with the paired backend anchor within
  2 seconds. V1 lacks decision timestamps, so it can only verify that the claimed slot was already due.
- `finalize.cjs absolute-export retained-owner` removes only the matching export/owner after its
  recorded writer PID is absent. Archive the final snapshot and owner first. A live/reused PID, EPERM,
  missing owner, symlink, public directory or foreign file fails closed. It does not stop a process,
  restart systemd, remove overrides or delete a directory. The staging lifecycle must perform those
  operations separately and verify the subsequent normal backend's environment and health.
- `worker.cjs` is a **test-only** local scheduler/clock adapter. It starts the real diagnostic service
  in a child process and lets integration tests drive callbacks and time without sending any RPC.

`poll-placement-readiness.spec.ts` executes this actual child publisher, exported files, reader,
selector and finalizer. Only scheduling and time are controlled; publishing and cleanup use real
files and process-exit checks. To run against installed private adapters, set `FB_POLL_TEST_READER`,
`FB_POLL_TEST_SELECTOR` and `FB_POLL_TEST_FINALIZER` to their paths. Keep `contract.cjs` adjacent to
those reader/selector scripts. The default test uses this directory, so CI needs no private files.

This local conformance test does not execute SSH/systemd, establish live backend clock uncertainty,
prove actual poll RPC overlap, or replace the command-free staging feasibility gate. Old v1-only
readers must reject schema v2. Do not translate it into a v1 snapshot or move v1's arm time.
