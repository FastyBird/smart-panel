#!/bin/bash -e
#
# Configure systemd services, first-boot, and system settings
#

APP_INSTALL_DIR="/usr/lib/smart-panel"
DATA_DIR="/var/lib/smart-panel"

# Install systemd services
cp /tmp/smart-panel-config/smart-panel.service /etc/systemd/system/
cp /tmp/smart-panel-config/smart-panel-firstboot.service /etc/systemd/system/

# Install environment file
cp /tmp/smart-panel-config/environment /etc/smart-panel/environment

# Install first-boot script
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

# Allow smart-panel user to run specific system commands via sudoers
cat > /etc/sudoers.d/smart-panel << 'SUDOERS'
# Smart Panel system commands
smart-panel ALL=(ALL) NOPASSWD: /sbin/reboot
smart-panel ALL=(ALL) NOPASSWD: /sbin/poweroff
smart-panel ALL=(ALL) NOPASSWD: /usr/bin/vcgencmd get_throttled
SUDOERS
chmod 0440 /etc/sudoers.d/smart-panel

# Grant the pi user passwordless sudo access
cat > /etc/sudoers.d/010_pi-nopasswd << 'SUDOERS'
pi ALL=(ALL) NOPASSWD: ALL
SUDOERS
chmod 0440 /etc/sudoers.d/010_pi-nopasswd

# Install WiFi setup script that reads from boot partition on first boot.
# Users can create /boot/firmware/smart-panel-wifi.txt with:
#   SSID=YourNetwork
#   PASSWORD=YourPassword
#   COUNTRY=US
cat > /usr/lib/smart-panel/setup-wifi.sh << 'WIFI_SCRIPT'
#!/bin/bash
WIFI_CONFIG="/boot/firmware/smart-panel-wifi.txt"
if [ -f "${WIFI_CONFIG}" ]; then
	SSID=$(grep "^SSID=" "${WIFI_CONFIG}" | cut -d= -f2-)
	PASSWORD=$(grep "^PASSWORD=" "${WIFI_CONFIG}" | cut -d= -f2-)
	COUNTRY=$(grep "^COUNTRY=" "${WIFI_CONFIG}" | cut -d= -f2-)
	COUNTRY="${COUNTRY:-US}"

	if [ -n "${SSID}" ] && [ -n "${PASSWORD}" ]; then
		# Set regulatory domain first — WiFi is rfkill-blocked without it
		iw reg set "${COUNTRY}" 2>/dev/null || true
		raspi-config nonint do_wifi_country "${COUNTRY}" 2>/dev/null || true
		rfkill unblock wifi 2>/dev/null || true

		# Wait for WiFi adapter to become available
		for i in $(seq 1 10); do
			if nmcli -t -f TYPE device | grep -q wifi; then
				break
			fi
			sleep 1
		done

		# Connect
		nmcli dev wifi connect "${SSID}" password "${PASSWORD}" 2>/dev/null || \
		nmcli connection add type wifi con-name "${SSID}" ssid "${SSID}" \
			wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${PASSWORD}" autoconnect yes 2>/dev/null

		rm -f "${WIFI_CONFIG}"
		echo "WiFi configured for ${SSID} (country: ${COUNTRY})"
	fi
fi
WIFI_SCRIPT
chmod +x /usr/lib/smart-panel/setup-wifi.sh

# Configure kernel modules for I2C (touchscreen support)
echo "i2c-dev" >> /etc/modules

# Set memory split for headless operation (more RAM for app)
if [ -f /boot/firmware/config.txt ]; then
	echo "gpu_mem=64" >> /boot/firmware/config.txt
fi

# Clean up temp files
rm -rf /tmp/smart-panel-config

echo "Smart Panel configured successfully"
