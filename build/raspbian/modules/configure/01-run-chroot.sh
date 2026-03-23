#!/bin/bash -e
#
# Configure systemd services, first-boot, and system settings
# Variant-aware: reads /tmp/smart-panel-config/variant to determine
# which services to install (backend, display, or both).
#

# ──────────────────────────────────────────────────────────────
# Determine variant and set flags
# ──────────────────────────────────────────────────────────────
VARIANT="server"
if [ -f /tmp/smart-panel-config/variant ]; then
	VARIANT=$(cat /tmp/smart-panel-config/variant)
fi

HAS_BACKEND=false
HAS_DISPLAY=false

case "${VARIANT}" in
	server)
		HAS_BACKEND=true
		;;
	display)
		HAS_DISPLAY=true
		;;
	aio)
		HAS_BACKEND=true
		HAS_DISPLAY=true
		;;
	*)
		echo "Unknown variant: ${VARIANT}" >&2
		exit 1
		;;
esac

echo "Configuring variant: ${VARIANT} (backend=${HAS_BACKEND}, display=${HAS_DISPLAY})"

APP_INSTALL_DIR="/opt/smart-panel"
DATA_DIR="/var/lib/smart-panel"
DISPLAY_DIR="/opt/smart-panel-display"

# ──────────────────────────────────────────────────────────────
# Backend services (server + aio)
# ──────────────────────────────────────────────────────────────
if [ "${HAS_BACKEND}" = true ]; then
	# Install backend systemd service
	cp /tmp/smart-panel-config/smart-panel.service /etc/systemd/system/

	# Install environment file
	mkdir -p /etc/smart-panel
	cp /tmp/smart-panel-config/environment /etc/smart-panel/environment

	# Enable backend service
	systemctl enable smart-panel.service

	# Install CLI wrapper so users can run commands from anywhere.
	# Uses sudo -u to run as the smart-panel system user (owns the database)
	# and explicitly invokes bash since the system user has nologin shell.
	cat > /usr/local/bin/smart-panel-cli << 'CLI_WRAPPER'
#!/bin/bash
exec sudo -u smart-panel /bin/bash -c '
	set -a
	. /etc/smart-panel/environment
	set +a
	cd /opt/smart-panel
	exec node dist/cli.js "$@"
' -- "$@"
CLI_WRAPPER
	chmod +x /usr/local/bin/smart-panel-cli

	# Allow smart-panel user to run specific system commands via sudoers
	cat > /etc/sudoers.d/smart-panel << 'SUDOERS'
# Smart Panel system commands
smart-panel ALL=(ALL) NOPASSWD: /sbin/reboot
smart-panel ALL=(ALL) NOPASSWD: /sbin/poweroff
smart-panel ALL=(ALL) NOPASSWD: /usr/bin/vcgencmd get_throttled
SUDOERS
	chmod 0440 /etc/sudoers.d/smart-panel

	echo "Backend services configured"
fi

# ──────────────────────────────────────────────────────────────
# Display services (display + aio)
# ──────────────────────────────────────────────────────────────
if [ "${HAS_DISPLAY}" = true ]; then
	mkdir -p "${DISPLAY_DIR}"

	# Install display systemd service
	if [ "${HAS_BACKEND}" = true ]; then
		# AIO: make display service wait for backend to be ready.
		# Note: the backend URL (localhost) is baked into the panel app at build
		# time via --dart-define in build.sh — runtime env vars have no effect
		# on Dart's String.fromEnvironment which is compile-time only.
		sed \
			-e 's|^After=.*|After=network-online.target smart-panel.service smart-panel-discovery.service|' \
			-e 's|^Wants=.*|Wants=network-online.target smart-panel.service smart-panel-discovery.service|' \
			/tmp/smart-panel-config/smart-panel-display.service \
			> /etc/systemd/system/smart-panel-display.service
	else
		cp /tmp/smart-panel-config/smart-panel-display.service /etc/systemd/system/
	fi

	# Copy the flutter-pi build script
	cp /tmp/smart-panel-config/build-flutter-pi.sh "${DISPLAY_DIR}/build-flutter-pi.sh"
	chmod +x "${DISPLAY_DIR}/build-flutter-pi.sh"

	# Install discovery proxy (wraps avahi-browse for flutter-pi)
	cp /tmp/smart-panel-config/smart-panel-discovery.py "${DISPLAY_DIR}/discovery-service.py"
	cp /tmp/smart-panel-config/smart-panel-discovery.service /etc/systemd/system/

	# Enable display and discovery services
	systemctl enable smart-panel-display.service
	systemctl enable smart-panel-discovery.service

	echo "Display services configured"
