#!/bin/bash

#
# FastyBird Smart Panel - Display App Installation Script
#
# Installs the Smart Panel display (panel) app on:
#   - Raspberry Pi (via flutter-pi)
#   - Linux desktop (x64, with X11/Wayland or cage for kiosk mode)
#   - Android (via ADB sideload)
#
# Usage:
#   curl -fsSL https://get.smart-panel.fastybird.com/panel | sudo bash
#
# Options:
#   --backend <url>   Backend URL (e.g., http://192.168.1.100:3000)
#   --version <ver>   Install specific version
#   --beta            Install beta version
#   --platform <p>    Force platform: flutter-pi, elinux, linux, android
#   --kiosk           Enable kiosk mode (auto-start on boot, no desktop)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
GITHUB_REPO="FastyBird/smart-panel"
INSTALL_DIR="/opt/smart-panel-display"
SERVICE_NAME="smart-panel-display"

# Parse arguments
BACKEND_URL=""
VERSION=""
BETA=false
PLATFORM=""
KIOSK=false

while [[ $# -gt 0 ]]; do
	case $1 in
		--backend)
			BACKEND_URL="$2"
			shift 2
			;;
		--version)
			VERSION="$2"
			shift 2
			;;
		--beta)
			BETA=true
			shift
			;;
		--platform)
			PLATFORM="$2"
			shift 2
			;;
		--kiosk)
			KIOSK=true
			shift
			;;
		*)
			shift
			;;
	esac
done

# Functions
print_header() {
	echo ""
	echo -e "${CYAN}+------------------------------------------------------------+${NC}"
	echo -e "${CYAN}|${NC}    ${BLUE}FastyBird Smart Panel${NC} - Display App Installer            ${CYAN}|${NC}"
	echo -e "${CYAN}+------------------------------------------------------------+${NC}"
	echo ""
}

print_step() {
	echo -e "${BLUE}->${NC} $1"
}

print_success() {
	echo -e "${GREEN}OK${NC} $1"
}

print_warning() {
	echo -e "${YELLOW}!!${NC} $1"
}

print_error() {
	echo -e "${RED}ERROR${NC} $1"
}

check_root() {
	if [[ $EUID -ne 0 ]]; then
		print_error "This script must be run as root (use sudo)"
		exit 1
	fi
}

get_arch() {
	local arch=$(uname -m)
	case $arch in
		armv7l|armv6l)
			print_error "32-bit ARM (armv7/armv6) is no longer supported. Please use a 64-bit OS."
			exit 1
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

detect_platform() {
	if [[ -n "$PLATFORM" ]]; then
		echo "$PLATFORM"
		return
	fi

	local arch=$(get_arch)

	# Check if this is a Raspberry Pi
	if [[ -f /proc/device-tree/model ]] && grep -qi "raspberry" /proc/device-tree/model 2>/dev/null; then
		echo "flutter-pi"
		return
	fi

	# Check for ARM64 (likely embedded Linux, use flutter-pi)
	if [[ "$arch" == "arm64" ]]; then
		echo "flutter-pi"
		return
	fi

	# x64 Linux - use elinux (no desktop environment required)
	if [[ "$arch" == "x64" ]]; then
		echo "elinux"
		return
	fi

	print_error "Unsupported architecture: $arch"
	exit 1
}

get_latest_release_tag() {
	local api_url="https://api.github.com/repos/${GITHUB_REPO}/releases"

	if [[ "$BETA" == true ]]; then
		# Get latest beta pre-release (filter by prerelease flag AND beta tag pattern)
		local json
		json=$(curl -sL "$api_url?per_page=20")

		if command -v jq &>/dev/null; then
			echo "$json" | jq -r '[.[] | select(.prerelease == true and (.tag_name | test("-beta")))][0].tag_name // empty'
		else
			echo "$json" | python3 -c "
import sys, json
for r in json.load(sys.stdin):
    if r.get('prerelease') and '-beta' in r.get('tag_name', ''):
        print(r['tag_name']); break
" 2>/dev/null
		fi
	elif [[ -n "$VERSION" ]]; then
		echo "v${VERSION}"
	else
		# Get latest stable release
		curl -sL "$api_url/latest" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4
	fi
}

