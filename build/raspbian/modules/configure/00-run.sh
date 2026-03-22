#!/bin/bash -e
#
# Copy configuration files into the image (runs outside chroot)
# Variant-aware: reads variant from environment or defaults to "server"
#

STAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "${ROOTFS_DIR}/tmp/smart-panel-config"

# Copy common config files
cp "${STAGE_DIR}/files/smart-panel-firstboot.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
cp "${STAGE_DIR}/files/first-boot.sh" "${ROOTFS_DIR}/tmp/smart-panel-config/"

# Copy backend config files (used by server and aio variants)
cp "${STAGE_DIR}/files/smart-panel.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
cp "${STAGE_DIR}/files/environment" "${ROOTFS_DIR}/tmp/smart-panel-config/"

# Copy display config files (used by display and aio variants)
cp "${STAGE_DIR}/files/smart-panel-display.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
cp "${STAGE_DIR}/files/build-flutter-pi.sh" "${ROOTFS_DIR}/tmp/smart-panel-config/"

# Copy Plymouth boot splash theme
cp -r "${STAGE_DIR}/files/plymouth" "${ROOTFS_DIR}/tmp/smart-panel-config/"

# Copy discovery proxy files (used by display and aio variants)
cp "${STAGE_DIR}/files/smart-panel-discovery.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
cp "${STAGE_DIR}/files/smart-panel-discovery.py" "${ROOTFS_DIR}/tmp/smart-panel-config/"

# Write variant marker so the chroot script knows which variant to configure.
# The variant file is written into the stage's files/ directory by build.sh
# before pi-gen starts, so it survives the Docker boundary.
if [ -f "${STAGE_DIR}/files/variant" ]; then
	cp "${STAGE_DIR}/files/variant" "${ROOTFS_DIR}/tmp/smart-panel-config/variant"
else
	echo "server" > "${ROOTFS_DIR}/tmp/smart-panel-config/variant"
fi
