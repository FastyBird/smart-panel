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

# Copy extension-sdk (referenced as file:./extension-sdk in package.json)
if [ -d /tmp/smart-panel-files/app/extension-sdk ]; then
	cp -r /tmp/smart-panel-files/app/extension-sdk "${APP_INSTALL_DIR}/extension-sdk"
fi

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

# Rebuild native modules for ARM64
npm install -g node-gyp

SQLITE_DIR=$(find "${APP_INSTALL_DIR}/node_modules/.pnpm" -path "*/sqlite3/package.json" -exec dirname {} \; | head -1)
if [ -n "${SQLITE_DIR}" ]; then
	echo "Building sqlite3 from source in ${SQLITE_DIR}..."
	cd "${SQLITE_DIR}" && npm install --build-from-source
fi

BCRYPT_DIR=$(find "${APP_INSTALL_DIR}/node_modules/.pnpm" -path "*/bcrypt/package.json" -exec dirname {} \; | grep "bcrypt@" | head -1)
if [ -n "${BCRYPT_DIR}" ]; then
	echo "Building bcrypt from source in ${BCRYPT_DIR}..."
	cd "${BCRYPT_DIR}" && npm install --build-from-source
fi

cd "${APP_INSTALL_DIR}"

# Set ownership
chown -R smart-panel:smart-panel "${APP_INSTALL_DIR}"
chown -R smart-panel:smart-panel "${DATA_DIR}"

# Clean up temp files
rm -rf /tmp/smart-panel-files

echo "Smart Panel installed to ${APP_INSTALL_DIR}"
