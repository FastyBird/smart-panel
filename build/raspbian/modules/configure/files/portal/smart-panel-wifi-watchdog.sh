#!/usr/bin/env bash
#
# Smart Panel WiFi Watchdog
#
# Monitors WiFi connectivity after initial configuration.
# If the configured WiFi network is unavailable for 5 minutes,
# re-activates the captive portal so the user can reconfigure.
#
# Runs as smart-panel-wifi-watchdog.service (started after WiFi is configured).
#
set -euo pipefail

WIFI_CONFIGURED_MARKER="/var/lib/smart-panel/.wifi-configured"
LOG_TAG="smart-panel-wifi-watchdog"
FAIL_THRESHOLD=300  # 5 minutes in seconds
CHECK_INTERVAL=30   # Check every 30 seconds

log() {
	logger -t "${LOG_TAG}" "$1"
}

# Only run if WiFi was configured via the portal
if [ ! -f "${WIFI_CONFIGURED_MARKER}" ]; then
	log "No WiFi configured marker — watchdog not needed"
	exit 0
fi

fail_seconds=0

log "WiFi watchdog started (threshold: ${FAIL_THRESHOLD}s)"

while true; do
	sleep "${CHECK_INTERVAL}"

	# Check if there's an active WiFi connection (not a hotspot)
	ACTIVE_WIFI=$(nmcli -t -f NAME,TYPE connection show --active 2>/dev/null | grep ':802-11-wireless$' | grep -v 'SmartPanel-Hotspot' | head -1 || true)

	# If ethernet is connected, the device is reachable — skip WiFi check
	ACTIVE_ETH=$(nmcli -t -f TYPE,STATE device 2>/dev/null | grep '^ethernet:connected' | head -1 || true)
	if [ -n "${ACTIVE_ETH}" ]; then
		if [ "${fail_seconds}" -gt 0 ]; then
			log "Ethernet connected — resetting WiFi failure counter"
			fail_seconds=0
		fi
		continue
	fi

	if [ -n "${ACTIVE_WIFI}" ]; then
		# WiFi is connected — reset counter
		if [ "${fail_seconds}" -gt 0 ]; then
			log "WiFi reconnected after ${fail_seconds}s"
			fail_seconds=0
		fi
	else
		# WiFi is down and no ethernet — increment counter
		fail_seconds=$((fail_seconds + CHECK_INTERVAL))
		log "WiFi disconnected for ${fail_seconds}s / ${FAIL_THRESHOLD}s"

		if [ "${fail_seconds}" -ge "${FAIL_THRESHOLD}" ]; then
			# Check once more — NM may have auto-reconnected during the last interval
			RECHECK_WIFI=$(nmcli -t -f NAME,TYPE connection show --active 2>/dev/null | grep ':802-11-wireless$' | grep -v 'SmartPanel-Hotspot' | head -1 || true)
			if [ -n "${RECHECK_WIFI}" ]; then
				log "WiFi reconnected just before portal trigger — resetting counter"
				fail_seconds=0
				continue
			fi

			log "WiFi unavailable for ${FAIL_THRESHOLD}s — re-activating captive portal"

			# Remove the configured marker so portal will start
			rm -f "${WIFI_CONFIGURED_MARKER}"

			# Stop the backend (it can't serve without WiFi anyway)
			systemctl stop smart-panel.service 2>/dev/null || true

			# Start the captive portal
			systemctl start smart-panel-portal.service 2>/dev/null || true

			log "Captive portal re-activated — stopping watchdog"
			exit 0
		fi
	fi
done
