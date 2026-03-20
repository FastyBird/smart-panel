#!/bin/bash -e
#
# Copy display app files into the image (runs outside chroot)
#

STAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy pre-built Flutter app bundle into the rootfs
if [ -d "${STAGE_DIR}/files/display-app" ]; then
	mkdir -p "${ROOTFS_DIR}/tmp/smart-panel-display-files"
	cp -r "${STAGE_DIR}/files/display-app" "${ROOTFS_DIR}/tmp/smart-panel-display-files/app"
fi
