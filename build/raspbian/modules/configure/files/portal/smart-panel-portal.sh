#!/usr/bin/env bash
#
# Smart Panel Captive Portal Manager
#
# Manages the WiFi AP hotspot and captive portal web server.
# Called by smart-panel-portal.service on boot.
#
# Decision logic:
#   1. If smart-panel.conf was applied (user configured manually) → skip entirely
#   2. If WiFi was previously configured via the portal → skip
#   3. If there is any network connection (ethernet or WiFi) → skip
#   4. Otherwise → start AP mode + captive portal
#
set -euo pipefail

PORTAL_DIR="/opt/smart-panel/portal"
WIFI_CONFIGURED_MARKER="/var/lib/smart-panel/.wifi-configured"
BOOT_CONFIG_APPLIED="/var/lib/smart-panel/.boot-config.applied"
LOG_TAG="smart-panel-portal"

log() {
	echo "$1"
	logger -t "${LOG_TAG}" "$1"
}

# ──────────────────────────────────────────────────────────────
# Check if portal should be skipped
# ──────────────────────────────────────────────────────────────

# 1. Skip if user provided a boot config file (manual configuration).
#    The file is moved to .boot-config.applied by apply-boot-config.sh
#    during first-boot — regardless of whether it contained WiFi settings.
if [ -f "${BOOT_CONFIG_APPLIED}" ]; then
	log "Boot config was applied — user configured manually, skipping captive portal"
	exit 0
fi

# 2. Skip if WiFi was previously configured via the captive portal
if [ -f "${WIFI_CONFIGURED_MARKER}" ]; then
	log "WiFi previously configured via portal — skipping captive portal"
	exit 0
fi

# 3. Skip if there is any active network connection (ethernet or WiFi)
#    This covers wired-only setups and pre-existing WiFi connections.
HAS_NETWORK=false

# Check for active ethernet connection
ACTIVE_ETH=$(nmcli -t -f TYPE,STATE device 2>/dev/null | grep '^ethernet:connected' | head -1 || true)
if [ -n "${ACTIVE_ETH}" ]; then
	HAS_NETWORK=true
	log "Ethernet connection detected"
fi

# Check for active WiFi connection (not a hotspot)
ACTIVE_WIFI=$(nmcli -t -f NAME,TYPE connection show --active 2>/dev/null | grep ':802-11-wireless$' | grep -v 'SmartPanel-Hotspot' | head -1 || true)
if [ -n "${ACTIVE_WIFI}" ]; then
	HAS_NETWORK=true
	log "WiFi connection detected: ${ACTIVE_WIFI%%:*}"
fi

if [ "${HAS_NETWORK}" = true ]; then
	log "Network available — skipping captive portal"
	exit 0
fi

# ──────────────────────────────────────────────────────────────
# Determine AP SSID (SmartPanel-XXXX based on MAC)
# ──────────────────────────────────────────────────────────────

# Wait for WiFi adapter
for i in $(seq 1 15); do
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
rfkill unblock wifi 2>/dev/null || true

# ──────────────────────────────────────────────────────────────
# Start AP mode via NetworkManager
# ──────────────────────────────────────────────────────────────

# Remove any leftover hotspot connection
nmcli connection delete SmartPanel-Hotspot 2>/dev/null || true

# Create the hotspot
# NetworkManager handles DHCP (dnsmasq) and DNS automatically for shared connections
nmcli connection add \
	type wifi \
	con-name SmartPanel-Hotspot \
	autoconnect no \
	ssid "${AP_SSID}" \
	wifi.mode ap \
	wifi.band bg \
	wifi-sec.key-mgmt wpa-psk \
	wifi-sec.psk "${AP_PASSWORD}" \
	ipv4.method shared \
	ipv4.addresses 192.168.4.1/24 \
	2>/dev/null

nmcli connection up SmartPanel-Hotspot 2>/dev/null

log "AP mode active: SSID=${AP_SSID}, IP=192.168.4.1"
log "Password: ${AP_PASSWORD}"

# ──────────────────────────────────────────────────────────────
# Configure DNS redirect for captive portal detection
# ──────────────────────────────────────────────────────────────

# NetworkManager's shared mode starts dnsmasq automatically.
# We add a redirect rule so all DNS queries resolve to our IP.
# This triggers captive portal detection on all platforms.
DNSMASQ_CONF="/etc/NetworkManager/dnsmasq-shared.d/captive-portal.conf"
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

# Cleanup function
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

# Forward signals to the node process so it can shut down gracefully
forward_signal() {
	if [ -n "${NODE_PID:-}" ]; then
		kill -"$1" "${NODE_PID}" 2>/dev/null || true
	fi
}

trap 'forward_signal TERM' TERM
trap 'forward_signal INT' INT

log "Starting portal web server on port 80..."

# Run node in the background and wait for it, so this bash process stays alive
# and the EXIT trap can run cleanup when the process ends or is signaled.
# Using 'exec' here would replace bash entirely, making the trap unreachable.
# Propagate node's exit code so systemd's Restart=on-failure can detect crashes.
/usr/local/bin/node "${PORTAL_DIR}/server.js" &
NODE_PID=$!
wait "${NODE_PID}" 2>/dev/null
NODE_EXIT=$?
exit "${NODE_EXIT}"