fi

# ──────────────────────────────────────────────────────────────
# First-boot service (all variants)
# ──────────────────────────────────────────────────────────────

# Install first-boot service
cp /tmp/smart-panel-config/smart-panel-firstboot.service /etc/systemd/system/

# Backend variants: add InfluxDB ordering to firstboot service
# (display-only doesn't have InfluxDB, so we add it conditionally)
if [ "${HAS_BACKEND}" = true ]; then
	sed -i \
		-e 's|^After=network-online.target|After=network-online.target influxdb.service|' \
		-e 's|^Wants=network-online.target|Wants=network-online.target influxdb.service|' \
		/etc/systemd/system/smart-panel-firstboot.service
fi

# Determine first-boot script install directory and data directory
if [ "${HAS_BACKEND}" = true ]; then
	FIRSTBOOT_DIR="${APP_INSTALL_DIR}"
	mkdir -p "${DATA_DIR}"
else
	FIRSTBOOT_DIR="${DISPLAY_DIR}"
	mkdir -p "${DISPLAY_DIR}"
fi

# Install first-boot script
cp /tmp/smart-panel-config/first-boot.sh "${FIRSTBOOT_DIR}/first-boot.sh"
chmod +x "${FIRSTBOOT_DIR}/first-boot.sh"

# Write variant marker for first-boot script
echo "${VARIANT}" > "${FIRSTBOOT_DIR}/.variant"

# Create first-boot marker
if [ "${HAS_BACKEND}" = true ]; then
	touch "${DATA_DIR}/.first-boot"
else
	touch "${DISPLAY_DIR}/.first-boot"
fi

# Enable first-boot service
systemctl enable smart-panel-firstboot.service

# ──────────────────────────────────────────────────────────────
# Common configuration (all variants)
# ──────────────────────────────────────────────────────────────

# Enable SSH
touch /boot/firmware/ssh
systemctl enable ssh.service
ssh-keygen -A

# Enable avahi for mDNS discovery
systemctl enable avahi-daemon.service

# Grant the default user passwordless sudo access
cat > /etc/sudoers.d/010_smartpanel-nopasswd << 'SUDOERS'
smartpanel ALL=(ALL) NOPASSWD: ALL
SUDOERS
chmod 0440 /etc/sudoers.d/010_smartpanel-nopasswd

# Force password change on first SSH login
chage -d 0 "${FIRST_USER_NAME}"

# ──────────────────────────────────────────────────────────────
# Captive portal (all variants — WiFi provisioning on first boot)
# ──────────────────────────────────────────────────────────────

# Ensure data directory exists for all variants — the portal writes
# marker files here (.wifi-configured) and apply-boot-config.sh
# moves the config file here (.boot-config.applied).
mkdir -p "${DATA_DIR}"

PORTAL_DIR="/opt/smart-panel/portal"
mkdir -p "${PORTAL_DIR}"

cp /tmp/smart-panel-config/portal/server.js "${PORTAL_DIR}/server.js"
cp /tmp/smart-panel-config/portal/index.html "${PORTAL_DIR}/index.html"
cp /tmp/smart-panel-config/portal/smart-panel-portal.sh "${PORTAL_DIR}/smart-panel-portal.sh"
cp /tmp/smart-panel-config/portal/smart-panel-wifi-watchdog.sh "${PORTAL_DIR}/smart-panel-wifi-watchdog.sh"
chmod +x "${PORTAL_DIR}/smart-panel-portal.sh"
chmod +x "${PORTAL_DIR}/smart-panel-wifi-watchdog.sh"

