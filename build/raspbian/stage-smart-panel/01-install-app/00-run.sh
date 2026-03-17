#!/bin/bash -e
#
# Copy application files into the image (runs outside chroot)
#

STAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy pre-built app files into the rootfs temp directory
mkdir -p "${ROOTFS_DIR}/tmp/smart-panel-files"
cp -r "${STAGE_DIR}/files/app" "${ROOTFS_DIR}/tmp/smart-panel-files/app"
