#!/bin/bash -e
#
# Install the Smart Panel application
#

APP_INSTALL_DIR="/usr/lib/smart-panel"
DATA_DIR="/var/lib/smart-panel"

# Create system user
if ! id -u smart-panel >/dev/null 2>&1; then
	useradd --system --home-dir "${DATA_DIR}" --shell /usr/sbin/nologin --create-home smart-panel
fi

# Create directories
mkdir -p "${APP_INSTALL_DIR}"
mkdir -p "${DATA_DIR}/data"
mkdir -p "${DATA_DIR}/config"
mkdir -p /etc/smart-panel

# Copy pre-built application files
cp -r /tmp/smart-panel-files/app/dist "${APP_INSTALL_DIR}/dist"
cp /tmp/smart-panel-files/app/package.json "${APP_INSTALL_DIR}/package.json"

# Copy lockfile for reproducible installs (if present)
if [ -f /tmp/smart-panel-files/app/pnpm-lock.yaml ]; then
	cp /tmp/smart-panel-files/app/pnpm-lock.yaml "${APP_INSTALL_DIR}/pnpm-lock.yaml"
fi

# Copy admin static files
cp -r /tmp/smart-panel-files/app/static "${APP_INSTALL_DIR}/static"

# Copy seed data
if [ -d /tmp/smart-panel-files/app/var ]; then
	cp -r /tmp/smart-panel-files/app/var "${APP_INSTALL_DIR}/var"
fi

# Install production dependencies
cd "${APP_INSTALL_DIR}"
pnpm install --prod --ignore-scripts

# Rebuild native modules for ARM
pnpm rebuild sqlite3 || true
pnpm rebuild bcrypt || true

# Set ownership
chown -R smart-panel:smart-panel "${APP_INSTALL_DIR}"
chown -R smart-panel:smart-panel "${DATA_DIR}"

# Clean up temp files
rm -rf /tmp/smart-panel-files

echo "Smart Panel installed to ${APP_INSTALL_DIR}"
