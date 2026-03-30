#!/bin/bash

#
# FastyBird Smart Panel Installation Script
#
# Usage:
#   curl -fsSL https://get.smart-panel.fastybird.com | sudo bash
#
# Options:
#   --alpha   Install alpha (dev) version
#   --beta    Install beta version
#   --version Install specific version (e.g., --version 1.0.0)
#   --port    Set HTTP port (default: 3000)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_NAME="@fastybird/smart-panel"
NODE_MIN_VERSION=24
DEFAULT_PORT=3000

# Parse arguments
VERSION=""
ALPHA=false
BETA=false
PORT=$DEFAULT_PORT

while [[ $# -gt 0 ]]; do
	case $1 in
		--alpha)
			ALPHA=true
			shift
			;;
		--beta)
			BETA=true
			shift
			;;
		--version)
			VERSION="$2"
			shift 2
			;;
		--port)
			PORT="$2"
			shift 2
			;;
		*)
			shift
			;;
	esac
done

# Functions
print_header() {
	echo ""
	echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
	echo -e "${CYAN}║${NC}       ${BLUE}FastyBird Smart Panel${NC} - Installation Script         ${CYAN}║${NC}"
	echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
	echo ""
}

print_step() {
	echo -e "${BLUE}→${NC} $1"
}

print_success() {
	echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
	echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
	echo -e "${RED}✗${NC} $1"
}

check_root() {
	if [[ $EUID -ne 0 ]]; then
		print_error "This script must be run as root (use sudo)"
		exit 1
	fi
}

check_os() {
	if [[ "$(uname)" != "Linux" ]]; then
		print_error "This installation script only supports Linux"
		exit 1
	fi

	# Check for systemd
	if [[ ! -d /run/systemd/system ]]; then
		print_error "systemd is required but not detected"
		exit 1
	fi
}

get_distro() {
	if [[ -f /etc/os-release ]]; then
		. /etc/os-release
		echo "$ID"
	else
		echo "unknown"
	fi
}

get_arch() {
	local arch=$(uname -m)
	case $arch in
		armv7l|armv6l)
			echo "armv7"
			;;
		aarch64|arm64)
			echo "arm64"
			;;
		x86_64)
			echo "x64"
			;;
		*)
			echo "$arch"
			;;
	esac
}

install_build_deps() {
	print_step "Installing build dependencies..."

	local distro=$(get_distro)

	case $distro in
		debian|ubuntu|raspbian)
			apt-get update -qq
			apt-get install -y -qq build-essential python3 sqlite3 curl git
			;;
		fedora|centos|rhel|rocky|almalinux)
			dnf install -y gcc gcc-c++ make python3 sqlite curl git || \
			yum install -y gcc gcc-c++ make python3 sqlite curl git
			;;
		arch|manjaro)
			pacman -Sy --noconfirm base-devel python sqlite curl git
			;;
		*)
			print_warning "Could not install build dependencies for $distro — install manually if npm install fails"
			return 0
			;;
	esac

	print_success "Build dependencies installed"
}

install_influxdb() {
	print_step "Checking InfluxDB installation..."

	if command -v influxd &> /dev/null; then
		print_success "InfluxDB is already installed ($(influxd version 2>&1 | head -1))"
		# Ensure it's running
		systemctl enable influxdb 2>/dev/null || true
		systemctl start influxdb 2>/dev/null || true
		return 0
	fi

	print_step "Installing InfluxDB 1.8..."

	local distro=$(get_distro)
	local arch=$(uname -m)

	case $distro in
		debian|ubuntu|raspbian)
			curl -fsSL https://repos.influxdata.com/influxdata-archive.key | gpg --dearmor -o /usr/share/keyrings/influxdb-archive-keyring.gpg
			echo "deb [signed-by=/usr/share/keyrings/influxdb-archive-keyring.gpg] https://repos.influxdata.com/debian stable main" > /etc/apt/sources.list.d/influxdb.list
			apt-get update -qq
			apt-get install -y -qq influxdb
			;;
		fedora|centos|rhel|rocky|almalinux)
			cat > /etc/yum.repos.d/influxdb.repo << 'REPO'
