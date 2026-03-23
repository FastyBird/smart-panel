#!/bin/bash -e
#
# Copy configuration files into the image (runs outside chroot)
#

STAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "${ROOTFS_DIR}/tmp/smart-panel-config"
cp "${STAGE_DIR}/files/smart-panel.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
cp "${STAGE_DIR}/files/smart-panel-firstboot.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
cp "${STAGE_DIR}/files/environment" "${ROOTFS_DIR}/tmp/smart-panel-config/"
cp "${STAGE_DIR}/files/first-boot.sh" "${ROOTFS_DIR}/tmp/smart-panel-config/"

# Copy captive portal files from modules (shared with variant-aware builds)
MODULES_DIR="$(cd "${STAGE_DIR}/../../modules/configure" && pwd)"
if [ -d "${MODULES_DIR}/files/portal" ]; then
	cp "${MODULES_DIR}/files/smart-panel-portal.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
	cp "${MODULES_DIR}/files/smart-panel-wifi-watchdog.service" "${ROOTFS_DIR}/tmp/smart-panel-config/"
	cp -r "${MODULES_DIR}/files/portal" "${ROOTFS_DIR}/tmp/smart-panel-config/"
fi
