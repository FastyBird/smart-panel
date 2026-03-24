#!/bin/bash -e
#
# Install the Smart Panel display application
#
# Uses a versioned directory layout with a "current" symlink,
# matching the server app pattern for future update support.
#

DISPLAY_BASE_DIR="/opt/smart-panel-display"
VERSION="${SMART_PANEL_VERSION:-1.0.0-dev.1}"
DISPLAY_INSTALL_DIR="${DISPLAY_BASE_DIR}/${VERSION}"

# Create versioned display app directory
mkdir -p "${DISPLAY_INSTALL_DIR}"

# Copy pre-built Flutter app bundle if available
if [ -d /tmp/smart-panel-display-files/app ]; then
	cp -r /tmp/smart-panel-display-files/app/* "${DISPLAY_INSTALL_DIR}/"
	rm -rf /tmp/smart-panel-display-files
	echo "Display app bundle installed to ${DISPLAY_INSTALL_DIR}"
else
	echo "WARNING: No display app bundle found — flutter-pi will have nothing to run"
fi

# Create the "current" symlink pointing to this version
ln -sfn "${DISPLAY_INSTALL_DIR}" "${DISPLAY_BASE_DIR}/current"

echo "Smart Panel display installed to ${DISPLAY_INSTALL_DIR} (current -> ${VERSION})"