# Install portal systemd services
cp /tmp/smart-panel-config/smart-panel-portal.service /etc/systemd/system/
cp /tmp/smart-panel-config/smart-panel-wifi-watchdog.service /etc/systemd/system/

# Enable portal service (it self-exits if WiFi is already configured)
systemctl enable smart-panel-portal.service
systemctl enable smart-panel-wifi-watchdog.service

echo "Captive portal configured"

# Install boot config parser — reads /boot/firmware/smart-panel.conf on first boot.
# Supports: WIFI_SSID, WIFI_PASSWORD, WIFI_COUNTRY, HOSTNAME, TIMEZONE, LOCALE, SSH_ENABLED
BOOT_CONFIG_DIR="${FIRSTBOOT_DIR}"
cat > "${BOOT_CONFIG_DIR}/apply-boot-config.sh" << 'BOOT_CONFIG_SCRIPT'
#!/bin/bash
#
# Apply user configuration from /boot/firmware/smart-panel.conf
#
# Supported options:
#   WIFI_SSID=MyNetwork
#   WIFI_PASSWORD=MyPassword
#   WIFI_COUNTRY=US
#   HOSTNAME=my-panel
#   TIMEZONE=Europe/Prague
#   LOCALE=cs_CZ.UTF-8
#   SSH_ENABLED=yes|no
#
BOOT_CONFIG="/boot/firmware/smart-panel.conf"

if [ ! -f "${BOOT_CONFIG}" ]; then
	exit 0
fi

# Parse config file — strip comments, blank lines, trim whitespace
parse_value() {
	grep -i "^${1}=" "${BOOT_CONFIG}" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^["'"'"']//;s/["'"'"']$//'
}

# ── WiFi ──
WIFI_SSID=$(parse_value "WIFI_SSID")
WIFI_PASSWORD=$(parse_value "WIFI_PASSWORD")
WIFI_COUNTRY=$(parse_value "WIFI_COUNTRY")
WIFI_COUNTRY="${WIFI_COUNTRY:-US}"

if [ -n "${WIFI_SSID}" ] && [ -n "${WIFI_PASSWORD}" ]; then
	iw reg set "${WIFI_COUNTRY}" 2>/dev/null || true
	raspi-config nonint do_wifi_country "${WIFI_COUNTRY}" 2>/dev/null || true
	rfkill unblock wifi 2>/dev/null || true

	# Wait for WiFi adapter
	for i in $(seq 1 10); do
		if nmcli -t -f TYPE device | grep -q wifi; then
			break
		fi
		sleep 1
	done

	nmcli dev wifi connect "${WIFI_SSID}" password "${WIFI_PASSWORD}" 2>/dev/null || \
	nmcli connection add type wifi con-name "${WIFI_SSID}" ssid "${WIFI_SSID}" \
		wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${WIFI_PASSWORD}" autoconnect yes 2>/dev/null

	echo "WiFi configured for ${WIFI_SSID} (country: ${WIFI_COUNTRY})"
elif [ -n "${WIFI_COUNTRY}" ]; then
	iw reg set "${WIFI_COUNTRY}" 2>/dev/null || true
	raspi-config nonint do_wifi_country "${WIFI_COUNTRY}" 2>/dev/null || true
fi

# ── Hostname ──
NEW_HOSTNAME=$(parse_value "HOSTNAME")
if [ -n "${NEW_HOSTNAME}" ]; then
	hostnamectl set-hostname "${NEW_HOSTNAME}"
	sed -i "s/127.0.1.1.*/127.0.1.1\t${NEW_HOSTNAME}/" /etc/hosts
	echo "Hostname set to ${NEW_HOSTNAME}"
