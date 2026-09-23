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

process_identity() {
	local pid="$1"
	local stat_line start_time executable command

	if [ -r "/proc/${pid}/stat" ]; then
		stat_line="$(cat "/proc/${pid}/stat")" || return 2
		start_time="$(printf '%s\n' "$stat_line" | awk '{ sub(/^.*\\) /, ""); print $20 }')" || return 2
		executable="$(readlink "/proc/${pid}/exe" 2>/dev/null)" || return 2
		[ -n "$start_time" ] && [ -n "$executable" ] || return 2
		printf '%s|%s|%s\n' "$pid" "$start_time" "$executable"
		return 0
	fi

	if ! kill -0 "$pid" 2>/dev/null; then
		return 1
	fi

	command="$(ps -p "$pid" -o command= 2>/dev/null)" || return 2
	[ -n "$command" ] || return 2
	printf '%s|%s\n' "$pid" "$command"
}

case_status() {
	local unit="$1"
	local state

	for _ in $(seq 1 20); do
		state="$(systemctl --user show "$unit" --property=ActiveState --value 2>/dev/null || true)"
		if [ "$state" = "active" ] || [ "$state" = "inactive" ] || [ "$state" = "failed" ]; then
			printf '%s\n' "$state"
			return 0
		fi
		sleep 1
	done

	return 1
}

manager_processes_empty() {
	local output count
	command -v busctl >/dev/null 2>&1 || return 77
	output="$(busctl --user call org.freedesktop.systemd1 /org/freedesktop/systemd1 \
		org.freedesktop.systemd1.Manager GetUnitProcesses s "$1" 2>/dev/null)" || return 2
	count="$(printf '%s\n' "$output" | awk '{ for (i = 1; i <= NF; i++) if ($i == "a(sus)") { print $(i + 1); exit } }')"
	if [ -z "$count" ]; then return 2; fi
	if [ "$count" -gt 0 ] 2>/dev/null; then
		return 1
	fi
	return 0
}

run_case() {
	local kill_mode="$1"
	local unit="smart-panel-update-fixture-${kill_mode}-$$"
	local main_pid control_pid control_group cgroup_dir cgroup_procs cgroup_events state current_members populated
	local captured_identities="" captured_identity pid current_identity survivor=0

	cleanup_case() {
		local cleanup_pid cleanup_identity

		while IFS= read -r captured_identity; do
			[ -n "$captured_identity" ] || continue
			cleanup_pid="${captured_identity%%|*}"
			cleanup_identity="$(process_identity "$cleanup_pid" 2>/dev/null || true)"
			if [ "$cleanup_identity" = "$captured_identity" ]; then
				kill -KILL "$cleanup_pid" 2>/dev/null || true
			fi
		done <<EOF
$(printf '%b' "$captured_identities")
EOF
		systemctl --user stop "$unit" >/dev/null 2>&1 || true
		systemctl --user reset-failed "$unit" >/dev/null 2>&1 || true
	}

	trap cleanup_case RETURN
	systemd-run --user --unit="$unit" --property="KillMode=$kill_mode" /bin/sh -c 'sleep 300 & wait' >/dev/null
	[ "$(case_status "$unit")" = "active" ]
	main_pid="$(systemctl --user show "$unit" --property=MainPID --value)"
	control_pid="$(systemctl --user show "$unit" --property=ControlPID --value)"
	[ "$main_pid" -gt 0 ]
	[ "$control_pid" = "0" ]

	control_group="$(systemctl --user show "$unit" --property=ControlGroup --value)"
	[ -n "$control_group" ]
	cgroup_dir="/sys/fs/cgroup${control_group}"
	cgroup_procs="/sys/fs/cgroup${control_group}/cgroup.procs"
	cgroup_events="/sys/fs/cgroup${control_group}/cgroup.events"
	[ -d "$cgroup_dir" ]
	[ -r "$cgroup_procs" ]
	[ -r "$cgroup_events" ]
	current_members="$(awk 'length($0) > 0 { if ($0 !~ /^[0-9]+$/) exit 2; print }' "$cgroup_procs")"
	[ -n "$current_members" ]
	printf '%s\n' "$current_members" | grep -qx "$main_pid"

	while IFS= read -r pid; do
		[ -n "$pid" ] || continue
		captured_identity="$(process_identity "$pid")" || return 2
		captured_identities="${captured_identities}${captured_identity}\\n"
	done <<EOF
$current_members
EOF

	systemctl --user stop "$unit"
	state="$(case_status "$unit")"
	[ "$state" = "inactive" ] || [ "$state" = "failed" ]
	main_pid="$(systemctl --user show "$unit" --property=MainPID --value 2>/dev/null || true)"
	control_pid="$(systemctl --user show "$unit" --property=ControlPID --value 2>/dev/null || true)"
	[ "$main_pid" = "0" ]
	[ "$control_pid" = "0" ]
	manager_processes_empty "$unit"

	while IFS= read -r captured_identity; do
		[ -n "$captured_identity" ] || continue
		pid="${captured_identity%%|*}"
		current_identity=""
		if current_identity="$(process_identity "$pid" 2>/dev/null)"; then
			[ "$current_identity" != "$captured_identity" ] || survivor=1
		else
			case "$?" in
				1) ;;
				*) return 2 ;;
			esac
		fi
	done <<EOF
$(printf '%b' "$captured_identities")
EOF

	if [ -d "$cgroup_dir" ]; then
		[ -r "$cgroup_procs" ] || return 2
		[ -r "$cgroup_events" ] || return 2
		current_members="$(awk 'length($0) > 0 { if ($0 !~ /^[0-9]+$/) exit 2; print }' "$cgroup_procs")"
		[ -z "$current_members" ] || survivor=1
		populated="$(awk '$1 == "populated" { count++; if (NF != 2 || $2 !~ /^[01]$/) invalid=1; else value=$2 } END { if (count != 1 || invalid) exit 2; print value }' "$cgroup_events")"
		[ "$populated" = "0" ] || survivor=1
	fi

	if [ "$kill_mode" = "control-group" ]; then
		[ "$survivor" -eq 0 ] || return 1
		echo "PASS: KillMode=control-group stopped with empty/removed original cgroup"
	else
		[ "$survivor" -eq 1 ] || return 1
		echo "PASS: KillMode=process retained a captured child and independent checks rejected quiescence"
	fi
}

run_case control-group
run_case process
echo "PASS: systemd stop/readback/cgroup ownership and cleanup contract"
