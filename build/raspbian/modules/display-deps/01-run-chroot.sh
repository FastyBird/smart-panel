#!/bin/bash -e
#
# Prepare for flutter-pi compilation on first boot.
#
# flutter-pi is compiled from source on the device during first boot
# rather than inside the QEMU chroot. Cross-compiling under QEMU on
# CI runners exhausts memory (OOM). Native ARM64 compilation on the
# Pi itself takes ~2 minutes.
#
# This script only installs build dependencies and creates the
# build script that runs on first boot.
#

DISPLAY_DIR="/opt/smart-panel-display"

# Create display app directory
mkdir -p "${DISPLAY_DIR}"

# The flutter-pi build script (build-flutter-pi.sh) is installed by the
# configure module from its files/ directory — single source of truth.
echo "Display deps installed. flutter-pi will be compiled on first boot."
