#!/bin/bash
set -e

VERSION="${1:-${UPDATE_VERSION:-latest}}"
STATUS_FILE="${STATUS_FILE:-/var/lib/smart-panel/update-status.json}"
INSTALL_TYPE="${INSTALL_TYPE:-npm}"
IMAGE_BASE_DIR="${IMAGE_BASE_DIR:-/opt/smart-panel}"
DOWNLOAD_URL="${DOWNLOAD_URL:-}"
HEALTH_URL="${HEALTH_URL:-}"
HEALTH_EXPECTED_VERSION="${HEALTH_EXPECTED_VERSION:-$VERSION}"

# The attempt record and lock live beside the public status file, never inside a versioned image
# directory.  This lets the record survive a backend restart, target-directory cleanup or a
# failed migration, while keeping it outside the release tarball and private to the service user.
ATTEMPT_DIR="${ATTEMPT_DIR:-$(dirname "$STATUS_FILE")/update-attempt}"
ATTEMPT_FILE="${ATTEMPT_DIR}/attempt.json"
ATTEMPT_LOCK="${ATTEMPT_DIR}/lock"
ATTEMPT_ID=""
MIGRATION_ENTERED="false"
FINALIZED="false"
MIGRATION_LOG=""
CURRENT_PHASE="preparing"
SERVICE_NAME="smart-panel"
QUIESCENCE_TIMEOUT_SECONDS="${QUIESCENCE_TIMEOUT_SECONDS:-30}"
START_TIMEOUT_SECONDS="${START_TIMEOUT_SECONDS:-60}"
CAPTURED_SERVICE_CGROUP_PROCS=""
CAPTURED_SERVICE_CGROUP_DIR=""
CAPTURED_SERVICE_CGROUP_EVENTS=""
CAPTURED_SERVICE_MEMBER_IDENTITIES=""
CGROUP_MEMBERS=""
CGROUP_POPULATED=""

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/[[:cntrl:]]//g'
}

write_attempt() {
	local state="$1"
	local phase="$2"
	local error="${3:-}"
	local recovery_required="${4:-false}"
	local migration_entered="${5:-$MIGRATION_ENTERED}"
	local tmp_file="${ATTEMPT_FILE}.tmp.$$"
	CURRENT_PHASE="$phase"

	mkdir -p "$ATTEMPT_DIR"
	chmod 700 "$ATTEMPT_DIR"

	{
		printf '{\n'
		printf '\t"attemptId": "%s",\n' "$(json_escape "$ATTEMPT_ID")"
		printf '\t"ownerPid": %s,\n' "$$"
		printf '\t"targetVersion": "%s",\n' "$(json_escape "$VERSION")"
		printf '\t"state": "%s",\n' "$(json_escape "$state")"
		printf '\t"phase": "%s",\n' "$(json_escape "$phase")"
		printf '\t"migrationEntered": %s,\n' "$migration_entered"
		printf '\t"recoveryRequired": %s,\n' "$recovery_required"
		printf '\t"migrationLog": "%s",\n' "$(json_escape "$MIGRATION_LOG")"
		printf '\t"updatedAt": "%s",\n' "$(date -Iseconds)"
		printf '\t"error": "%s"\n' "$(json_escape "$error")"
		printf '}\n'
	} > "$tmp_file"

	chmod 600 "$tmp_file"
	mv -f "$tmp_file" "$ATTEMPT_FILE"
}

attempt_is_unresolved() {
	if [ -f "$ATTEMPT_FILE" ] && grep -q '"state": "complete"' "$ATTEMPT_FILE"; then
		# A crash after the durable completion record but before rmdir must not strand a clean
		# attempt forever; completion is the evidence that makes this lock removable.
		rmdir "$ATTEMPT_LOCK" 2>/dev/null || true

		return 1
	fi

	if [ -d "$ATTEMPT_LOCK" ]; then
		return 0
	fi

	if [ ! -f "$ATTEMPT_FILE" ]; then
		return 1
	fi

	grep -q '"state": "active"' "$ATTEMPT_FILE" || grep -q '"recoveryRequired": true' "$ATTEMPT_FILE"
}

