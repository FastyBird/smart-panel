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
git clone --depth 1 https://github.com/niclas3332/flutter-pi.git "${BUILD_DIR}"

cd "${BUILD_DIR}"
mkdir build && cd build

cmake \
	-DCMAKE_BUILD_TYPE=Release \
	-DBUILD_GSTREAMER_VIDEO_PLAYER_PLUGIN=OFF \
	..

make -j"$(nproc)"

# Install binary
cp flutter-pi "${FLUTTER_PI_BIN}"
chmod +x "${FLUTTER_PI_BIN}"

# Clean up build directory
rm -rf "${BUILD_DIR}"

echo "flutter-pi installed to ${FLUTTER_PI_BIN}"