install_flutter_pi_deps() {
	print_step "Installing flutter-pi dependencies..."

	local distro=""
	if [[ -f /etc/os-release ]]; then
		. /etc/os-release
		distro="$ID"
	fi

	case $distro in
		debian|ubuntu|raspbian)
			apt-get update -qq
			apt-get install -y -qq libgl1-mesa-dev libgles2-mesa-dev libegl1-mesa-dev \
				libdrm-dev libgbm-dev libsystemd-dev libinput-dev libudev-dev \
				libxkbcommon-dev cmake git 2>/dev/null
			;;
		*)
			print_warning "Unknown distro '$distro'. Please ensure EGL/DRM libraries are installed."
			;;
	esac

	# Install flutter-pi if not present
	if ! command -v flutter-pi &> /dev/null; then
		print_step "Installing flutter-pi runtime..."
		if command -v git &> /dev/null; then
			local flutterpi_dir="/opt/flutter-pi"
			if [[ ! -d "$flutterpi_dir" ]]; then
				git clone --depth 1 https://github.com/ardera/flutter-pi.git "$flutterpi_dir"
				cd "$flutterpi_dir"
				mkdir -p build && cd build
				cmake ..
				make -j$(nproc)
				make install
				cd /
			fi
		else
			print_error "git is required to install flutter-pi"
			exit 1
		fi
	fi

	print_success "flutter-pi dependencies installed"
}

install_elinux_deps() {
	print_step "Installing eLinux (DRM-GBM) dependencies..."

	local distro=""
	if [[ -f /etc/os-release ]]; then
		. /etc/os-release
		distro="$ID"
	fi

	case $distro in
		debian|ubuntu)
			apt-get update -qq
			apt-get install -y -qq libegl1-mesa libgles2-mesa libxkbcommon0 \
				libdrm2 libgbm1 libinput10 libudev1 libsystemd0 2>/dev/null
			;;
		fedora|centos|rhel|rocky|almalinux)
			dnf install -y mesa-libEGL mesa-libGLES libxkbcommon \
				libdrm mesa-libgbm libinput systemd-libs 2>/dev/null || \
			yum install -y mesa-libEGL mesa-libGLES libxkbcommon \
				libdrm mesa-libgbm libinput systemd-libs 2>/dev/null
			;;
		arch|manjaro)
			pacman -Sy --noconfirm mesa libxkbcommon libdrm libinput systemd 2>/dev/null
			;;
		*)
			print_warning "Unknown distro '$distro'. Please ensure EGL/DRM/GBM libraries are installed."
			;;
	esac

	print_success "eLinux dependencies installed"
}

install_linux_desktop_deps() {
	print_step "Installing Linux desktop dependencies..."

	local distro=""
	if [[ -f /etc/os-release ]]; then
		. /etc/os-release
		distro="$ID"
	fi

	case $distro in
		debian|ubuntu)
			apt-get update -qq
			apt-get install -y -qq libgtk-3-0 libblkid1 liblzma5 2>/dev/null

			if [[ "$KIOSK" == true ]]; then
				apt-get install -y -qq cage 2>/dev/null || true
			fi
			;;
		fedora|centos|rhel|rocky|almalinux)
			dnf install -y gtk3 xz-libs 2>/dev/null || yum install -y gtk3 xz-libs 2>/dev/null

			if [[ "$KIOSK" == true ]]; then
				dnf install -y cage 2>/dev/null || true
			fi
			;;
		arch|manjaro)
			pacman -Sy --noconfirm gtk3 xz 2>/dev/null

			if [[ "$KIOSK" == true ]]; then
				pacman -Sy --noconfirm cage 2>/dev/null || true
			fi
			;;
		*)
			print_warning "Unknown distro '$distro'. Please ensure GTK3 is installed."
			;;
	esac

	print_success "Linux desktop dependencies installed"
}

