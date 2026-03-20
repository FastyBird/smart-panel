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

BUILD_SCRIPT="/opt/smart-panel-display/build-flutter-pi.sh"
DISPLAY_DIR="/opt/smart-panel-display"

# Create display app directory
mkdir -p "${DISPLAY_DIR}"

# Create the first-boot flutter-pi build script
cat > "${BUILD_SCRIPT}" << 'BUILD_SCRIPT_CONTENT'
#!/bin/bash
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
BUILD_SCRIPT_CONTENT
chmod +x "${BUILD_SCRIPT}"

echo "flutter-pi build script created at ${BUILD_SCRIPT}"
