#!/bin/bash -e
#
# Install Node.js 24.x, InfluxDB 1.8, and Tailscale
#
# Node.js is installed from the official binary tarball instead of
# NodeSource apt repo to avoid OOM issues during QEMU-emulated
# apt-get update on CI runners. Tailscale is a small package, so
# installing it via its official apt repo doesn't hit that issue.
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
curl -fsSL "https://dl.influxdata.com/influxdb/releases/influxdb_${INFLUX_VERSION}_${ARCH}.deb" \
	-o /tmp/influxdb.deb \
	&& dpkg -i /tmp/influxdb.deb \
	&& rm -f /tmp/influxdb.deb \
	|| {
		echo "WARNING: InfluxDB installation failed — metrics features will be unavailable"
	}

# Enable InfluxDB service
systemctl enable influxdb 2>/dev/null || true

echo "InfluxDB version: $(influxd version 2>&1 || echo 'not installed')"

# ──────────────────────────────────────────────────────────────
# Install Tailscale (kept disabled — the remote-access plugin
# enables tailscaled once the operator opts in during setup)
# ──────────────────────────────────────────────────────────────
# Chained with && / || instead of relying on set -e, like the InfluxDB
# install above: a transient apt/network failure here shouldn't fail
# the whole image build.
echo "Installing Tailscale..."

curl -fsSL https://pkgs.tailscale.com/stable/raspbian/bookworm.noarmor.gpg \
	-o /usr/share/keyrings/tailscale-archive-keyring.gpg \
	&& curl -fsSL https://pkgs.tailscale.com/stable/raspbian/bookworm.tailscale-keyring.list \
		-o /etc/apt/sources.list.d/tailscale.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends tailscale \
	|| {
		echo "WARNING: Tailscale installation failed — remote access will be unavailable"
	}

# Ship the image with the daemon inactive; the backend remote-access
# plugin enables and starts it once the operator opts in. Guarded in
# case the package above failed to install (no such unit to disable).
systemctl disable tailscaled 2>/dev/null || true

echo "Tailscale version: $(tailscale version 2>&1 | head -1 || echo 'not installed')"