download_and_extract() {
	local tag="$1"
	local asset_name="$2"
	local dest_dir="$3"

	local download_url="https://github.com/${GITHUB_REPO}/releases/download/${tag}/${asset_name}"

	print_step "Downloading ${asset_name}..."

	mkdir -p "$dest_dir"

	if [[ "$asset_name" == *.apk ]]; then
		curl -sL "$download_url" -o "${dest_dir}/${asset_name}"
	else
		curl -sL "$download_url" | tar -xzf - -C "$dest_dir"
	fi

	print_success "Downloaded and extracted to ${dest_dir}"
}

create_systemd_service_flutterpi() {
	local service_file="/etc/systemd/system/${SERVICE_NAME}.service"

	cat > "$service_file" << EOF
[Unit]
Description=FastyBird Smart Panel Display (flutter-pi)
After=network.target smart-panel-discovery.service
Wants=network.target smart-panel-discovery.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/local/bin/flutter-pi --release ${INSTALL_DIR}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Allow GPU access
SupplementaryGroups=video render input

[Install]
WantedBy=multi-user.target
EOF

	systemctl daemon-reload
	systemctl enable "$SERVICE_NAME"
}

create_systemd_service_elinux() {
	local service_file="/etc/systemd/system/${SERVICE_NAME}.service"

	# Find the main executable (ELF binary, not data files)
	local exec_name="${INSTALL_DIR}/fastybird_smart_panel"
	if [[ ! -x "$exec_name" ]]; then
		exec_name=$(find "${INSTALL_DIR}" -maxdepth 1 -type f -executable -exec file {} \; | grep -i 'elf' | head -1 | cut -d: -f1)
	fi
	if [[ -z "$exec_name" ]]; then
		print_error "Could not find executable in ${INSTALL_DIR}"
		exit 1
	fi

	cat > "$service_file" << EOF
[Unit]
Description=FastyBird Smart Panel Display (eLinux DRM-GBM)
After=multi-user.target
Wants=multi-user.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=FLUTTER_DRM_DEVICE=/dev/dri/card0
ExecStart=${exec_name} --bundle=${INSTALL_DIR} --fullscreen --no-cursor
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Allow GPU and input access
SupplementaryGroups=video render input

[Install]
WantedBy=multi-user.target
EOF

	systemctl daemon-reload
	systemctl enable "$SERVICE_NAME"
}

create_systemd_service_linux() {
	local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
	local exec_cmd="${INSTALL_DIR}/fastybird_smart_panel"

	# If kiosk mode, wrap with cage (Wayland compositor for kiosk)
	if [[ "$KIOSK" == true ]] && command -v cage &> /dev/null; then
		exec_cmd="cage -s -- ${INSTALL_DIR}/fastybird_smart_panel"
	fi

	cat > "$service_file" << EOF
[Unit]
Description=FastyBird Smart Panel Display (Linux Desktop)
After=network.target
Wants=network.target

[Service]
Type=simple
User=smart-panel-display
WorkingDirectory=${INSTALL_DIR}
ExecStart=${exec_cmd}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# GPU access
SupplementaryGroups=video render input

[Install]
WantedBy=graphical.target
EOF

	# Create service user if it doesn't exist
	if ! id "smart-panel-display" &>/dev/null; then
		useradd --system --no-create-home --shell /usr/sbin/nologin \
			--groups video,render,input smart-panel-display 2>/dev/null || true
	fi

	systemctl daemon-reload
	systemctl enable "$SERVICE_NAME"
}