acquire_attempt() {
	mkdir -p "$ATTEMPT_DIR"
	chmod 700 "$ATTEMPT_DIR"

	if attempt_is_unresolved; then
		return 1
	fi

	# mkdir is the portable atomic OS-level lock used by the legacy launcher.  An orphaned lock is
	# deliberately retained; an expired timestamp cannot prove that a migration did not commit.
	if ! mkdir "$ATTEMPT_LOCK" 2>/dev/null; then
		return 1
	fi
	chmod 700 "$ATTEMPT_LOCK"

	ATTEMPT_ID="$(date +%s)-$$"
	write_attempt "active" "preparing" "" "false" "false"
}

release_attempt() {
	if [ -n "$ATTEMPT_ID" ]; then
		write_attempt "complete" "complete" "" "false" "$MIGRATION_ENTERED"
	fi

	rmdir "$ATTEMPT_LOCK" 2>/dev/null || true
}

hold_attempt() {
	local phase="$1"
	local error="$2"

	write_attempt "recovery_required" "$phase" "$error" "true" "$MIGRATION_ENTERED"
}

finish_before_migration() {
	local phase="$1"
	local error="$2"

	if [ -n "${TMP_TARBALL:-}" ]; then
		rm -f "$TMP_TARBALL" 2>/dev/null || true
	fi

	write_attempt "failed_preflight" "$phase" "$error" "false" "false"
	rmdir "$ATTEMPT_LOCK" 2>/dev/null || true
}

phase_requires_hold() {
	case "$CURRENT_PHASE" in
		stopping|quiesced|switching) return 0 ;;
		*) return 1 ;;
	esac
}

fail_before_migration() {
	local phase="$1"
	local error="$2"

	if [ -n "$ATTEMPT_ID" ]; then
		finish_before_migration "$phase" "$error"
	fi

	update_status "failed" "failed" "$error"
	FINALIZED="true"
	exit 1
}

restore_before_migration() {
	local previous_target="$1"
	local current_link="$2"
	local new_version_dir="$3"
	local resolved_previous resolved_current

	[ -n "$previous_target" ] || return 1
	sudo -n ln -sfn "$previous_target" "$current_link" || return 1

	resolved_previous="$(realpath "$previous_target" 2>/dev/null || true)"
	resolved_current="$(realpath "$current_link" 2>/dev/null || true)"
	[ -n "$resolved_previous" ] && [ "$resolved_previous" = "$resolved_current" ] || return 1

	rm -rf "$new_version_dir" || return 1
	sudo -n systemctl start "$SERVICE_NAME" 2>/dev/null || return 1
	wait_for_started_service
}

service_property() {
	local property="$1"

	systemctl show "$SERVICE_NAME" --property="$property" --value
}

target_health_is_valid() {
	local payload

	[ -n "$HEALTH_URL" ] || return 1
	payload="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)" || return 1

	printf '%s' "$payload" | HEALTH_EXPECTED_VERSION="$HEALTH_EXPECTED_VERSION" node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const body = JSON.parse(input);
    const data = body && body.data;
    process.exit(data?.status === "ok" && data.version === process.env.HEALTH_EXPECTED_VERSION ? 0 : 1);
  } catch {
    process.exit(1);
  }
});
'
}

target_process_is_stable() {
	local state main_pid start_identity resolved_target expected_target

	state="$(service_property ActiveState 2>/dev/null || true)"
	main_pid="$(service_property MainPID 2>/dev/null || true)"
	start_identity="$(service_property ExecMainStartTimestampMonotonic 2>/dev/null || true)"
	resolved_target="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
	expected_target="$(realpath "$NEW_VERSION_DIR" 2>/dev/null || true)"

	[ "$state" = "active" ] || return 1
	[ "$main_pid" != "0" ] && [ -n "$main_pid" ] || return 1
	[ -n "$start_identity" ] || return 1
	[ -n "$CURRENT_LINK" ] && [ -n "$NEW_VERSION_DIR" ] || return 1
	[ -n "$expected_target" ] && [ "$resolved_target" = "$expected_target" ] || return 1
}

