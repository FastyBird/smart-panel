#!/bin/bash -e
#
# Install Node.js 22.x from NodeSource
#

# Install NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

# Install Node.js
apt-get install -y nodejs

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@10 --activate

# Verify installation
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "pnpm version: $(pnpm --version)"
