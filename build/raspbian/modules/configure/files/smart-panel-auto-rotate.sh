#!/usr/bin/env bash
#
# Smart Panel Auto-Rotate Daemon
#
# Monitors the reTerminal CM4 built-in accelerometer (LIS3DHTR) and
# automatically rotates the display by restarting flutter-pi with the
# appropriate -r flag.
#
# Requirements:
#   - reTerminal CM4 hardware (accelerometer at /sys/devices/platform/lis3lv02d/position)
#   - FB_AUTO_ROTATE=1 in /etc/smart-panel/display
#
# The script reads raw accelerometer data, computes orientation, and when
# a stable orientation change is detected (after debounce), updates
# FB_DISPLAY_ROTATION in /etc/smart-panel/display and restarts the
# smart-panel-display service.
#
set -euo pipefail

LOG_TAG="smart-panel-auto-rotate"
DISPLAY_CONFIG="/etc/smart-panel/display"
ACCEL_PATH="/sys/devices/platform/lis3lv02d/position"
DISPLAY_SERVICE="smart-panel-display.service"

# ── Tunables ─────────────────────────────────────────────────────────
# How often to poll the accelerometer (seconds)
POLL_INTERVAL="${FB_AUTO_ROTATE_POLL_INTERVAL:-1}"
# Number of consecutive identical readings before committing a rotation
DEBOUNCE_COUNT="${FB_AUTO_ROTATE_DEBOUNCE:-3}"
# Minimum axis magnitude (in mg) to consider a valid tilt
THRESHOLD="${FB_AUTO_ROTATE_THRESHOLD:-400}"

# ── Helpers ──────────────────────────────────────────────────────────
log_info() { logger -t "$LOG_TAG" "$*"; }
log_err()  { logger -t "$LOG_TAG" -p user.err "$*"; }

# Read the current FB_DISPLAY_ROTATION from the config file.
# Returns empty string if not set.
read_current_rotation() {
	if [ -f "$DISPLAY_CONFIG" ]; then
		grep -E '^FB_DISPLAY_ROTATION=' "$DISPLAY_CONFIG" 2>/dev/null \
			| tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs
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

# Update FB_DISPLAY_ROTATION in the config file
update_rotation_config() {
	local new_rotation="$1"

	if grep -qE '^FB_DISPLAY_ROTATION=' "$DISPLAY_CONFIG" 2>/dev/null; then
		sed -i "s/^FB_DISPLAY_ROTATION=.*/FB_DISPLAY_ROTATION=${new_rotation}/" "$DISPLAY_CONFIG"
	else
		echo "FB_DISPLAY_ROTATION=${new_rotation}" >> "$DISPLAY_CONFIG"
	fi
}

# ── Pre-flight checks ───────────────────────────────────────────────
if [ ! -f "$ACCEL_PATH" ]; then
	log_err "Accelerometer not found at $ACCEL_PATH — is this a reTerminal CM4?"
	exit 1
fi

if [ ! -f "$DISPLAY_CONFIG" ]; then
	log_err "Display config not found at $DISPLAY_CONFIG"
	exit 1
fi

log_info "Auto-rotate daemon starting (poll=${POLL_INTERVAL}s, debounce=${DEBOUNCE_COUNT}, threshold=${THRESHOLD}mg)"

# ── Main loop ────────────────────────────────────────────────────────
current_rotation="$(read_current_rotation)"
current_rotation="${current_rotation:-0}"
pending_rotation=""
pending_count=0

log_info "Current rotation: ${current_rotation}°"

while true; do
	sleep "$POLL_INTERVAL"

	# Read raw accelerometer: format "(x,y,z)" in mg
	raw=$(cat "$ACCEL_PATH" 2>/dev/null) || continue
	parsed=$(echo "$raw" | sed 's/[()]//g' | tr ',' ' ')
	read -r x y z <<< "$parsed" || continue

	# Validate we got integers
	case "$x$y$z" in
		*[!0-9-]*) continue ;;
	esac

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

		update_rotation_config "$rotation"
		current_rotation="$rotation"
		pending_count=0
		pending_rotation=""

		log_info "Restarting $DISPLAY_SERVICE"
		systemctl restart "$DISPLAY_SERVICE" || log_err "Failed to restart $DISPLAY_SERVICE"

		# Give the display service time to start before resuming polling
		sleep 3
	fi
done