process_identity() {
	local pid="$1"
	local proc_root="${SERVICE_PROCESS_ROOT:-/proc}"
	local proc_dir="${proc_root}/${pid}"
	local stat_line start_time executable command

	[ "$pid" != "0" ] && [ -n "$pid" ] || return 1

	# SERVICE_PROCESS_ROOT is a private fixture hook; the production default is /proc.
	if [ -r "${proc_dir}/identity" ]; then
		printf '%s|%s\n' "$pid" "$(cat "${proc_dir}/identity")"
		return 0
	fi

	if [ -r "${proc_dir}/stat" ]; then
		stat_line="$(cat "${proc_dir}/stat")" || return 2
		start_time="$(printf '%s\n' "$stat_line" | awk '{ sub(/^.*\\) /, ""); print $20 }')" || return 2
		[ -n "$start_time" ] || return 2
		executable="$(readlink "${proc_dir}/exe" 2>/dev/null)" || return 2
		[ -n "$executable" ] || return 2
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

read_cgroup_members() {
	local cgroup_procs="$1"
	local contents members

	CGROUP_MEMBERS=""
	if ! contents="$(cat "$cgroup_procs" 2>/dev/null)"; then
		return 2
	fi

	if ! members="$(printf '%s\n' "$contents" | awk '
		length($0) > 0 {
			if ($0 !~ /^[0-9]+$/) {
				exit 2
			}
			print
		}
	')"; then
		return 2
	fi

	CGROUP_MEMBERS="$members"
}

read_cgroup_population() {
	local cgroup_events="$1"
	local contents populated

	CGROUP_POPULATED=""
	if ! contents="$(cat "$cgroup_events" 2>/dev/null)"; then
		return 2
	fi

	if ! populated="$(printf '%s\n' "$contents" | awk '
		$1 == "populated" {
			count++
			if (NF != 2 || $2 !~ /^[01]$/) {
				invalid=1
			} else {
				value=$2
			}
		}
		END {
			if (count != 1 || invalid) {
				exit 2
			}
			print value
		}
	')"; then
		return 2
	fi

	CGROUP_POPULATED="$populated"
}

probe_cgroup_directory() {
	local cgroup_dir="$1"
	local gnu_stat bsd_stat

	if gnu_stat="$(LC_ALL=C stat -c '%F' "$cgroup_dir" 2>&1)"; then
		case "$gnu_stat" in
			directory) return 0 ;;
			*) return 2 ;;
		esac
	fi

	if bsd_stat="$(LC_ALL=C stat -f '%HT' "$cgroup_dir" 2>&1)"; then
		case "$bsd_stat" in
			Directory|directory) return 0 ;;
			*) return 2 ;;
		esac
	fi

	case "$gnu_stat\n$bsd_stat" in
		*"No such file or directory"*|*"no such file or directory"*) return 1 ;;
		*) return 2 ;;
	esac
}

capture_service_identity() {
	local active_state main_pid control_pid control_group cgroup_procs cgroup_dir cgroup_events members pid identity member_status

	active_state="$(service_property ActiveState 2>/dev/null)" || return 2
	main_pid="$(service_property MainPID 2>/dev/null)" || return 2
	control_pid="$(service_property ControlPID 2>/dev/null)" || return 2
	control_group="$(service_property ControlGroup 2>/dev/null)" || return 2

	case "$active_state" in
		active|activating) ;;
		*) return 1 ;;
	esac

	[ "$main_pid" -gt 0 ] 2>/dev/null || return 1
	[ "$control_pid" = "0" ] || [ "$control_pid" -gt 0 ] 2>/dev/null || return 2
	[ -n "$control_group" ] || return 2

	cgroup_procs="${SERVICE_CGROUP_PROCS_FILE:-/sys/fs/cgroup${control_group}/cgroup.procs}"
	cgroup_dir="${SERVICE_CGROUP_DIR:-${cgroup_procs%/cgroup.procs}}"
	cgroup_events="${SERVICE_CGROUP_EVENTS_FILE:-${cgroup_dir}/cgroup.events}"
	if probe_cgroup_directory "$cgroup_dir"; then :; else return 2; fi
	[ -r "$cgroup_procs" ] || return 2
	[ -r "$cgroup_events" ] || return 2
	if read_cgroup_members "$cgroup_procs"; then
		member_status=0
	else
		member_status=$?
	fi
	[ "$member_status" -eq 0 ] || return "$member_status"
	members="$CGROUP_MEMBERS"
	[ -n "$members" ] || return 1

	CAPTURED_SERVICE_MEMBER_IDENTITIES=""
	while IFS= read -r pid; do
		[ -n "$pid" ] || continue
		identity="$(process_identity "$pid")" || return 2
		CAPTURED_SERVICE_MEMBER_IDENTITIES="${CAPTURED_SERVICE_MEMBER_IDENTITIES}${identity}\n"
	done <<EOF
