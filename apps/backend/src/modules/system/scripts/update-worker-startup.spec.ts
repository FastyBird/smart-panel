import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const worker = readFileSync(join(__dirname, 'update-worker.sh'), 'utf8');
const functions = ['target_health_is_valid', 'target_process_is_stable', 'wait_for_started_service']
	.map((name) => {
		const match = worker.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}$`, 'm'));
		if (!match) throw new Error(`Missing deployed worker function: ${name}`);
		return match[0];
	})
	.join('\n');

function verifyStartup(mode: string): { accepted: boolean; healthCalls: number } {
	const root = mkdtempSync(join(tmpdir(), 'smart-panel-startup-'));
	try {
		const output = execFileSync(
			'bash',
			[
				'-c',
				`${functions}
set -u
INSTALL_TYPE=npm
unset CURRENT_LINK NEW_VERSION_DIR
HEALTH_URL=http://127.0.0.1:3000/api/v1/modules/system/system/health
HEALTH_EXPECTED_VERSION=1.1.0-alpha.63
START_TIMEOUT_SECONDS=3
printf 999 > "$FIXTURE_ROOT/pid"
: > "$FIXTURE_ROOT/health"
service_property() {
  case "$1" in
    ActiveState) printf active ;;
    MainPID) if [ "$FIXTURE_MODE" = missing-pid ]; then printf 0; else cat "$FIXTURE_ROOT/pid"; fi ;;
    ExecMainStartTimestampMonotonic) printf 12345 ;;
  esac
}
node() { "$NODE_BINARY" "$@"; }
sleep() { SECONDS=$((SECONDS + 1)); }
curl() {
  printf 'called\\n' >> "$FIXTURE_ROOT/health"
  if [ "$FIXTURE_MODE" = changing-pid ]; then
    pid=$(cat "$FIXTURE_ROOT/pid")
    printf '%s' "$((pid + 1))" > "$FIXTURE_ROOT/pid"
  fi
  version="$HEALTH_EXPECTED_VERSION"
  [ "$FIXTURE_MODE" != wrong-version ] || version=1.1.0-alpha.62
  if [ "$FIXTURE_MODE" = malformed-health ]; then printf invalid; return; fi
  printf '{"data":{"status":"ok","version":"%s"}}' "$version"
}
if [ "$FIXTURE_MODE" = wrong-image-link ]; then
  INSTALL_TYPE=image
  mkdir "$FIXTURE_ROOT/old" "$FIXTURE_ROOT/new"
  ln -s "$FIXTURE_ROOT/old" "$FIXTURE_ROOT/current"
  CURRENT_LINK="$FIXTURE_ROOT/current"
  NEW_VERSION_DIR="$FIXTURE_ROOT/new"
fi
if wait_for_started_service; then printf accepted; else printf rejected; fi
`,
			],
			{
				encoding: 'utf8',
				env: { ...process.env, FIXTURE_ROOT: root, FIXTURE_MODE: mode, NODE_BINARY: process.execPath },
			},
		);
		return {
			accepted: output === 'accepted',
			healthCalls: readFileSync(join(root, 'health'), 'utf8').split('called').length - 1,
		};
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

describe('deployed update worker startup verification', () => {
	it('accepts stable npm startup without image paths only after repeated version health checks', () => {
		const result = verifyStartup('healthy');
		expect(result.accepted).toBe(true);
		expect(result.healthCalls).toBeGreaterThanOrEqual(2);
	});

	it.each(['wrong-version', 'malformed-health', 'changing-pid'])('rejects npm startup with %s', (mode) => {
		const result = verifyStartup(mode);
		expect(result.accepted).toBe(false);
		expect(result.healthCalls).toBeGreaterThan(0);
	});

	it.each(['missing-pid', 'wrong-image-link'])('rejects %s before accepting health', (mode) => {
		expect(verifyStartup(mode)).toEqual({ accepted: false, healthCalls: 0 });
	});
});