install_android() {
	local tag="$1"

	if ! command -v adb &> /dev/null; then
		print_error "ADB is required for Android installation"
		print_error "Install with: apt-get install android-tools-adb"
		exit 1
	fi

	# Check for connected device
	local devices=$(adb devices | grep -c "device$")
	if [[ "$devices" -eq 0 ]]; then
		print_error "No Android device connected via ADB"
		print_error "Connect your device and enable USB debugging"
		exit 1
	fi

	local version="${tag#v}"
	local download_url="https://github.com/${GITHUB_REPO}/releases/download/${tag}/smart-panel-display-android-${version}.apk"
	local apk_path="/tmp/smart-panel-display-android-${version}.apk"

	print_step "Downloading APK..."
	curl -sL "$download_url" -o "$apk_path"

	print_step "Installing APK via ADB..."
	adb install -r "$apk_path"

	rm -f "$apk_path"

	print_success "APK installed on connected Android device"

	# Optionally set as launcher/kiosk
	if [[ "$KIOSK" == true ]]; then
		print_step "Setting as default launcher (kiosk mode)..."
		adb shell cmd package set-home-activity com.fastybird.smartpanel/.MainActivity 2>/dev/null || \
			print_warning "Could not set as default launcher. Please set manually in device settings."
	fi
}

install_discovery_service() {
	local tag="$1"

	print_step "Installing mDNS discovery proxy service..."

	# Copy discovery script
	local script_url="https://raw.githubusercontent.com/${GITHUB_REPO}/${tag}/build/raspbian/modules/configure/files/smart-panel-discovery.py"
	curl -sfL "$script_url" -o "${INSTALL_DIR}/discovery-service.py"
	chmod +x "${INSTALL_DIR}/discovery-service.py"

	# Create systemd service
	local service_file="/etc/systemd/system/smart-panel-discovery.service"

	cat > "$service_file" << EOF
[Unit]
Description=Smart Panel mDNS Discovery Proxy
After=avahi-daemon.service network-online.target
Wants=avahi-daemon.service network-online.target
Before=smart-panel-display.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/discovery-service.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=smart-panel-discovery

[Install]
WantedBy=multi-user.target
EOF

	# Ensure avahi-browse is available
	if ! command -v avahi-browse &> /dev/null; then
		apt-get install -y -qq avahi-utils 2>/dev/null || true
	fi

	systemctl daemon-reload
	systemctl enable smart-panel-discovery

	print_success "mDNS discovery proxy service installed"
}

configure_backend_url() {
	if [[ -z "$BACKEND_URL" ]]; then
		return
	fi

	local config_dir="${INSTALL_DIR}/config"
	mkdir -p "$config_dir"

	cat > "${config_dir}/panel.json" << EOF
{
  "backend_url": "${BACKEND_URL}"
}
EOF

	print_success "Backend URL configured: ${BACKEND_URL}"
}