$members
EOF

	printf '%s\n' "$members" | grep -qx "$main_pid" || return 1
	CAPTURED_SERVICE_CGROUP_PROCS="$cgroup_procs"
	CAPTURED_SERVICE_CGROUP_DIR="$cgroup_dir"
	CAPTURED_SERVICE_CGROUP_EVENTS="$cgroup_events"
}

service_quiesced() {
	local active_state main_pid control_pid cgroup_dir_status member_status population_status probe_status pid captured_identity current_identity identity_status

	[ -n "$CAPTURED_SERVICE_CGROUP_PROCS" ] || return 2
	active_state="$(service_property ActiveState 2>/dev/null)" || return 2
	main_pid="$(service_property MainPID 2>/dev/null)" || return 2
	control_pid="$(service_property ControlPID 2>/dev/null)" || return 2

	case "$active_state" in
		inactive|failed) ;;
		*) return 1 ;;
	esac

	[ "$main_pid" = "0" ] || return 1
	[ "$control_pid" = "0" ] || return 1

	# Check every member captured before stop independently. This catches KillMode=process
	# survivors even when systemd has already removed the original cgroup directory.
	while IFS= read -r captured_identity; do
		[ -n "$captured_identity" ] || continue
		pid="${captured_identity%%|*}"
		current_identity=""
		if current_identity="$(process_identity "$pid")"; then
			identity_status=0
		else
			identity_status=$?
		fi
		case "$identity_status" in
			0) [ "$current_identity" != "$captured_identity" ] || return 1 ;;
			1) ;;
			*) return 2 ;;
		esac
	done <<EOF
$(printf '%b' "$CAPTURED_SERVICE_MEMBER_IDENTITIES")
EOF

	# The original cgroup may be empty or removed after the service reaches inactive/failed with
	# zero MainPID/ControlPID. A missing membership file while its directory remains is an
	# unavailable probe, not proof that the subtree is empty.
	if probe_cgroup_directory "$CAPTURED_SERVICE_CGROUP_DIR"; then
		if read_cgroup_members "$CAPTURED_SERVICE_CGROUP_PROCS"; then
			member_status=0
		else
			member_status=$?
		fi
		if [ "$member_status" -eq 2 ]; then
			if probe_cgroup_directory "$CAPTURED_SERVICE_CGROUP_DIR"; then
				return 2
			else
				probe_status=$?
			fi
			[ "$probe_status" -eq 1 ] || return 2
			return 0
		fi
		[ "$member_status" -eq 0 ] || return "$member_status"
		[ -z "$CGROUP_MEMBERS" ] || return 1

		if read_cgroup_population "$CAPTURED_SERVICE_CGROUP_EVENTS"; then
			population_status=0
		else
			population_status=$?
		fi
		if [ "$population_status" -eq 2 ]; then
			if probe_cgroup_directory "$CAPTURED_SERVICE_CGROUP_DIR"; then
				return 2
			else
				probe_status=$?
			fi
			[ "$probe_status" -eq 1 ] || return 2
			return 0
		fi
		[ "$population_status" -eq 0 ] || return "$population_status"
		[ "$CGROUP_POPULATED" = "0" ] || return 1
	else
		cgroup_dir_status=$?
		case "$cgroup_dir_status" in
			1) ;;
			*) return 2 ;;
		esac
	fi

	return 0
}

wait_for_quiescence() {
	local deadline=$((SECONDS + QUIESCENCE_TIMEOUT_SECONDS))
	local result

	while [ "$SECONDS" -le "$deadline" ]; do
		if service_quiesced; then
			return 0
		else
			result=$?
		fi
		if [ "$result" -eq 2 ]; then
			return 2
		fi

		sleep 1
	done

	return 1
}

