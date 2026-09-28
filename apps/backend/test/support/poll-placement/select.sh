#!/usr/bin/env bash
set -euo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
PLACEMENT_CONTRACT="$SCRIPT_DIR/contract.cjs"
export PLACEMENT_CONTRACT

if [[ $# -ne 3 ]]; then
	echo 'usage: command-latency-poll-placement-select.sh <snapshot.json> <expected-config.json> <output.json>' >&2
	exit 64
fi

SNAPSHOT=$1
CONFIG=$2
OUTPUT=$3
test -f "$SNAPSHOT"
test -f "$CONFIG"
test ! -e "$OUTPUT"

SNAPSHOT="$SNAPSHOT" CONFIG="$CONFIG" OUTPUT="$OUTPUT" node - <<'NODE'
const { chmodSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');

const fail = (reason) => {
  const result = { schemaVersion: 1, state: 'not-selectable', reason };
  writeFileSync(process.env.OUTPUT, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  chmodSync(process.env.OUTPUT, 0o600);
  process.exit(1);
};

let snapshot;
let config;
try {
  snapshot = JSON.parse(readFileSync(process.env.SNAPSHOT, 'utf8'));
  config = JSON.parse(readFileSync(process.env.CONFIG, 'utf8'));
} catch {
  fail('snapshot-or-config-parse-failed');
}

if (!snapshot || ![1, 2].includes(snapshot.schemaVersion) || !config || config.schemaVersion !== snapshot.schemaVersion) fail('unsupported-schema');
if (snapshot.status !== 'ready' || snapshot.candidateStatus !== 'valid') fail('snapshot-not-ready');
if (snapshot.backendClock !== 'performance-now-v1') fail('unsupported-backend-clock');
if (snapshot.runId !== config.runId || snapshot.sourceDeviceId !== config.sourceDeviceId) fail('identity-mismatch');
if (!/^[0-9a-f]{64}$/i.test(snapshot.observerRuntimeHash ?? '')) fail('runtime-provenance-missing');
if (!Number.isInteger(snapshot.processId) || snapshot.processId <= 1 || typeof snapshot.processInstanceId !== 'string')
  fail('process-provenance-missing');
const nowRaw = process.env.NOW_MONOTONIC_MS;
if (typeof nowRaw !== 'string' || nowRaw.trim() === '') fail('freshness-clock-missing');
const nowMonotonicMs = Number(nowRaw);
if (!Number.isFinite(nowMonotonicMs)) fail('freshness-clock-invalid');
const uncertaintyRaw = process.env.NOW_UNCERTAINTY_MS;
const dispatchAllowanceRaw = process.env.DISPATCH_ALLOWANCE_MS;
if (typeof uncertaintyRaw !== 'string' || uncertaintyRaw.trim() === '') fail('freshness-uncertainty-missing');
if (typeof dispatchAllowanceRaw !== 'string' || dispatchAllowanceRaw.trim() === '') fail('dispatch-allowance-missing');
const nowUncertaintyMs = Number(uncertaintyRaw);
const dispatchAllowanceMs = Number(dispatchAllowanceRaw);
if (!Number.isFinite(nowUncertaintyMs) || nowUncertaintyMs < 0 || nowUncertaintyMs > 2000)
  fail('freshness-uncertainty-invalid');
if (!Number.isInteger(dispatchAllowanceMs) || dispatchAllowanceMs < 0 || dispatchAllowanceMs > 10000)
  fail('dispatch-allowance-invalid');
const { canonicalConfig: canonicalize, validateLifecycle, validatePair } = require(process.env.PLACEMENT_CONTRACT);
const canonicalConfig = canonicalize(config, fail);
validateLifecycle(snapshot, canonicalConfig, fail);
const expectedFingerprint = createHash('sha256').update(JSON.stringify(canonicalConfig)).digest('hex');
if (snapshot.configFingerprint !== expectedFingerprint) fail('config-fingerprint-mismatch');
if (!Number.isFinite(snapshot.expiresAtMonotonicMs) || !Number.isFinite(snapshot.armedAtMonotonicMs)) fail('expiry-metadata-missing');
if (nowMonotonicMs < snapshot.armedAtMonotonicMs) fail('freshness-before-arm');
if (snapshot.expiresAtMonotonicMs <= nowMonotonicMs) fail('snapshot-expired');

const observations = Array.isArray(snapshot.observations) ? snapshot.observations : [];
if (observations.length < 2) fail('adjacent-cycles-missing');
for (let index = 1; index < observations.length; index++) {
  const previous = observations[index - 1];
  const current = observations[index];
  if (!Number.isInteger(previous.cycleSequence) || !Number.isInteger(current.cycleSequence) ||
      current.cycleSequence <= previous.cycleSequence ||
      !Number.isFinite(previous.anchorMonotonicMs) || !Number.isFinite(current.anchorMonotonicMs) ||
      current.anchorMonotonicMs <= previous.anchorMonotonicMs ||
      typeof previous.anchorUtc !== 'string' || typeof current.anchorUtc !== 'string' ||
      !Number.isFinite(Date.parse(previous.anchorUtc)) || !Number.isFinite(Date.parse(current.anchorUtc)) ||
      Date.parse(current.anchorUtc) < Date.parse(previous.anchorUtc))
    fail('observation-order-invalid');
}
const pair = observations.slice(-2);
validatePair(pair, snapshot.schemaVersion, fail);
const last = pair[1];
const dueLowerMs = last.target.registrationBeforeMs + last.intervalMs + last.target.delayMs;
const dueUpperMs = last.target.registrationAfterMs + last.intervalMs + last.target.delayMs;
const latestPossibleDispatchMs = nowMonotonicMs + nowUncertaintyMs + dispatchAllowanceMs;
if (dueLowerMs <= latestPossibleDispatchMs) fail('next-slot-partially-elapsed');
if (dueUpperMs + nowUncertaintyMs >= snapshot.expiresAtMonotonicMs) fail('forecast-after-expiry');
const result = {
  schemaVersion: 1,
  state: 'selectable',
  snapshotSchemaVersion: snapshot.schemaVersion,
  ...(snapshot.schemaVersion === 2 ? { activatedAtMonotonicMs: snapshot.armedAtMonotonicMs, activationCycles: snapshot.preparation.activationCycles } : {}),
  runId: snapshot.runId,
  processInstanceId: snapshot.processInstanceId,
  processId: snapshot.processId,
  configFingerprint: snapshot.configFingerprint,
  observerRuntimeHash: snapshot.observerRuntimeHash,
  backendClock: snapshot.backendClock,
  freshnessMonotonicMs: nowMonotonicMs,
  freshnessUncertaintyMs: nowUncertaintyMs,
  dispatchAllowanceMs,
  cycles: pair.map((entry) => ({ cycleSequence: entry.cycleSequence, generation: entry.generation, ...(entry.phase ? { phase: entry.phase } : {}), anchorMonotonicMs: entry.anchorMonotonicMs, anchorUtc: entry.anchorUtc })),
  target: { delegateId: last.target.delegateId, slotIndex: last.target.slotIndex, intervalMs: last.intervalMs },
  nextDueIntervalMs: { lower: dueLowerMs, upper: dueUpperMs },
  selectionBasis: 'two-adjacent-actual-cycles-with-next-cycle-future',
};
writeFileSync(process.env.OUTPUT, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
chmodSync(process.env.OUTPUT, 0o600);
NODE

chmod 600 "$OUTPUT"
jq -e '.state == "selectable" or .state == "not-selectable"' "$OUTPUT" >/dev/null
printf 'poll-placement-selection=%s evidence=retained\n' "$(jq -r '.state' "$OUTPUT")"
