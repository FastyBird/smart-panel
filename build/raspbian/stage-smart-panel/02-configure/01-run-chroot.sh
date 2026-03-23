#!/bin/bash -e
#
# Configure systemd services, first-boot, and system settings
#

APP_INSTALL_DIR="/opt/smart-panel"
DATA_DIR="/var/lib/smart-panel"

# Install systemd services
cp /tmp/smart-panel-config/smart-panel.service /etc/systemd/system/
cp /tmp/smart-panel-config/smart-panel-firstboot.service /etc/systemd/system/

# Install environment file
cp /tmp/smart-panel-config/environment /etc/smart-panel/environment

# Install first-boot script (in base dir, shared across versions)
cp /tmp/smart-panel-config/first-boot.sh "${APP_INSTALL_DIR}/first-boot.sh"
chmod +x "${APP_INSTALL_DIR}/first-boot.sh"

# Create first-boot marker
touch "${DATA_DIR}/.first-boot"

# Enable services
systemctl enable smart-panel.service
systemctl enable smart-panel-firstboot.service

# Enable SSH
touch /boot/firmware/ssh
systemctl enable ssh.service
ssh-keygen -A

# Enable avahi for mDNS discovery
systemctl enable avahi-daemon.service

# Install CLI wrapper so users can run commands from anywhere.
# Uses sudo -u to run as the smart-panel system user (owns the database)
# and explicitly invokes bash since the system user has nologin shell.
cat > /usr/local/bin/smart-panel-cli << 'CLI_WRAPPER'
#!/bin/bash
exec sudo -u smart-panel /bin/bash -c '
	set -a
	. /etc/smart-panel/environment
	set +a
	cd /opt/smart-panel/current
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
# Update operations (symlink switch, service management, ownership)
smart-panel ALL=(ALL) NOPASSWD: /usr/bin/ln -sfn /opt/smart-panel/v[0-9]* /opt/smart-panel/current
smart-panel ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop smart-panel
smart-panel ALL=(ALL) NOPASSWD: /usr/bin/systemctl start smart-panel
smart-panel ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart smart-panel
smart-panel ALL=(ALL) NOPASSWD: /usr/bin/chown -R smart-panel\:smart-panel /opt/smart-panel/v[0-9]*
SUDOERS
chmod 0440 /etc/sudoers.d/smart-panel

# Grant the default user passwordless sudo access
cat > /etc/sudoers.d/010_smartpanel-nopasswd << 'SUDOERS'
smartpanel ALL=(ALL) NOPASSWD: ALL
SUDOERS
chmod 0440 /etc/sudoers.d/010_smartpanel-nopasswd

# Force password change on first SSH login
chage -d 0 "${FIRST_USER_NAME}"

# ──────────────────────────────────────────────────────────────
# Captive portal (WiFi provisioning on first boot)
# ──────────────────────────────────────────────────────────────
if [ -d /tmp/smart-panel-config/portal ]; then
	PORTAL_DIR="/opt/smart-panel/portal"
	mkdir -p "${PORTAL_DIR}"

	cp /tmp/smart-panel-config/portal/server.js "${PORTAL_DIR}/server.js"
	cp /tmp/smart-panel-config/portal/index.html "${PORTAL_DIR}/index.html"
	cp /tmp/smart-panel-config/portal/smart-panel-portal.sh "${PORTAL_DIR}/smart-panel-portal.sh"
	cp /tmp/smart-panel-config/portal/smart-panel-wifi-watchdog.sh "${PORTAL_DIR}/smart-panel-wifi-watchdog.sh"
	chmod +x "${PORTAL_DIR}/smart-panel-portal.sh"
	chmod +x "${PORTAL_DIR}/smart-panel-wifi-watchdog.sh"

	cp /tmp/smart-panel-config/smart-panel-portal.service /etc/systemd/system/
	cp /tmp/smart-panel-config/smart-panel-wifi-watchdog.service /etc/systemd/system/

	systemctl enable smart-panel-portal.service
	systemctl enable smart-panel-wifi-watchdog.service

	echo "Captive portal configured"
fi

# Install boot config parser — reads /boot/firmware/smart-panel.conf on first boot.
# Supports: WIFI_SSID, WIFI_PASSWORD, WIFI_COUNTRY, HOSTNAME, TIMEZONE, LOCALE, SSH_ENABLED
cat > /opt/smart-panel/apply-boot-config.sh << 'BOOT_CONFIG_SCRIPT'
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
mv "${BOOT_CONFIG}" "/var/lib/smart-panel/.boot-config.applied" 2>/dev/null || true
echo "Boot configuration applied"
BOOT_CONFIG_SCRIPT
chmod +x /opt/smart-panel/apply-boot-config.sh

# Configure kernel modules for I2C (touchscreen support)
echo "i2c-dev" >> /etc/modules

# Set memory split for headless operation (more RAM for app)
if [ -f /boot/firmware/config.txt ]; then
	echo "gpu_mem=64" >> /boot/firmware/config.txt
fi

# Clean up temp files
rm -rf /tmp/smart-panel-config

echo "Smart Panel configured successfully"
