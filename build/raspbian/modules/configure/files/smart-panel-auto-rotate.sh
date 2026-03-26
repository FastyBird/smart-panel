#!/usr/bin/env bash
#
# Smart Panel Auto-Rotate
#
# Usage:
#   smart-panel-auto-rotate enable      Enable auto-rotation and start the daemon
#   smart-panel-auto-rotate disable     Disable auto-rotation and stop the daemon
#   smart-panel-auto-rotate status      Show current auto-rotation status
#   smart-panel-auto-rotate daemon      Run the monitoring daemon (used by systemd)
#
# Monitors the reTerminal CM4 built-in accelerometer (LIS3DHTR) and
# automatically rotates the display by restarting flutter-pi with the
# appropriate -r flag.
#
# Requirements:
#   - reTerminal CM4 hardware (accelerometer at /sys/devices/platform/lis3lv02d/position)
#
set -euo pipefail

LOG_TAG="smart-panel-auto-rotate"
DISPLAY_CONFIG="/etc/smart-panel/display"
ACCEL_PATH="/sys/devices/platform/lis3lv02d/position"
DISPLAY_SERVICE="smart-panel-display.service"
AUTO_ROTATE_SERVICE="smart-panel-auto-rotate.service"

# ── Helpers ──────────────────────────────────────────────────────────
log_info() { logger -t "$LOG_TAG" "$*"; }
log_err()  { logger -t "$LOG_TAG" -p user.err "$*"; }

# Read the current FB_DISPLAY_ROTATION from the config file.
# Returns empty string if not set.
read_current_rotation() {
	if [ -f "$DISPLAY_CONFIG" ]; then
		grep -E '^FB_DISPLAY_ROTATION=' "$DISPLAY_CONFIG" 2>/dev/null \
			| tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs \
			|| true
	fi
}

# Read the current FB_AUTO_ROTATE value from the config file.
read_auto_rotate_flag() {
	if [ -f "$DISPLAY_CONFIG" ]; then
		grep -E '^FB_AUTO_ROTATE=' "$DISPLAY_CONFIG" 2>/dev/null \
			| tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs \
			|| true
	fi
}

# Set a config value in the display config file.
# Usage: set_config_value KEY VALUE
set_config_value() {
	local key="$1" value="$2"

	if grep -qE "^${key}=" "$DISPLAY_CONFIG" 2>/dev/null; then
		sed -i "s/^${key}=.*/${key}=${value}/" "$DISPLAY_CONFIG"
	else
		echo "${key}=${value}" >> "$DISPLAY_CONFIG"
	fi
}