wait_for_started_service() {
	local deadline=$((SECONDS + START_TIMEOUT_SECONDS))
	local previous_main_pid=""
	local previous_start_identity=""
	local before_main_pid before_start_identity main_pid start_identity

	while [ "$SECONDS" -le "$deadline" ]; do
		if target_process_is_stable; then
			before_main_pid="$(service_property MainPID 2>/dev/null || true)"
			before_start_identity="$(service_property ExecMainStartTimestampMonotonic 2>/dev/null || true)"

			if [ "$before_main_pid" = "0" ] || [ -z "$before_main_pid" ] || [ -z "$before_start_identity" ]; then
				previous_main_pid=""
				previous_start_identity=""
				sleep 1
				continue
			fi

			if target_health_is_valid && target_process_is_stable; then
				main_pid="$(service_property MainPID 2>/dev/null || true)"
				start_identity="$(service_property ExecMainStartTimestampMonotonic 2>/dev/null || true)"

				if [ "$before_main_pid" = "$main_pid" ] &&
					[ "$before_start_identity" = "$start_identity" ]; then
					if [ "$main_pid" = "$previous_main_pid" ] &&
						[ "$start_identity" = "$previous_start_identity" ]; then
						return 0
					fi

					previous_main_pid="$main_pid"
					previous_start_identity="$start_identity"
				else
					previous_main_pid=""
					previous_start_identity=""
				fi
			else
				previous_main_pid=""
				previous_start_identity=""
			fi
		else
			previous_main_pid=""
			previous_start_identity=""
		fi

		sleep 1
	done

	return 1
}

# Capture once — used for all status writes so timeout detection works correctly
STARTED_AT="$(date -Iseconds)"

update_status() {
	local status="$1"
	local phase="$2"
	local error="${3:-}"
	local completed_at=""

	if [ "$status" = "complete" ] || [ "$status" = "failed" ]; then
		completed_at=$(date -Iseconds)
	fi

	local tmp_file="${STATUS_FILE}.tmp"

	# Use printf with %s to prevent injection in JSON values.
	# Escape double-quotes and backslashes in the error message.
	local safe_error=""
	if [ -n "$error" ]; then
		safe_error=$(printf '%s' "$error" | sed 's/\\/\\\\/g; s/"/\\"/g')
	fi

	printf '{\n\t"status": "%s",\n\t"phase": "%s",\n\t"targetVersion": "%s",\n\t"startedAt": "%s"' \
		"$status" "$phase" "$VERSION" "$STARTED_AT" > "$tmp_file"

	if [ -n "$completed_at" ]; then
		printf ',\n\t"completedAt": "%s"' "$completed_at" >> "$tmp_file"
	fi

	printf ',\n\t"error": "%s"' "$safe_error" >> "$tmp_file"
	printf '\n}\n' >> "$tmp_file"

	mv "$tmp_file" "$STATUS_FILE"
}

cleanup() {
	local exit_code=$?

	if [ "$exit_code" -ne 0 ] && [ "$FINALIZED" != "true" ]; then
		if [ -n "$ATTEMPT_ID" ] && { [ "$MIGRATION_ENTERED" = "true" ] || phase_requires_hold; }; then
				hold_attempt "interrupted" "Update worker exited with code $exit_code during a state-changing phase"
		elif [ -n "$ATTEMPT_ID" ]; then
			finish_before_migration "failed" "Update process exited with code $exit_code"
		fi

		# Only write a generic failure if a specific error wasn't already recorded
		if [ -f "$STATUS_FILE" ] && grep -q '"status": "failed"' "$STATUS_FILE" 2>/dev/null; then
			return
		fi
		update_status "failed" "failed" "Update process exited with code $exit_code"
	fi
}

trap cleanup EXIT

handle_signal() {
	local signal_name="$1"
	local signal_code="$2"

	if [ -n "$ATTEMPT_ID" ]; then
		if [ "$MIGRATION_ENTERED" = "true" ] || phase_requires_hold; then
			hold_attempt "interrupted" "Update worker received SIG${signal_name} after migration entry"
		else
			finish_before_migration "interrupted" "Update worker received SIG${signal_name} before migration entry"
		fi
	fi

	update_status "failed" "failed" "Update worker received SIG${signal_name}"
	FINALIZED="true"
	exit "$signal_code"
}

trap 'handle_signal TERM 143' TERM
trap 'handle_signal INT 130' INT
trap 'handle_signal HUP 129' HUP

