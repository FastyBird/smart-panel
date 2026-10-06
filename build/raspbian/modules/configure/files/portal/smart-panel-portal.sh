#!/usr/bin/env bash
#
# Smart Panel Captive Portal Manager
#
# Manages the WiFi AP hotspot and captive portal web server.
# Called by smart-panel-portal.service on boot.
#
# Decision logic:
#   1. If WiFi was previously configured via the portal → skip
#   2. Wait briefly for ethernet or non-hotspot WiFi (including boot config)
#   3. Otherwise → start AP mode + captive portal; recover on later ethernet
#
set -euo pipefail

PORTAL_DIR="/opt/smart-panel/portal"
WIFI_CONFIGURED_MARKER="/var/lib/smart-panel/.wifi-configured"
BOOT_CONFIG_APPLIED="/var/lib/smart-panel/.boot-config.applied"
DNSMASQ_CONF="/etc/NetworkManager/dnsmasq-shared.d/captive-portal.conf"
LOG_TAG="smart-panel-portal"
NETWORK_WAIT_SECONDS=30

log() {
	echo "$1"
	logger -t "${LOG_TAG}" "$1"
}

# ──────────────────────────────────────────────────────────────
# Check if portal should be skipped
# ──────────────────────────────────────────────────────────────

# Confirm hotspot teardown before skipping setup or creating a configured marker.
# A stale AP can survive a previous wrapper exit if NetworkManager was unavailable.
stop_hotspot() {
	local active_connections
	for attempt in 1 2 3; do
		timeout 5 nmcli connection down SmartPanel-Hotspot 2>/dev/null || true
		timeout 5 nmcli connection delete SmartPanel-Hotspot 2>/dev/null || true
		if active_connections=$(timeout 5 nmcli -t -f NAME connection show --active 2>/dev/null); then
			if ! echo "${active_connections}" | grep -qx 'SmartPanel-Hotspot'; then
				rm -f "${DNSMASQ_CONF}" || return 1
				return 0
			fi
		fi
		log "Hotspot teardown not confirmed (attempt ${attempt}/3)"
		if [ "${attempt}" -lt 3 ]; then
			sleep 1
		fi
	done
	return 1
}

# 1. Skip if WiFi was previously configured via the captive portal, but never
# bypass a stale hotspot solely because a marker from an earlier run exists.
if [ -f "${WIFI_CONFIGURED_MARKER}" ]; then
	if ! stop_hotspot; then
		log "ERROR: Cannot confirm hotspot stopped — retrying through systemd"
		exit 1
	fi
	log "WiFi previously configured via portal — skipping captive portal"
	exit 0
fi

# Helper: ensure .wifi-configured marker exists and watchdog is running.
# Called whenever we skip the portal with an active network connection.
ensure_marker_and_watchdog() {
	if ! stop_hotspot; then
		return 1
	fi
	if [ ! -f "${WIFI_CONFIGURED_MARKER}" ]; then
		log "Creating WiFi configured marker and starting watchdog"
		mkdir -p "$(dirname "${WIFI_CONFIGURED_MARKER}")" || return 1
		echo "configured=$(date -Iseconds)" > "${WIFI_CONFIGURED_MARKER}" || return 1
		echo "source=${1:-unknown}" >> "${WIFI_CONFIGURED_MARKER}" || return 1
		timeout 5 systemctl start smart-panel.service 2>/dev/null || true
		timeout 5 systemctl start smart-panel-wifi-watchdog.service 2>/dev/null || true
	fi
}

# NetworkManager startup does not imply DHCP is ready. Use the same bounded
# grace period on every unconfigured boot, including a fresh image without a
# boot-config marker. Never count our own AP as an external WiFi connection.
query_network_manager() {
	# Bound each probe by both a short timeout and the remaining startup grace.
	local wait_seconds=$((NETWORK_DEADLINE - SECONDS))
	if [ "${wait_seconds}" -le 0 ]; then
		return 1
	fi
	if [ "${wait_seconds}" -gt 5 ]; then
		wait_seconds=5
	fi
	timeout "${wait_seconds}" nmcli "$@" 2>/dev/null
}

has_network() {
	if query_network_manager -t -f TYPE,STATE device | grep -q '^ethernet:connected$'; then
		return 0
	fi

	query_network_manager -t -f NAME,TYPE connection show --active \
		| grep ':802-11-wireless$' | grep -v '^SmartPanel-Hotspot:802-11-wireless$' > /dev/null
}

NETWORK_SOURCE="network-detected"
if [ -f "${BOOT_CONFIG_APPLIED}" ]; then
	NETWORK_SOURCE="boot-config"
fi

log "Waiting up to ${NETWORK_WAIT_SECONDS}s for a network connection..."
NETWORK_START=${SECONDS}
NETWORK_DEADLINE=$((NETWORK_START + NETWORK_WAIT_SECONDS))
while true; do
	if has_network; then
		log "Network available after $((SECONDS - NETWORK_START))s — skipping captive portal"
		if ! ensure_marker_and_watchdog "${NETWORK_SOURCE}"; then
			log "ERROR: Cannot confirm hotspot stopped — leaving network unconfigured for retry"
			exit 1
		fi
		exit 0
	fi
	if [ "${SECONDS}" -ge "${NETWORK_DEADLINE}" ]; then
		break
	fi
	sleep 1
done
log "No network after ${NETWORK_WAIT_SECONDS}s — starting captive portal"

# ──────────────────────────────────────────────────────────────
# Determine AP SSID (SmartPanel-XXXX based on MAC)
# ──────────────────────────────────────────────────────────────

# Wait for WiFi adapter
for _ in $(seq 1 15); do
	if nmcli -t -f TYPE device | grep -q wifi; then
		break
	fi
	sleep 1