fi

# ── Timezone ──
NEW_TIMEZONE=$(parse_value "TIMEZONE")
if [ -n "${NEW_TIMEZONE}" ]; then
	timedatectl set-timezone "${NEW_TIMEZONE}" 2>/dev/null && \
		echo "Timezone set to ${NEW_TIMEZONE}" || \
		echo "WARNING: Invalid timezone ${NEW_TIMEZONE}"
fi

# ── Locale ──
NEW_LOCALE=$(parse_value "LOCALE")
if [ -n "${NEW_LOCALE}" ]; then
	sed -i "s/^# *${NEW_LOCALE}/${NEW_LOCALE}/" /etc/locale.gen 2>/dev/null
	locale-gen 2>/dev/null
	update-locale LANG="${NEW_LOCALE}" 2>/dev/null
	echo "Locale set to ${NEW_LOCALE}"
fi

# ── SSH ──
SSH_ENABLED=$(parse_value "SSH_ENABLED")
if [ "${SSH_ENABLED}" = "no" ] || [ "${SSH_ENABLED}" = "false" ]; then
	systemctl disable ssh.service 2>/dev/null
	systemctl stop ssh.service 2>/dev/null
	echo "SSH disabled"
fi

# Archive the config file (contains WiFi password — move off boot partition)
DATA_DIR="/var/lib/smart-panel"
mkdir -p "${DATA_DIR}"
mv "${BOOT_CONFIG}" "${DATA_DIR}/.boot-config.applied" 2>/dev/null || true
echo "Boot configuration applied"
BOOT_CONFIG_SCRIPT
chmod +x "${BOOT_CONFIG_DIR}/apply-boot-config.sh"

# Configure kernel modules for I2C (touchscreen support)
if ! grep -q "^i2c-dev" /etc/modules 2>/dev/null; then
	echo "i2c-dev" >> /etc/modules
fi

# ──────────────────────────────────────────────────────────────
# GPU memory split (variant-dependent)
# ──────────────────────────────────────────────────────────────
if [ -f /boot/firmware/config.txt ]; then
	if [ "${HAS_DISPLAY}" = true ]; then
		# Display variants need more GPU memory for rendering
		echo "gpu_mem=256" >> /boot/firmware/config.txt
		echo "dtoverlay=vc4-kms-v3d" >> /boot/firmware/config.txt
		echo "disable_overscan=1" >> /boot/firmware/config.txt
	else
		# Server-only: minimal GPU, more RAM for app
		echo "gpu_mem=64" >> /boot/firmware/config.txt
	fi
fi

# ──────────────────────────────────────────────────────────────
# Plymouth boot splash (hides boot console text)
# ──────────────────────────────────────────────────────────────
if [ -d /tmp/smart-panel-config/plymouth ]; then
	THEME_DIR="/usr/share/plymouth/themes/smart-panel"
	mkdir -p "${THEME_DIR}"
	cp /tmp/smart-panel-config/plymouth/* "${THEME_DIR}/"

	# Set as default theme
	if command -v plymouth-set-default-theme > /dev/null 2>&1; then
		plymouth-set-default-theme smart-panel
	else
		# Manual fallback if plymouth-set-default-theme not available in chroot
		mkdir -p /etc/plymouth
		echo "[Daemon]" > /etc/plymouth/plymouthd.conf
		echo "Theme=smart-panel" >> /etc/plymouth/plymouthd.conf
	fi

	# Add quiet splash to kernel cmdline
	CMDLINE="/boot/firmware/cmdline.txt"
	if [ -f "${CMDLINE}" ]; then
		if ! grep -q "splash" "${CMDLINE}"; then
			sed -i 's/$/ quiet splash plymouth.ignore-serial-consoles/' "${CMDLINE}"
		fi
	fi

	echo "Plymouth boot splash configured"
fi

# Clean up temp files
rm -rf /tmp/smart-panel-config

echo "Smart Panel (${VARIANT}) configured successfully"
