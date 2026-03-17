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
