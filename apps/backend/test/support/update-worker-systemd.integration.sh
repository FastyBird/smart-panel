#!/bin/bash
set -Eeuo pipefail

# This test is intentionally separate from the macOS/Jest fixture. It exercises the real user
# systemd process/cgroup contract without a Smart Panel database, release archive or staging host.
# Exit 77 means the disposable systemd environment is unavailable; callers must report that gate
# as unfulfilled rather than treating the fixture mocks as systemd evidence.
if [ "$(uname -s)" != "Linux" ] || ! command -v systemd-run >/dev/null 2>&1 || ! command -v systemctl >/dev/null 2>&1; then
	echo "SKIP: Linux systemd is unavailable"
	exit 77
fi

if ! systemctl --user is-system-running >/dev/null 2>&1; then
	echo "SKIP: the current user has no running systemd manager"
	exit 77
fi

UNIT="smart-panel-update-fixture-$$"

cleanup() {
	systemctl --user stop "$UNIT" >/dev/null 2>&1 || true
	systemctl --user reset-failed "$UNIT" >/dev/null 2>&1 || true
}

trap cleanup EXIT

systemd-run --user --unit="$UNIT" --collect /bin/sh -c 'sleep 300' >/dev/null

for _ in $(seq 1 20); do
	if [ "$(systemctl --user show "$UNIT" --property=ActiveState --value 2>/dev/null || true)" = "active" ]; then
		break
	fi
	sleep 1
done

[ "$(systemctl --user show "$UNIT" --property=ActiveState --value)" = "active" ]
main_pid="$(systemctl --user show "$UNIT" --property=MainPID --value)"
[ "$main_pid" -gt 0 ]

control_group="$(systemctl --user show "$UNIT" --property=ControlGroup --value)"
cgroup_procs="/sys/fs/cgroup${control_group}/cgroup.procs"
[ -r "$cgroup_procs" ]
grep -q "^${main_pid}$" "$cgroup_procs"

systemctl --user stop "$UNIT"
for _ in $(seq 1 20); do
	state="$(systemctl --user show "$UNIT" --property=ActiveState --value 2>/dev/null || true)"
	if [ "$state" = "inactive" ] || [ "$state" = "failed" ]; then
		break
	fi
	sleep 1
done

state="$(systemctl --user show "$UNIT" --property=ActiveState --value 2>/dev/null || true)"
[ "$state" = "inactive" ] || [ "$state" = "failed" ]

if [ ! -r "$cgroup_procs" ]; then
	echo "FAIL: service cgroup process list is missing or unreadable after stop" >&2
	exit 1
fi

if grep -q '[0-9]' "$cgroup_procs"; then
	echo "FAIL: service cgroup retained a writer after stop" >&2
	exit 1
fi

echo "PASS: systemd stop/readback/cgroup ownership and cleanup contract"
