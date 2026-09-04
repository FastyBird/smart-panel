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

# Add smart-panel to input and video groups for hardware access
# (input: button events via /dev/input, video: vcgencmd)
usermod -aG input,video smart-panel

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

# node-gyp downloads Node's headers from nodejs.org unless told where they already
# are, and unlike pnpm it does not retry that download. On an update this script runs
# straight after pnpm has pulled the whole dependency tree, so the link is often still
# saturated and a timed-out header fetch aborts and rolls back a complete update.
# Node is installed from a tarball that ships headers matching the running binary, so
# point node-gyp at those and skip the download entirely.
if [ -z "${npm_config_nodedir:-}" ]; then
	NODE_BIN="$(command -v node || true)"

	if [ -n "${NODE_BIN}" ]; then
		# <prefix>/bin/node, so the grandparent is the install prefix.
		NODE_PREFIX="$(dirname "$(dirname "${NODE_BIN}")")"

		if [ -f "${NODE_PREFIX}/include/node/node.h" ]; then
			export npm_config_nodedir="${NODE_PREFIX}"
			echo "Using local Node headers from ${NODE_PREFIX}/include/node"
		fi
	fi
fi

# Whatever still has to reach the network gets a few attempts rather than failing an
# update on one blip.
build_native() {
	local dir="$1" name="$2" attempt

	for attempt in 1 2 3; do
		if (cd "${dir}" && node-gyp rebuild --release); then
			return 0
		fi

		if [ "${attempt}" -lt 3 ]; then
			echo "${name} build failed (attempt ${attempt}/3), retrying in $((attempt * 10))s..."
			sleep $((attempt * 10))
		fi
	done

	echo "${name} build failed after 3 attempts"

	return 1
}

SQLITE_DIR=$(find "${APP_DIR}/node_modules/.pnpm" -path "*/sqlite3/package.json" -exec dirname {} \; | head -1)
if [ -n "${SQLITE_DIR}" ] && [ ! -f "${SQLITE_DIR}/build/Release/node_sqlite3.node" ]; then
	echo "Building sqlite3 native module..."
	build_native "${SQLITE_DIR}" sqlite3
fi

BCRYPT_DIR=$(find "${APP_DIR}/node_modules/.pnpm" -path "*/bcrypt/package.json" -exec dirname {} \; | grep "bcrypt@" | head -1)
if [ -n "${BCRYPT_DIR}" ] && [ ! -f "${BCRYPT_DIR}/build/Release/bcrypt_lib.node" ]; then
	echo "Building bcrypt native module..."
	build_native "${BCRYPT_DIR}" bcrypt
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