# ──────────────────────────────────────────────────────────────
# Image-based update (Raspbian image installs)
# ──────────────────────────────────────────────────────────────
if [ "$INSTALL_TYPE" = "image" ]; then
	# Strip leading 'v' prefix if present to avoid double-prefixed dirs like vv1.0.0
	CLEAN_VERSION="${VERSION#v}"
	NEW_VERSION_DIR="${IMAGE_BASE_DIR}/v${CLEAN_VERSION}"
	CURRENT_LINK="${IMAGE_BASE_DIR}/current"

	# Image updates must verify the target release through the existing local health route. A
	# missing route would otherwise silently reduce readiness to a PID check and reintroduce the
	# startup/worker circular wait that the updater is designed to avoid.
	if [ -z "$HEALTH_URL" ]; then
		update_status "failed" "failed" "No local health URL configured for image update"
		FINALIZED="true"
		exit 1
	fi

	if ! acquire_attempt; then
		update_status "failed" "failed" "An unresolved update attempt already owns the updater"
		FINALIZED="true"
		exit 1
	fi

	# Verify passwordless sudo is available for all required commands.
	# Without -n, sudo may hang waiting for a password on a detached process.
	SUDO_CMDS=(
		"/usr/bin/true"
		"/usr/bin/systemctl stop smart-panel"
		"/usr/bin/systemctl start smart-panel"
		"/usr/bin/chown -R smart-panel:smart-panel ${NEW_VERSION_DIR}"
		"/usr/bin/ln -sfn ${NEW_VERSION_DIR} ${CURRENT_LINK}"
	)

	for cmd in "${SUDO_CMDS[@]}"; do
		if ! sudo -n -l $cmd >/dev/null 2>&1; then
			fail_before_migration "preflight" "Passwordless sudo not available for: $cmd"
		fi
	done
	PREVIOUS_TARGET=""

	# Save the current version for rollback
	if [ -L "$CURRENT_LINK" ]; then
		PREVIOUS_TARGET=$(readlink "$CURRENT_LINK")
		case "$PREVIOUS_TARGET" in
			/*) ;;
			*) PREVIOUS_TARGET="${IMAGE_BASE_DIR}/${PREVIOUS_TARGET}" ;;
		esac
	fi

	# Guard: refuse to overwrite the currently running version
	# Resolve relative to IMAGE_BASE_DIR since PREVIOUS_TARGET may be relative
	RESOLVED_PREV=$(cd "$IMAGE_BASE_DIR" && realpath "$PREVIOUS_TARGET" 2>/dev/null || true)
	RESOLVED_NEW=$(cd "$IMAGE_BASE_DIR" && realpath "$NEW_VERSION_DIR" 2>/dev/null || true)

	if [ -n "$PREVIOUS_TARGET" ] && [ -n "$RESOLVED_PREV" ] && [ -n "$RESOLVED_NEW" ] && [ "$RESOLVED_PREV" = "$RESOLVED_NEW" ]; then
		fail_before_migration "preflight" "Target version v${CLEAN_VERSION} is already the active version"
	fi

	# ── Download ──
	update_status "downloading" "downloading"

	if [ -z "$DOWNLOAD_URL" ]; then
		fail_before_migration "downloading" "No download URL provided for image update"
	fi

	TMP_TARBALL="/tmp/smart-panel-backend-v${CLEAN_VERSION}.tar.gz"

	curl -fSL -o "$TMP_TARBALL" "$DOWNLOAD_URL" 2>&1 || {
		fail_before_migration "downloading" "Download failed from ${DOWNLOAD_URL}"
	}

	# ── Extract ──
	update_status "installing" "installing"

	mkdir -p "$NEW_VERSION_DIR"

	tar -xzf "$TMP_TARBALL" -C "$NEW_VERSION_DIR" 2>&1 || {
		rm -rf "$NEW_VERSION_DIR"
		rm -f "$TMP_TARBALL"
		fail_before_migration "installing" "Failed to extract update archive"
	}

	rm -f "$TMP_TARBALL"

	# Create the image-install marker in the new version
	touch "${NEW_VERSION_DIR}/.image-install" || {
		rm -rf "$NEW_VERSION_DIR"
		fail_before_migration "installing" "Failed to create image-install marker"
	}

	# ── Verify dependencies ──
	cd "$NEW_VERSION_DIR"

	# The release tarball includes pre-built node_modules with native modules
	# compiled for ARM64 by the CI arm-runner. Only install as fallback if
	# node_modules is missing (e.g. manually extracted tarball without deps).
	if [ ! -d "node_modules" ]; then
		npm install --omit=dev 2>&1 || {
			rm -rf "$NEW_VERSION_DIR"
			fail_before_migration "installing" "npm install failed"
		}
	fi

	# Set ownership
	# All sudo calls use -n (non-interactive) to fail fast instead of
	# hanging on password prompt when running as a detached process.
	sudo -n chown -R smart-panel:smart-panel "$NEW_VERSION_DIR" || {
		rm -rf "$NEW_VERSION_DIR"
		fail_before_migration "installing" "Failed to set ownership on ${NEW_VERSION_DIR}"
	}

	# ── Stop service ──
	update_status "stopping" "stopping"
	write_attempt "active" "stopping" "" "false" "$MIGRATION_ENTERED"
	if ! capture_service_identity; then
		hold_attempt "stopping" "Could not capture service process/cgroup identity before stop"
		update_status "failed" "failed" "Service process/cgroup identity could not be captured; update is held for recovery"
		FINALIZED="true"
		exit 1
	fi

	if ! sudo -n systemctl stop "$SERVICE_NAME" 2>/dev/null; then
		hold_attempt "stopping" "Service stop failed; writer quiescence is unknown"
		update_status "failed" "failed" "Could not stop ${SERVICE_NAME}; update is held for recovery"
		FINALIZED="true"
		exit 1
	fi

	if ! wait_for_quiescence; then
		hold_attempt "stopping" "Service did not reach verified quiescence before migration"
		update_status "failed" "failed" "Service quiescence could not be verified; update is held for recovery"
		FINALIZED="true"
		exit 1
	fi

	write_attempt "active" "quiesced" "" "false" "$MIGRATION_ENTERED"

	# ── Switch symlink (atomic on same filesystem) ──
	sudo -n ln -sfn "$NEW_VERSION_DIR" "$CURRENT_LINK" || {
		# Revert only when the old link, target cleanup and old-service health are all verified.
		if restore_before_migration "$PREVIOUS_TARGET" "$CURRENT_LINK" "$NEW_VERSION_DIR"; then
			fail_before_migration "switching" "Failed to switch version symlink"
		fi

		hold_attempt "switching" "Failed to switch version symlink and recovery start was not verified"
		update_status "failed" "failed" "Failed to switch version symlink; update is held for recovery"
		FINALIZED="true"
		exit 1
	}

	# ── Run database migrations ──
	update_status "migrating" "migrating"
	ENV_FILE="/etc/smart-panel/environment"

	if [ ! -f "${NEW_VERSION_DIR}/dist/dataSource.js" ]; then
		hold_attempt "migrating" "Target data source is missing; update is held for recovery"
		update_status "failed" "failed" "Target data source is missing; update is held for recovery"
		FINALIZED="true"
		exit 1
	fi

	MIGRATION_ENTERED="true"
	if ! write_attempt "active" "migrating" "" "false" "true"; then
		hold_attempt "migrating" "Could not persist migration-entry checkpoint"
		update_status "failed" "failed" "Could not persist migration-entry checkpoint; update is held for recovery"
		FINALIZED="true"
		exit 1
	fi

	MIGRATION_LOG="${ATTEMPT_DIR}/${ATTEMPT_ID}.migration.log"
	: > "$MIGRATION_LOG"
	chmod 600 "$MIGRATION_LOG"
	write_attempt "active" "migrating" "" "false" "true"

	set +e
	(
		set -a
		# shellcheck source=/dev/null
		[ -f "$ENV_FILE" ] && . "$ENV_FILE"
		set +a
		cd "$NEW_VERSION_DIR"
		node node_modules/typeorm/cli.js migration:run -d dist/dataSource.js
	) 2>&1 | awk -v output="$MIGRATION_LOG" '
		BEGIN { limit = 65536; bytes = 0 }
		{
			if (bytes < limit) {
				line = $0 ORS;
				remaining = limit - bytes;
				if (length(line) > remaining) line = substr(line, 1, remaining);
				printf "%s", line >> output;
				bytes += length(line);
			}
		}
	'
	pipeline_status=("${PIPESTATUS[@]}")
	migration_exit_code="${pipeline_status[0]}"
	capture_exit_code="${pipeline_status[1]}"
	set -e

	if [ "$capture_exit_code" -ne 0 ]; then
		hold_attempt "migration_capture_failed" "Could not retain bounded migration diagnostics"
		update_status "failed" "failed" "Migration diagnostics could not be retained; update is held for recovery"
		FINALIZED="true"
		exit 1
	fi

	if [ "$migration_exit_code" -eq 0 ]; then
		write_attempt "active" "migrated" "" "false" "true"
	else
		hold_attempt "migration_failed" "Database migration failed with exit code ${migration_exit_code}"
		update_status "failed" "failed" "Database migration failed; update is held for recovery"
		FINALIZED="true"
		exit "$migration_exit_code"
	fi

	# ── Start service ──
	update_status "starting" "starting"
	write_attempt "active" "starting" "" "false" "true"
	if ! sudo -n systemctl start "$SERVICE_NAME" 2>&1 || ! wait_for_started_service; then
		hold_attempt "start_failed" "Target service did not reach verified health after migration"
		update_status "failed" "failed" "Target service failed to start or become healthy; update is held for recovery"
		FINALIZED="true"
		exit 1
	fi

	# ── Cleanup old versions (keep max 2 previous) ──
	cd "$IMAGE_BASE_DIR"

	# Use the known current version rather than re-reading the symlink,
	# so cleanup is safe even if readlink fails unexpectedly
	CURRENT_BASENAME="v${CLEAN_VERSION}"

	if [ -n "$CURRENT_BASENAME" ]; then
		# Only match semver-versioned directories (v<digits>.<digits>.<digits>*)
		# to avoid accidentally deleting unrelated v-prefixed directories
		# shellcheck disable=SC2010
		OLD_VERSIONS=$(ls -d v[0-9]*.[0-9]*.[0-9]*/ 2>/dev/null | grep -v "^${CURRENT_BASENAME}/" | sort -V | head -n -2 || true)

		for old_dir in $OLD_VERSIONS; do
			rm -rf "${IMAGE_BASE_DIR}/${old_dir}"
		done
	fi

	# ── Mark complete ──
	release_attempt
	update_status "complete" "complete"
	FINALIZED="true"
	trap - EXIT
	exit 0