[influxdb]
name = InfluxDB Repository
baseurl = https://repos.influxdata.com/rhel/\$releasever/\$basearch/stable
enabled = 1
gpgcheck = 1
gpgkey = https://repos.influxdata.com/influxdata-archive.key
REPO
			dnf install -y influxdb || yum install -y influxdb
			;;
		*)
			print_warning "Could not install InfluxDB for $distro"
			print_warning "Install InfluxDB 1.8 manually for metrics and historical data"
			return 0
			;;
	esac

	systemctl enable influxdb
	systemctl start influxdb

	# Wait for InfluxDB to be ready
	local ready=false
	for i in $(seq 1 15); do
		if influx -execute "SHOW DATABASES" >/dev/null 2>&1; then
			ready=true
			break
		fi
		sleep 1
	done

	if [ "$ready" = true ]; then
		# Create database and retention policies
		influx -execute "CREATE DATABASE fastybird"
		influx -execute "CREATE RETENTION POLICY raw_24h ON fastybird DURATION 24h REPLICATION 1 DEFAULT" 2>/dev/null \
			|| influx -execute "ALTER RETENTION POLICY raw_24h ON fastybird DURATION 24h REPLICATION 1 DEFAULT"
		influx -execute "CREATE RETENTION POLICY min_14d ON fastybird DURATION 14d REPLICATION 1" 2>/dev/null \
			|| influx -execute "ALTER RETENTION POLICY min_14d ON fastybird DURATION 14d REPLICATION 1"
		print_success "InfluxDB installed and configured (database: fastybird)"
	else
		print_warning "InfluxDB installed but failed to start — configure manually"
	fi
}

install_nodejs() {
	print_step "Checking Node.js installation..."

	if command -v node &> /dev/null; then
		local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
		if [[ $node_version -ge $NODE_MIN_VERSION ]]; then
			print_success "Node.js v$(node -v | cut -d'v' -f2) is installed"
			return 0
		else
			print_warning "Node.js v$(node -v | cut -d'v' -f2) is too old (requires v$NODE_MIN_VERSION+)"
		fi
	else
		print_warning "Node.js is not installed"
	fi

	print_step "Installing Node.js v$NODE_MIN_VERSION..."

	local distro=$(get_distro)

	case $distro in
		debian|ubuntu|raspbian)
			# Install via NodeSource
			curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x | bash -
			apt-get install -y nodejs
			;;
		fedora|centos|rhel|rocky|almalinux)
			curl -fsSL https://rpm.nodesource.com/setup_${NODE_MIN_VERSION}.x | bash -
			dnf install -y nodejs || yum install -y nodejs
			;;
		arch|manjaro)
			pacman -Sy --noconfirm nodejs npm
			;;
		*)
			print_error "Unsupported distribution: $distro"
			print_error "Please install Node.js v$NODE_MIN_VERSION+ manually and re-run this script"
			exit 1
			;;
	esac

	if ! command -v node &> /dev/null; then
		print_error "Failed to install Node.js"
		exit 1
	fi

	print_success "Node.js v$(node -v | cut -d'v' -f2) installed"
}

install_smart_panel() {
	print_step "Installing Smart Panel..."

	local install_cmd="npm install -g $PACKAGE_NAME"

	if [[ -n "$VERSION" ]]; then
		install_cmd="npm install -g $PACKAGE_NAME@$VERSION"
	elif [[ "$ALPHA" == true ]]; then
		install_cmd="npm install -g $PACKAGE_NAME@alpha"
	elif [[ "$BETA" == true ]]; then
		install_cmd="npm install -g $PACKAGE_NAME@beta"
	fi

	echo ""
	echo "  Running: $install_cmd"
	echo ""

	if ! $install_cmd; then
		print_error "Failed to install Smart Panel package"
		exit 1
	fi

	print_success "Smart Panel package installed"
}

configure_service() {
	print_step "Configuring Smart Panel service..."

	if ! command -v smart-panel-service &> /dev/null; then
		print_error "smart-panel-service command not found"
		print_error "Installation may have failed"
		exit 1
	fi

	# Install and start service
	smart-panel-service install --port "$PORT"
}

print_completion() {
	local ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}')
	[[ -z "$ip_addr" ]] && ip_addr="localhost"

	echo ""
	echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
	echo -e "${GREEN}║${NC}              Installation Complete!                        ${GREEN}║${NC}"
	echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
	echo ""
	echo -e "  Smart Panel is now running!"
	echo ""
	echo -e "  ${CYAN}Access the admin UI at:${NC}"
	echo -e "    http://${ip_addr}:${PORT}"
	echo ""
	echo -e "  ${CYAN}Useful commands:${NC}"
	echo -e "    sudo smart-panel-service status   - Check service status"
	echo -e "    sudo smart-panel-service logs -f  - View live logs"
	echo -e "    sudo smart-panel-service restart  - Restart the service"
	echo -e "    sudo smart-panel-service update   - Update to latest version"
	echo ""
	echo -e "  ${CYAN}Documentation:${NC}"
	echo -e "    https://smart-panel.fastybird.com/docs"
	echo ""
}

# Main
main() {
	print_header

	# System info
	local distro=$(get_distro)
	local arch=$(get_arch)
	print_step "System: $distro ($arch)"
	echo ""

	# Checks
	check_root
	check_os

	# Install dependencies
	install_build_deps
	install_nodejs
	install_influxdb

	# Install Smart Panel
	install_smart_panel
	configure_service

	# Done
	print_completion
}

main
