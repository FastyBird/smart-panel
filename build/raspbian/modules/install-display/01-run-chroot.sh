#!/bin/bash -e
#
# Install the Smart Panel display application
#

DISPLAY_DIR="/opt/smart-panel-display"

# Create display app directory (may already exist from display-deps)
mkdir -p "${DISPLAY_DIR}"

# Copy pre-built Flutter app bundle if available
if [ -d /tmp/smart-panel-display-files/app ]; then
	cp -r /tmp/smart-panel-display-files/app/* "${DISPLAY_DIR}/"
	rm -rf /tmp/smart-panel-display-files
	echo "Display app bundle installed to ${DISPLAY_DIR}"
else
	echo "WARNING: No display app bundle found — flutter-pi will have nothing to run"
fi

echo "Smart Panel display installed to ${DISPLAY_DIR}"