done

# Get MAC address for unique SSID suffix (last 4 hex characters)
MAC_ADDR=$(cat /sys/class/net/wlan0/address 2>/dev/null || echo "00:00:00:00:00:00")
MAC_NO_COLONS=$(echo "${MAC_ADDR}" | tr -d ':' | tr '[:lower:]' '[:upper:]')
MAC_SUFFIX="${MAC_NO_COLONS: -4}"
AP_SSID="SmartPanel-${MAC_SUFFIX}"
AP_PASSWORD="smartpanel"

log "Starting captive portal with SSID: ${AP_SSID}"

# ──────────────────────────────────────────────────────────────
# Ensure WiFi radio is unblocked
# ──────────────────────────────────────────────────────────────
# On Raspberry Pi, WiFi stays soft-blocked until a regulatory country is set.
# Set a permissive default (US) so the radio can be enabled for AP mode.
# The user picks their actual country in the portal setup page.
iw reg set US 2>/dev/null || true
rfkill unblock wifi 2>/dev/null || true
nmcli radio wifi on 2>/dev/null || true

# Wait for WiFi to become available after unblocking
for _ in $(seq 1 10); do
	WIFI_STATE=$(nmcli -t -f TYPE,STATE device 2>/dev/null | grep '^wifi:' | cut -d: -f2 || true)
	if [ "${WIFI_STATE}" != "unavailable" ]; then
		break
	fi
	sleep 1
done

# ──────────────────────────────────────────────────────────────
# Cleanup and DNS config path
# ──────────────────────────────────────────────────────────────

# Cleanup function — registered BEFORE creating any resources so that
# an early failure (e.g. nmcli connection up) still cleans up.
cleanup() {
	log "Cleaning up captive portal..."

	# Remove DNS redirect config
	rm -f "${DNSMASQ_CONF}"

	# Deactivate and remove hotspot if still active
	nmcli connection down SmartPanel-Hotspot 2>/dev/null || true
	nmcli connection delete SmartPanel-Hotspot 2>/dev/null || true

	log "Captive portal stopped"
}

trap cleanup EXIT

# ──────────────────────────────────────────────────────────────
# Start AP mode via NetworkManager
# ──────────────────────────────────────────────────────────────

# Remove any leftover hotspot connection
nmcli connection delete SmartPanel-Hotspot 2>/dev/null || true

# Create the hotspot
# NetworkManager handles DHCP (dnsmasq) and DNS automatically for shared connections
if ! nmcli connection add \
	type wifi \
	con-name SmartPanel-Hotspot \
	autoconnect no \
	ssid "${AP_SSID}" \
	wifi.mode ap \
	wifi.band bg \
	wifi-sec.key-mgmt wpa-psk \
	wifi-sec.psk "${AP_PASSWORD}" \
	ipv4.method shared \
	ipv4.addresses 192.168.4.1/24; then
	log "ERROR: Failed to create hotspot connection — is wlan0 available?"
	exit 1
fi

if ! nmcli connection up SmartPanel-Hotspot; then
	log "ERROR: Failed to activate hotspot — check NetworkManager logs"
	exit 1
fi

log "AP mode active: SSID=${AP_SSID}, IP=192.168.4.1"
log "Password: ${AP_PASSWORD}"

# ──────────────────────────────────────────────────────────────
# Configure DNS redirect for captive portal detection
# ──────────────────────────────────────────────────────────────

# NetworkManager's shared mode starts dnsmasq automatically.
# We add a redirect rule so all DNS queries resolve to our IP.
# This triggers captive portal detection on all platforms.
mkdir -p "$(dirname "${DNSMASQ_CONF}")"
cat > "${DNSMASQ_CONF}" << 'EOF'
# Smart Panel captive portal — redirect all DNS to AP IP
address=/#/192.168.4.1
EOF

# Restart NetworkManager's dnsmasq to pick up the config
nmcli connection down SmartPanel-Hotspot 2>/dev/null || true
sleep 1
nmcli connection up SmartPanel-Hotspot 2>/dev/null

log "DNS redirect configured — all domains resolve to 192.168.4.1"

# ──────────────────────────────────────────────────────────────
# Start the portal HTTP server
# ──────────────────────────────────────────────────────────────

# Forward signals to the node process so it can shut down gracefully.
# After forwarding, re-wait for node to finish before exiting, so
# cleanup doesn't race with node's own shutdown.
NODE_PID=""
WAIT_INTERRUPTED=false

forward_signal() {
	WAIT_INTERRUPTED=true
	if [ -n "${NODE_PID}" ]; then
		kill -"$1" "${NODE_PID}" 2>/dev/null || true
	fi
}

trap 'forward_signal TERM' TERM
trap 'forward_signal INT' INT

log "Starting portal web server on port 80..."

# Run node in the background and wait for it, so this bash process stays alive
# and the EXIT trap can run cleanup when the process ends or is signaled.
# Using 'exec' here would replace bash entirely, making the trap unreachable.
/usr/local/bin/node "${PORTAL_DIR}/server.js" &
NODE_PID=$!

# Disable set -e for the wait loop: when a signal interrupts wait, it returns
# non-zero (128+signal). We need to re-wait for node to actually exit before
# running cleanup, rather than letting set -e exit immediately.
set +e
while true; do
	WAIT_INTERRUPTED=false
	wait "${NODE_PID}" 2>/dev/null
	NODE_EXIT=$?
	# A trapped signal can interrupt wait before node has finished its cleanup.
	# Keep waiting until it exits, retaining the actual child status for systemd.
	if [ "${WAIT_INTERRUPTED}" = false ]; then
		break
	fi
done
set -e

exit "${NODE_EXIT}"