print_completion() {
	local platform="$1"

	echo ""
	echo -e "${GREEN}+------------------------------------------------------------+${NC}"
	echo -e "${GREEN}|${NC}              Installation Complete!                        ${GREEN}|${NC}"
	echo -e "${GREEN}+------------------------------------------------------------+${NC}"
	echo ""

	case $platform in
		flutter-pi)
			echo -e "  Smart Panel Display installed for ${CYAN}Raspberry Pi (flutter-pi)${NC}"
			echo ""
			echo -e "  ${CYAN}Manage the service:${NC}"
			echo -e "    sudo systemctl start ${SERVICE_NAME}"
			echo -e "    sudo systemctl stop ${SERVICE_NAME}"
			echo -e "    sudo systemctl status ${SERVICE_NAME}"
			echo -e "    sudo journalctl -u ${SERVICE_NAME} -f"
			;;
		elinux)
			echo -e "  Smart Panel Display installed for ${CYAN}Linux (eLinux DRM-GBM, no GUI required)${NC}"
			echo ""
			echo -e "  ${CYAN}The app renders directly to the display via DRM/KMS.${NC}"
			echo -e "  ${CYAN}No X11 or Wayland desktop environment is needed.${NC}"
			echo ""
			echo -e "  ${CYAN}Manage the service:${NC}"
			echo -e "    sudo systemctl start ${SERVICE_NAME}"
			echo -e "    sudo systemctl stop ${SERVICE_NAME}"
			echo -e "    sudo systemctl status ${SERVICE_NAME}"
			echo -e "    sudo journalctl -u ${SERVICE_NAME} -f"
			echo ""
			echo -e "  ${CYAN}Run manually:${NC}"
			echo -e "    sudo FLUTTER_DRM_DEVICE=/dev/dri/card0 ${INSTALL_DIR}/<app_binary> --bundle=${INSTALL_DIR} --fullscreen"
			;;
		linux)
			echo -e "  Smart Panel Display installed for ${CYAN}Linux Desktop${NC}"
			echo ""
			if [[ "$KIOSK" == true ]]; then
				echo -e "  ${CYAN}Kiosk mode enabled. Manage the service:${NC}"
				echo -e "    sudo systemctl start ${SERVICE_NAME}"
				echo -e "    sudo systemctl stop ${SERVICE_NAME}"
				echo -e "    sudo systemctl status ${SERVICE_NAME}"
				echo -e "    sudo journalctl -u ${SERVICE_NAME} -f"
			else
				echo -e "  ${CYAN}Run manually:${NC}"
				echo -e "    ${INSTALL_DIR}/fastybird_smart_panel"
				echo ""
				echo -e "  ${CYAN}Or enable as a service:${NC}"
				echo -e "    sudo systemctl start ${SERVICE_NAME}"
			fi
			;;
		android)
			echo -e "  Smart Panel Display installed on ${CYAN}Android device${NC}"
			echo ""
			echo -e "  Open the app from the Android launcher."
			;;
	esac

	if [[ -n "$BACKEND_URL" ]]; then
		echo ""
		echo -e "  ${CYAN}Backend:${NC} ${BACKEND_URL}"
	else
		echo ""
		echo -e "  ${YELLOW}Note:${NC} Configure your backend URL in the app settings"
		echo -e "  on first launch, or re-run with --backend <url>"
	fi

	echo ""
}

# Main
main() {
	print_header

	local arch=$(get_arch)
	local platform=$(detect_platform)

	print_step "Architecture: ${arch}"
	print_step "Platform: ${platform}"
	echo ""

	# Get release tag
	local tag=$(get_latest_release_tag)
	if [[ -z "$tag" ]]; then
		print_error "Could not determine release version"
		exit 1
	fi
	# Version is the tag without the 'v' prefix (e.g., v0.1.0-alpha -> 0.1.0-alpha)
	local version="${tag#v}"
	print_step "Release: ${tag}"
	echo ""

	case $platform in
		flutter-pi)
			check_root
			install_flutter_pi_deps

			# Determine asset name based on architecture
			local asset_name="smart-panel-display-flutterpi-${version}-${arch}.tar.gz"
			download_and_extract "$tag" "$asset_name" "$INSTALL_DIR"
			configure_backend_url
			install_discovery_service "$tag"
			create_systemd_service_flutterpi

			if [[ "$KIOSK" == true ]]; then
				systemctl start "$SERVICE_NAME" || true
			fi
			;;
		elinux)
			check_root
			install_elinux_deps

			download_and_extract "$tag" "smart-panel-display-elinux-${version}-x64.tar.gz" "$INSTALL_DIR"
			chmod +x "${INSTALL_DIR}/fastybird_smart_panel" 2>/dev/null || true
			configure_backend_url
			create_systemd_service_elinux

			if [[ "$KIOSK" == true ]]; then
				systemctl start "$SERVICE_NAME" || true
			fi
			;;
		linux)
			check_root
			install_linux_desktop_deps

			download_and_extract "$tag" "smart-panel-display-linux-${version}-x64.tar.gz" "$INSTALL_DIR"
			chmod +x "${INSTALL_DIR}/fastybird_smart_panel"
			configure_backend_url
			create_systemd_service_linux

			if [[ "$KIOSK" == true ]]; then
				systemctl start "$SERVICE_NAME" || true
			fi
			;;
		android)
			install_android "$tag"
			;;
		*)
			print_error "Unsupported platform: ${platform}"
			exit 1
			;;
	esac

	print_completion "$platform"
}

main