# Compute orientation from raw accelerometer (x, y, z in mg).
# Returns rotation degrees: 0, 90, 180, 270 — or "unknown".
#
# The reTerminal CM4 default landscape orientation (USB ports down) is 0°.
# Orientation mapping:
#   landscape          (x dominant, positive)  → 0
#   portrait           (y dominant, positive)  → 90
#   landscape_inverted (x dominant, negative)  → 180
#   portrait_inverted  (y dominant, negative)  → 270
#   face_up / face_down (z dominant)           → unchanged (unknown)
compute_rotation() {
	local x="$1" y="$2" z="$3"

	local abs_x abs_y abs_z
	abs_x=${x#-}
	abs_y=${y#-}
	abs_z=${z#-}

	# If Z axis is dominant the device is flat — keep current rotation
	if [ "$abs_z" -gt "$abs_x" ] && [ "$abs_z" -gt "$abs_y" ]; then
		echo "unknown"
		return
	fi

	# Ignore readings below threshold (device might be in transition)
	if [ "$abs_x" -lt "$THRESHOLD" ] && [ "$abs_y" -lt "$THRESHOLD" ]; then
		echo "unknown"
		return
	fi

	if [ "$abs_x" -gt "$abs_y" ]; then
		if [ "$x" -gt 0 ]; then
			echo "0"
		else
			echo "180"
		fi
	else
		if [ "$y" -gt 0 ]; then
			echo "90"
		else
			echo "270"
		fi
	fi
}

# ── Commands ─────────────────────────────────────────────────────────

cmd_enable() {
	if [ ! -f "$ACCEL_PATH" ]; then
		echo "Error: Accelerometer not found. Auto-rotate requires reTerminal CM4 hardware."
		exit 1
	fi

	if [ ! -f "$DISPLAY_CONFIG" ]; then
		echo "Error: Display config not found at $DISPLAY_CONFIG"
		exit 1
	fi

	set_config_value "FB_AUTO_ROTATE" "1"

	systemctl enable "$AUTO_ROTATE_SERVICE" 2>/dev/null || true
	systemctl restart "$AUTO_ROTATE_SERVICE" 2>/dev/null || true

	echo "Auto-rotate enabled. The display will now follow device orientation."
}

cmd_disable() {
	if [ ! -f "$DISPLAY_CONFIG" ]; then
		echo "Error: Display config not found at $DISPLAY_CONFIG"
		exit 1
	fi

	set_config_value "FB_AUTO_ROTATE" "0"

	systemctl stop "$AUTO_ROTATE_SERVICE" 2>/dev/null || true
	systemctl disable "$AUTO_ROTATE_SERVICE" 2>/dev/null || true

	echo "Auto-rotate disabled."
}

cmd_status() {
	local flag
	flag="$(read_auto_rotate_flag)"

	if [ "${flag:-0}" = "1" ]; then
		echo "Auto-rotate: enabled"
	else
		echo "Auto-rotate: disabled"
	fi

	local rotation
	rotation="$(read_current_rotation)"
	echo "Current rotation: ${rotation:-0}°"

	if [ -f "$ACCEL_PATH" ]; then
		echo "Accelerometer: detected"
		local raw
		raw=$(cat "$ACCEL_PATH" 2>/dev/null) || true
		echo "Raw position: ${raw:-unknown}"
	else
		echo "Accelerometer: not found"
	fi

	if systemctl is-active --quiet "$AUTO_ROTATE_SERVICE" 2>/dev/null; then
		echo "Service: running"
	else
		echo "Service: stopped"
	fi
}

cmd_daemon() {
	# ── Pre-flight checks ───────────────────────────────────────────
	# Source the config to pick up FB_AUTO_ROTATE (may also be set via
	# the systemd EnvironmentFile, but we read it ourselves so the
	# daemon works correctly when launched manually too).
	if [ -f "$DISPLAY_CONFIG" ]; then
		set -a
		# shellcheck source=/dev/null
		. "$DISPLAY_CONFIG"
		set +a
	else
		log_err "Display config not found at $DISPLAY_CONFIG"
		exit 1
	fi

	if [ "${FB_AUTO_ROTATE:-0}" != "1" ]; then
		log_info "Auto-rotate is disabled (FB_AUTO_ROTATE=${FB_AUTO_ROTATE:-0}). Enable it with: smart-panel-auto-rotate enable"
		exit 0
	fi

	if [ ! -f "$ACCEL_PATH" ]; then
		log_err "Accelerometer not found at $ACCEL_PATH — is this a reTerminal CM4?"
		exit 1
	fi

	# Resolve tunables now that the config has been sourced
	POLL_INTERVAL="${FB_AUTO_ROTATE_POLL_INTERVAL:-1}"
	DEBOUNCE_COUNT="${FB_AUTO_ROTATE_DEBOUNCE:-3}"
	THRESHOLD="${FB_AUTO_ROTATE_THRESHOLD:-400}"

	log_info "Auto-rotate daemon starting (poll=${POLL_INTERVAL}s, debounce=${DEBOUNCE_COUNT}, threshold=${THRESHOLD}mg)"

	# ── Main loop ────────────────────────────────────────────────────
	local current_rotation
	current_rotation="$(read_current_rotation)"
	current_rotation="${current_rotation:-0}"
	local pending_rotation=""
	local pending_count=0

	log_info "Current rotation: ${current_rotation}°"

	while true; do
		sleep "$POLL_INTERVAL"

		# Read raw accelerometer: format "(x,y,z)" in mg
		local raw
		raw=$(cat "$ACCEL_PATH" 2>/dev/null) || continue
		local parsed
		parsed=$(echo "$raw" | sed 's/[()]//g' | tr ',' ' ')
		local x y z
		read -r x y z <<< "$parsed" || continue

		# Validate we got three non-empty integers
		if [ -z "$x" ] || [ -z "$y" ] || [ -z "$z" ]; then
			continue
		fi
		case "$x$y$z" in
			*[!0-9-]*) continue ;;
		esac

		local rotation
		rotation=$(compute_rotation "$x" "$y" "$z")

		# Skip unknown orientations (flat or transitional)
		if [ "$rotation" = "unknown" ]; then
			pending_count=0
			pending_rotation=""
			continue
		fi

		# Same as current — reset debounce
		if [ "$rotation" = "$current_rotation" ]; then
			pending_count=0
			pending_rotation=""
			continue
		fi

		# New or continuing pending rotation
		if [ "$rotation" = "$pending_rotation" ]; then
			pending_count=$((pending_count + 1))
		else
			pending_rotation="$rotation"
			pending_count=1
		fi

		# Debounce threshold reached — apply rotation
		if [ "$pending_count" -ge "$DEBOUNCE_COUNT" ]; then
			log_info "Orientation changed: ${current_rotation}° → ${rotation}°"

			set_config_value "FB_DISPLAY_ROTATION" "$rotation"
			current_rotation="$rotation"
			pending_count=0
			pending_rotation=""

			log_info "Restarting $DISPLAY_SERVICE"
			systemctl restart "$DISPLAY_SERVICE" || log_err "Failed to restart $DISPLAY_SERVICE"

			# Give the display service time to start before resuming polling
			sleep 3
		fi
	done
}

cmd_usage() {
	echo "Usage: smart-panel-auto-rotate <command>"
	echo ""
	echo "Commands:"
	echo "  enable      Enable auto-rotation and start the daemon"
	echo "  disable     Disable auto-rotation and stop the daemon"
	echo "  status      Show current auto-rotation status"
	echo "  daemon      Run the monitoring daemon (used by systemd)"
	echo ""
	echo "Examples:"
	echo "  sudo smart-panel-auto-rotate enable"
	echo "  sudo smart-panel-auto-rotate disable"
	echo "  smart-panel-auto-rotate status"
}

# ── Entry point ──────────────────────────────────────────────────────
case "${1:-}" in
	enable)  cmd_enable ;;
	disable) cmd_disable ;;
	status)  cmd_status ;;
	daemon)  cmd_daemon ;;
	-h|--help|help)
		cmd_usage ;;
	*)
		cmd_usage
		exit 1
		;;
esac