fi

# ──────────────────────────────────────────────────────────────
# NPM-based update (global npm installs)
# ──────────────────────────────────────────────────────────────

# Downloading / preparing
update_status "downloading" "downloading"

# Stop the service
update_status "stopping" "stopping"
sudo -n systemctl stop smart-panel 2>/dev/null || true

# Install the update
update_status "installing" "installing"

if [ "$VERSION" = "latest" ]; then
	sudo -n npm update -g @fastybird/smart-panel 2>&1 || {
		update_status "failed" "failed" "npm update failed"
		sudo -n systemctl start smart-panel 2>/dev/null || true
		exit 1
	}
else
	sudo -n npm install -g "@fastybird/smart-panel@$VERSION" 2>&1 || {
		update_status "failed" "failed" "npm install failed for version $VERSION"
		sudo -n systemctl start smart-panel 2>/dev/null || true
		exit 1
	}
fi

# Run database migrations
update_status "migrating" "migrating"

DATA_DIR="${FB_DATA_DIR:-/var/lib/smart-panel}"
DB_PATH="${FB_DB_PATH:-${DATA_DIR}/data}"

if [ -f "$(npm root -g)/@fastybird/smart-panel/dataSource.js" ]; then
	node "$(npm root -g)/@fastybird/smart-panel/node_modules/typeorm/cli.js" \
		migration:run \
		-d "$(npm root -g)/@fastybird/smart-panel/dataSource.js" 2>&1 || {
		update_status "failed" "failed" "Database migration failed"
		sudo -n systemctl start smart-panel 2>/dev/null || true
		exit 1
	}
fi

# Start the service
update_status "starting" "starting"
sudo -n systemctl start smart-panel 2>&1 || {
	update_status "failed" "failed" "Failed to start service after update"
	exit 1
}

# Mark as complete
update_status "complete" "complete"

# Remove the exit trap since we completed successfully
trap - EXIT

exit 0
