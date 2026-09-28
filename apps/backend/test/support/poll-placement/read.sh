#!/usr/bin/env bash
set -euo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
PLACEMENT_CONTRACT="$SCRIPT_DIR/contract.cjs"
export PLACEMENT_CONTRACT

if [[ $# -ne 5 ]]; then
	printf 'usage: command-latency-poll-placement-read.sh <snapshot.json> <owner.json> <expected-config.json> <freshness.json> <output.json>\n' >&2
	exit 64
fi

SNAPSHOT=$1
OWNER=$2
CONFIG=$3
FRESHNESS=$4
OUTPUT=$5
SELECTOR="${FB_COMMAND_LATENCY_SELECTOR:-$SCRIPT_DIR/select.sh}"
test -f "$SNAPSHOT"
test -f "$OWNER"
test -f "$CONFIG"
test ! -e "$OUTPUT"
test -x "$SELECTOR"

CHECK=$(SNAPSHOT="$SNAPSHOT" OWNER="$OWNER" CONFIG="$CONFIG" FRESHNESS="$FRESHNESS" node - <<'NODE' 2>/dev/null || true
const { readFileSync, lstatSync } = require('node:fs');
const { dirname } = require('node:path');
const fail = (reason) => { process.stdout.write(`ERROR\t${reason}`); process.exit(0); };
for (const file of [process.env.SNAPSHOT, process.env.OWNER]) {
  const stat = lstatSync(file);
  const parent = lstatSync(dirname(file));
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o177) !== 0 || stat.size > 256 * 1024 ||
      !parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) !== 0)
    fail('export-not-private');
}
let snapshot;
let owner;
let config;
let freshness;
try {
  snapshot = JSON.parse(readFileSync(process.env.SNAPSHOT, 'utf8'));
  owner = JSON.parse(readFileSync(process.env.OWNER, 'utf8'));
  config = JSON.parse(readFileSync(process.env.CONFIG, 'utf8'));
  freshness = JSON.parse(readFileSync(process.env.FRESHNESS, 'utf8'));
} catch {
  fail('provenance-record-parse-failed');
}
if (!snapshot || ![1, 2].includes(snapshot.schemaVersion) || !owner || owner.schemaVersion !== 1 || !config || config.schemaVersion !== snapshot.schemaVersion)
  fail('provenance-record-invalid');
const { canonicalConfig: canonicalize, validateLifecycle } = require(process.env.PLACEMENT_CONTRACT);
const canonicalConfig = canonicalize(config, fail);
validateLifecycle(snapshot, canonicalConfig, fail);
const dispatchAllowanceMs = config.dispatchAllowanceMs === undefined ? 1000 : config.dispatchAllowanceMs;
if (!Number.isInteger(dispatchAllowanceMs) || dispatchAllowanceMs < 0 || dispatchAllowanceMs > 10000)
  fail('dispatch-allowance-invalid');
const { createHash } = require('node:crypto');
const expectedFingerprint = createHash('sha256').update(JSON.stringify(canonicalConfig)).digest('hex');
if (snapshot.configFingerprint !== expectedFingerprint || owner.configFingerprint !== expectedFingerprint)
  fail('config-fingerprint-mismatch');
if (owner.runId !== snapshot.runId || owner.processId !== snapshot.processId || owner.processInstanceId !== snapshot.processInstanceId)
  fail('owner-process-mismatch');
if (!freshness || freshness.schemaVersion !== 1 || freshness.source !== 'paired-backend-anchor' || freshness.backendClock !== 'performance-now-v1')
  fail('freshness-record-invalid');
if (!Number.isInteger(freshness.processId) || freshness.processId <= 1 || typeof freshness.processInstanceId !== 'string')
  fail('freshness-process-provenance-missing');
if (freshness.processId !== snapshot.processId || freshness.processInstanceId !== snapshot.processInstanceId)
  fail('freshness-process-mismatch');
if (!Number.isFinite(freshness.backendMonotonicMs)) fail('freshness-clock-missing');
if (!Number.isFinite(freshness.uncertaintyMs) || freshness.uncertaintyMs < 0 || freshness.uncertaintyMs > 2000)
  fail('freshness-uncertainty-invalid');
if (typeof freshness.processIdentityBefore !== 'string' || typeof freshness.processIdentityAfter !== 'string' ||
    freshness.processIdentityBefore.length === 0 || freshness.processIdentityBefore !== freshness.processIdentityAfter)
  fail('freshness-process-identity-unstable');
const before = Date.parse(freshness.readUtcBefore ?? '');
const after = Date.parse(freshness.readUtcAfter ?? '');
const armed = Date.parse(snapshot.armedAtUtc ?? '');
if (!Number.isFinite(before) || !Number.isFinite(after) || !Number.isFinite(armed) || after < before)
  fail('freshness-utc-invalid');
if (after - before > 2000) fail('freshness-transport-too-wide');
if (Number.isFinite(freshness.acquisitionDurationMs) && freshness.acquisitionDurationMs !== after - before)
  fail('freshness-acquisition-duration-mismatch');
if (freshness.anchorMonotonicMs !== snapshot.armedAtMonotonicMs || freshness.anchorUtc !== snapshot.armedAtUtc)
  fail('freshness-anchor-mismatch');
const expected = snapshot.armedAtMonotonicMs + ((before + after) / 2 - armed);
if (Math.abs(expected - freshness.backendMonotonicMs) > freshness.uncertaintyMs + 2)
  fail('freshness-clock-translation-invalid');
if (freshness.backendMonotonicMs + freshness.uncertaintyMs >= snapshot.expiresAtMonotonicMs)
  fail('freshness-expired');
process.stdout.write(`OK\t${freshness.backendMonotonicMs}\t${freshness.uncertaintyMs}\t${dispatchAllowanceMs}`);
NODE
)

if [[ "$CHECK" == ERROR$'\t'* ]]; then
	reason=${CHECK#*$'\t'}
  OUTPUT="$OUTPUT" REASON="$reason" node - <<'NODE'
const { chmodSync, writeFileSync } = require('node:fs');
const output = process.env.OUTPUT;
const result = { schemaVersion: 1, state: 'not-selectable', reason: process.env.REASON };
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
chmodSync(output, 0o600);
NODE
	chmod 600 "$OUTPUT"
	printf 'poll-placement-read=%s evidence=retained\n' "$(jq -r '.state' "$OUTPUT")"
	exit 1
fi

if [[ "$CHECK" != OK$'\t'* ]]; then
	printf 'unexpected freshness validation result\n' >&2
	exit 1
fi
IFS=$'\t' read -r _ NOW_MONOTONIC_MS NOW_UNCERTAINTY_MS DISPATCH_ALLOWANCE_MS <<<"$CHECK"
export NOW_MONOTONIC_MS NOW_UNCERTAINTY_MS DISPATCH_ALLOWANCE_MS
"$SELECTOR" "$SNAPSHOT" "$CONFIG" "$OUTPUT"
