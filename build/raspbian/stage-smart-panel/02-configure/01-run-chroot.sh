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

# Enable SSH fallback — Raspberry Pi Imager can override this,
# but if someone flashes without Imager config, SSH still works
touch /boot/firmware/ssh
systemctl enable ssh.service

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

# Configure kernel modules for I2C (touchscreen support)
echo "i2c-dev" >> /etc/modules

# Set memory split for headless operation (more RAM for app)
if [ -f /boot/firmware/config.txt ]; then
	echo "gpu_mem=64" >> /boot/firmware/config.txt
fi

# Clean up temp files
rm -rf /tmp/smart-panel-config

echo "Smart Panel configured successfully"
