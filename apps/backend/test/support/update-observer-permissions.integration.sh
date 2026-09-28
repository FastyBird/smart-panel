#!/bin/bash
set -Eeuo pipefail
# Root-to-service-user integration with real files/process probes. No application data or service is used.
if [ "$(uname -s)" != Linux ] || [ "$(id -u)" != 0 ]; then
	echo 'SKIP: requires root on disposable Linux'
	exit 77
fi
: "${EXECUTOR_MODULE:?compiled repaired executor required}"
: "${LEGACY_EXECUTOR_MODULE:?compiled alpha.25 executor required for the negative control}"
: "${BACKEND_RUNTIME_DIR:?installed backend dist required for imports}"
: "${UPDATE_WORKER_SCRIPT:?repaired worker source required}"
service_user="${TEST_SERVICE_USER:-smart-panel}"
reader_gid="$(id -g "$service_user")"
[ "$(id -u "$service_user")" != 0 ]
fixture="$(mktemp -d /var/tmp/smart-panel-observer-test.XXXXXX)"
chmod 755 "$fixture"
trap 'echo "Evidence: $fixture"' EXIT
node - "$UPDATE_WORKER_SCRIPT" "$fixture/functions.sh" <<'JS'
const fs = require('node:fs');
const source = fs.readFileSync(process.argv[2], 'utf8');
const end = source.indexOf('restore_before_migration() {');
if (end < 0) throw new Error('Worker function boundary missing');
fs.writeFileSync(process.argv[3], source.slice(0, end));
JS
cp "$EXECUTOR_MODULE" "$fixture/fixed.js"
cp "$LEGACY_EXECUTOR_MODULE" "$fixture/legacy.js"
cat > "$fixture/observer.cjs" <<'JS'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const [root, runtime, sourceFile] = process.argv.slice(2);
const filename = path.join(runtime, 'modules/system/services/update-executor.service.js');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
// Bind only the two production constant paths to disposable files; fs/process remain real.
const code = fs.readFileSync(sourceFile, 'utf8').replaceAll('/var/lib/smart-panel/', root + '/');
loaded._compile(code, filename);
const observations = [];
let executor;
const update = {
 acquireUpdateLock: () => true,
 releaseUpdateLock: () => {},
 getCurrentVersion: () => '1.1.0-alpha.25',
 setStatus: status => {
  observations.push(status);
  fs.writeFileSync(path.join(root, 'observations.json'), JSON.stringify(observations));
  if (status.status === 'complete' || status.status === 'failed') {
   fs.writeFileSync(path.join(root, 'result'), status.status);
   setTimeout(() => { executor.onModuleDestroy(); process.exit(0); }, 50);
  }
 },
};
executor = new loaded.exports.UpdateExecutorService(update, {}, {
 notify: async () => {}, resolve: async () => {}, resolveAll: async () => {},
});
executor.onModuleInit().then(() => fs.writeFileSync(path.join(root, 'initialized'), 'yes'));
setTimeout(() => { console.error('Observer did not settle'); process.exit(1); }, 12000);
JS
for kind in unreadable legacy-probe fixed; do
	case_root="$fixture/$kind"
	install -d -o "$service_user" -m 700 "$case_root"
	export ATTEMPT_DIR="$case_root/update-attempt" STATUS_FILE="$case_root/update-status.json"
	if [ "$kind" = unreadable ]; then export UPDATE_OBSERVER_GID=''; else export UPDATE_OBSERVER_GID="$reader_gid"; fi
	# Uses actual acquire/write/release functions with this live root shell as the worker owner.
	source "$fixture/functions.sh"
	VERSION=1.1.0-alpha.25
	acquire_attempt
	write_attempt active starting '' false true
	printf '{"status":"starting","phase":"starting","targetVersion":"1.1.0-alpha.25"}\n' > "$STATUS_FILE"
	chmod 644 "$STATUS_FILE"
	printf private > "$ATTEMPT_DIR/migration.log"
	chmod 600 "$ATTEMPT_DIR/migration.log"
	if [ "$kind" != unreadable ]; then
		sudo -n -u "$service_user" node - "$ATTEMPT_DIR" <<'JS'
const fs = require('node:fs'), root = process.argv[2];
const a = JSON.parse(fs.readFileSync(root + '/attempt.json'));
try { process.kill(a.ownerPid, 0); throw new Error('Expected EPERM'); } catch(e) { if(e.code !== 'EPERM') throw e; }
for (const [file,mode] of [['attempt.json','r+'],['migration.log','r'],['lock','r']]) {
 try { fs.openSync(root + '/' + file, mode); throw new Error('Unexpected access: ' + file); }
 catch(e) { if(e.code !== 'EACCES') throw e; }
}
JS
	fi
	module="$fixture/fixed.js"
	if [ "$kind" = legacy-probe ]; then module="$fixture/legacy.js"; fi
	sudo -n -u "$service_user" node "$fixture/observer.cjs" "$case_root" "$BACKEND_RUNTIME_DIR" "$module" > "$case_root/output.log" 2>&1 &
	observer_pid=$!
	for _ in $(seq 1 50); do
		[ ! -f "$case_root/initialized" ] || break
		sleep 0.1
	done
	[ -f "$case_root/initialized" ]
	if [ "$kind" = fixed ]; then
		[ ! -f "$case_root/result" ]
		node - "$case_root/observations.json" <<'JS'
const observations = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));
if (observations.length !== 1 || observations[0].status !== 'starting' ||
 observations[0].phase !== 'starting' || observations[0].progressPercent !== 85) {
 throw new Error('Observer must restore STARTING before initialization returns');
}
JS
	fi
	release_attempt
	wait "$observer_pid"
	result="$(cat "$case_root/result")"
	if [ "$kind" = fixed ]; then [ "$result" = complete ]; else [ "$result" = failed ]; fi
	[ ! -d "$ATTEMPT_DIR/lock" ]
	echo "PASS: $kind observer reported $result"
done
