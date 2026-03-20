#!/bin/bash -e
#
# Install Node.js 24.x and InfluxDB 1.8
#
# Node.js is installed from the official binary tarball instead of
# NodeSource apt repo to avoid OOM issues during QEMU-emulated
# apt-get update on CI runners.
#

NODE_MAJOR=24
ARCH=$(dpkg --print-architecture)

# Map Debian arch to Node.js arch
case "${ARCH}" in
	arm64|aarch64) NODE_ARCH="arm64" ;;
	armhf|armv7l)  NODE_ARCH="armv7l" ;;
	amd64|x86_64)  NODE_ARCH="x64" ;;
	*)
		echo "Unsupported architecture: ${ARCH}"
		exit 1
		;;
esac

# Get latest Node.js 24.x version
echo "Fetching latest Node.js ${NODE_MAJOR}.x version..."
NODE_VERSION=$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/" | grep -oP 'node-v\K[0-9]+\.[0-9]+\.[0-9]+' | head -1)

if [ -z "${NODE_VERSION}" ]; then
	echo "Failed to determine latest Node.js ${NODE_MAJOR}.x version"
	exit 1
fi

echo "Installing Node.js v${NODE_VERSION} for ${NODE_ARCH}..."

# Download and extract binary tarball
curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
	| tar -xJ -C /usr/local --strip-components=1

# Verify
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@10 --activate
echo "pnpm version: $(pnpm --version)"

# Install node-gyp globally (needed for native module compilation on first boot)
npm install -g node-gyp

# ──────────────────────────────────────────────────────────────
# Install InfluxDB 1.8.x
# ──────────────────────────────────────────────────────────────
# Download the deb package directly instead of adding the apt repo
# (avoids apt-get update OOM under QEMU)
echo "Installing InfluxDB 1.8..."

INFLUX_VERSION="1.8.10"
curl -fsSL "https://repos.influxdata.com/debian/pool/stable/i/influxdb/influxdb_${INFLUX_VERSION}_${ARCH}.deb" \
	-o /tmp/influxdb.deb \
	&& dpkg -i /tmp/influxdb.deb \
	&& rm -f /tmp/influxdb.deb \
	|| {
		echo "WARNING: InfluxDB installation failed — metrics features will be unavailable"
	}

# Enable InfluxDB service
systemctl enable influxdb 2>/dev/null || true

echo "InfluxDB version: $(influxd version 2>&1 || echo 'not installed')"
