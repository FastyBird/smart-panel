#!/bin/bash -e
#
# Install the Smart Panel application
#
# Uses a versioned directory layout with a "current" symlink:
#   /opt/smart-panel/
#     current -> v1.0.0/          # symlink to active version
#     v1.0.0/                     # app files for this version
#       .image-install            # marker file
#       dist/
#       node_modules/
#       static/
#       ...
#

APP_BASE_DIR="/opt/smart-panel"
DATA_DIR="/var/lib/smart-panel"

# Read the version from package.json
APP_VERSION=$(node -p "require('/tmp/smart-panel-files/app/package.json').version")
APP_INSTALL_DIR="${APP_BASE_DIR}/v${APP_VERSION}"

# Create system user
if ! id -u smart-panel >/dev/null 2>&1; then
	useradd --system --home-dir "${DATA_DIR}" --shell /usr/sbin/nologin --create-home smart-panel
fi

# Create directories
mkdir -p "${APP_BASE_DIR}"
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

# Create image-install marker file
touch "${APP_INSTALL_DIR}/.image-install"

# Install production dependencies
cd "${APP_INSTALL_DIR}"
pnpm install --prod --ignore-scripts

# Native modules (sqlite3, bcrypt) are compiled on first boot instead of
# during image build. QEMU-emulated ARM64 compilation on x86 CI runners
# exhausts memory. Native ARM64 compilation on the Pi takes ~30 seconds.
npm install -g node-gyp

# Create a script for first-boot native module rebuild.
# Accepts an optional APP_DIR argument for use during updates.
cat > "${APP_BASE_DIR}/rebuild-native.sh" << 'REBUILD_SCRIPT'
#!/bin/bash
set -e
APP_DIR="${1:-/opt/smart-panel/current}"
cd "${APP_DIR}"

# Use node-gyp rebuild directly instead of npm install --build-from-source.
# npm install inside a pnpm-managed package corrupts the pnpm virtual store
# by creating its own node_modules hierarchy.

SQLITE_DIR=$(find "${APP_DIR}/node_modules/.pnpm" -path "*/sqlite3/package.json" -exec dirname {} \; | head -1)
if [ -n "${SQLITE_DIR}" ] && [ ! -f "${SQLITE_DIR}/build/Release/node_sqlite3.node" ]; then
	echo "Building sqlite3 native module..."
	cd "${SQLITE_DIR}" && node-gyp rebuild --release
fi

BCRYPT_DIR=$(find "${APP_DIR}/node_modules/.pnpm" -path "*/bcrypt/package.json" -exec dirname {} \; | grep "bcrypt@" | head -1)
if [ -n "${BCRYPT_DIR}" ] && [ ! -f "${BCRYPT_DIR}/build/Release/bcrypt_lib.node" ]; then
	echo "Building bcrypt native module..."
	cd "${BCRYPT_DIR}" && node-gyp rebuild --release
fi

echo "Native modules ready"
REBUILD_SCRIPT
chmod +x "${APP_BASE_DIR}/rebuild-native.sh"

# Create the "current" symlink pointing to this version
ln -sfn "${APP_INSTALL_DIR}" "${APP_BASE_DIR}/current"

# Set ownership
chown -R smart-panel:smart-panel "${APP_BASE_DIR}"
chown -R smart-panel:smart-panel "${DATA_DIR}"

# Clean up temp files
rm -rf /tmp/smart-panel-files

echo "Smart Panel v${APP_VERSION} installed to ${APP_INSTALL_DIR}"
echo "Symlink: ${APP_BASE_DIR}/current -> v${APP_VERSION}/"
