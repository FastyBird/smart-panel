#!/bin/bash
set -Eeuo pipefail

# Run on disposable Linux/systemd as root after building the backend. No database, network
# provider or Smart Panel service is used. A separate runtime may supply installed dependencies.
if [ "$(uname -s)" != Linux ] || [ "$(id -u)" != 0 ] || ! systemctl show-environment >/dev/null 2>&1; then
	echo 'SKIP: requires root on disposable Linux with systemd'
	exit 77
fi
support_dir="$(cd "$(dirname "$0")" && pwd)"
backend_dir="$(cd "$support_dir/../.." && pwd)"
worker_module="${WORKER_MODULE:-$backend_dir/dist/modules/system/services/privileged-worker.service.js}"
runtime_dir="${BACKEND_RUNTIME_DIR:-$backend_dir/dist}"
update_worker="${UPDATE_WORKER_SCRIPT:-$backend_dir/src/modules/system/scripts/update-worker.sh}"
service_user="${TEST_SERVICE_USER:-root}"
node_binary="$(command -v node)"
command -v sudo >/dev/null
[ -f "$worker_module" ] && [ -f "$update_worker" ]
[ -f "$runtime_dir/modules/system/services/privileged-worker.service.js" ]
fixture_root="$(mktemp -d /var/tmp/smart-panel-launcher-test.XXXXXX)"
chmod 755 "$fixture_root"
fixture_name="${fixture_root##*/}"
units=()
cleanup() {
	local unit
	for unit in "${units[@]}"; do
		systemctl kill --kill-whom=all "$unit" >/dev/null 2>&1 || true
		systemctl stop "$unit" >/dev/null 2>&1 || true
		systemctl reset-failed "$unit" >/dev/null 2>&1 || true
		rm -f "/run/systemd/system/$unit"
	done
	systemctl daemon-reload
	# Keep fixture output for the caller's evidence archive; it contains no application data.
	echo "Evidence: $fixture_root"
}
trap cleanup EXIT

# Extract unchanged production predicates, not a reimplementation of the quiescence check.
"$node_binary" - "$update_worker" "$fixture_root/functions.sh" <<'JS'
const fs = require('node:fs');
const source = fs.readFileSync(process.argv[2], 'utf8');
const globals = source.slice(0, source.indexOf('json_escape() {'));
const functions = source.slice(source.indexOf('service_property() {'), source.indexOf('wait_for_started_service() {'));
if (!globals || !functions.includes('service_quiesced() {')) throw new Error('Worker extraction failed');
fs.writeFileSync(process.argv[3], globals + functions);
JS
cp "$worker_module" "$fixture_root/privileged-worker.service.js"
cat > "$fixture_root/launcher.cjs" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const [root, runtime, unit, kind] = process.argv.slice(2);
// Execute the actual compiled service; resolve its imports against the supplied runtime.
const filename = path.join(runtime, 'modules/system/services/privileged-worker.service.js');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(fs.readFileSync(path.join(root, 'privileged-worker.service.js'), 'utf8'), filename);
const service = new loaded.exports.PrivilegedWorkerService({
 supportsPrivilegedWorkers: async () => true,
 getPlatformType: () => 'raspberry',
});
service.run({
 unit: unit + '-worker', unitType: kind,
 script: path.join(root, 'worker.sh'), args: [root, unit, kind],
 statusFile: path.join(root, kind, 'status.json'),
}).catch(error => { console.error(error); process.exit(1); });
setInterval(() => {}, 1000);
JS
cat > "$fixture_root/worker.sh" <<'SH_WORKER'
#!/bin/bash
root="$1"
unit="$2"
kind="$3"
exec > "$root/$kind/output.log" 2>&1
source "$root/functions.sh"
SERVICE_NAME="$unit.service"
SERVICE_UNIT="$unit.service"
sleep 2
capture_service_identity
printf 'Captured identities:\n%b' "$CAPTURED_SERVICE_MEMBER_IDENTITIES"
printf 'Worker membership: '
cat /proc/$$/cgroup
sudo -n systemctl stop "$SERVICE_NAME"
if service_quiesced; then result=0; else result=$?; fi
printf 'Production quiescence result: %s\n' "$result"
systemctl show "$SERVICE_NAME" -p MainPID -p ActiveState -p ControlGroup
printf '%s\n' "$result" > "$root/$kind/result"
printf '{"state":"complete"}\n' > "$root/$kind/status.json"
SH_WORKER
chmod 755 "$fixture_root/worker.sh"

for kind in scope service; do
	unit="$fixture_name-$kind"
	units+=("$unit.service")
	if [ "$kind" = scope ]; then units+=("$unit-worker.scope"); else units+=("$unit-worker.service"); fi
	install -d -o "$service_user" -m 700 "$fixture_root/$kind"
	cat > "/run/systemd/system/$unit.service" <<EOF
[Service]
User=$service_user
ExecStart=$node_binary $fixture_root/launcher.cjs $fixture_root $runtime_dir $unit $kind
KillMode=process
TimeoutStopSec=10
EOF
	systemctl daemon-reload
	systemctl start "$unit.service"
	for _ in $(seq 1 30); do
		[ ! -f "$fixture_root/$kind/result" ] || break
		sleep 1
	done
	cat "$fixture_root/$kind/output.log"
	result="$(cat "$fixture_root/$kind/result")"
	if [ "$kind" = scope ]; then
		[ "$result" = 1 ]
		echo 'PASS: scope launcher prevents caller quiescence'
	else
		[ "$result" = 0 ]
		echo 'PASS: independent service allows unchanged production quiescence'
	fi
	for _ in $(seq 1 10); do
		if ! systemctl is-active --quiet "$unit-worker.$kind"; then break; fi
		sleep 1
	done
	! systemctl is-active --quiet "$unit-worker.$kind"
done
