#!/bin/bash -e
#
# Install Node.js 22.x from NodeSource and InfluxDB 1.8
#

# Install NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

# Install Node.js
apt-get install -y nodejs

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@10 --activate

# Verify Node.js installation
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "pnpm version: $(pnpm --version)"

# ──────────────────────────────────────────────────────────────
# Install InfluxDB 1.8.x
# ──────────────────────────────────────────────────────────────
curl -fsSL https://repos.influxdata.com/influxdata-archive.key | gpg --dearmor -o /usr/share/keyrings/influxdb-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/influxdb-archive-keyring.gpg] https://repos.influxdata.com/debian bookworm stable" > /etc/apt/sources.list.d/influxdb.list
apt-get update
apt-get install -y influxdb

# Enable InfluxDB service
systemctl enable influxdb

echo "InfluxDB version: $(influxd version 2>&1 || true)"
