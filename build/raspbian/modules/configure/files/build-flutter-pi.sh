#!/bin/bash
#
# Build flutter-pi from source on first boot.
#
# This script is called by first-boot.sh on display and aio variants.
# flutter-pi compilation is deferred to first boot because QEMU-emulated
# ARM64 compilation on x86 CI runners exhausts memory (OOM). Native
# ARM64 compilation on the Pi takes ~2 minutes.
#
set -e

FLUTTER_PI_BIN="/usr/local/bin/flutter-pi"
BUILD_DIR="/tmp/flutter-pi-build"

if [ -x "${FLUTTER_PI_BIN}" ]; then
	echo "flutter-pi already installed at ${FLUTTER_PI_BIN}"
	exit 0
fi

echo "Building flutter-pi from source..."

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/build"

git clone --depth 1 https://github.com/ardera/flutter-pi.git "${BUILD_DIR}/src"

cmake \
	-S "${BUILD_DIR}/src" \
	-B "${BUILD_DIR}/build" \
	-DCMAKE_BUILD_TYPE=Release \
	-DBUILD_GSTREAMER_VIDEO_PLAYER_PLUGIN=OFF

make -C "${BUILD_DIR}/build" -j"$(nproc)"

# Install binary (use full path — avoid getcwd issues)
cp "${BUILD_DIR}/build/flutter-pi" "${FLUTTER_PI_BIN}"
chmod +x "${FLUTTER_PI_BIN}"

# Clean up build directory
rm -rf "${BUILD_DIR}"

echo "flutter-pi installed to ${FLUTTER_PI_BIN}"
