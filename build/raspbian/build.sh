#!/usr/bin/env bash
#
# Build a Raspberry Pi OS image with Smart Panel pre-installed.
#
# Prerequisites:
#   - Docker installed and running
#   - Pre-built Smart Panel backend + admin artifacts in build/raspbian/stage-smart-panel/01-install-app/files/
#
# Usage:
#   ./build.sh                    # Full build
#   ./build.sh --prepare-only     # Only prepare app files, skip image build
#   ./build.sh --skip-prepare     # Skip app preparation, use existing files
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PI_GEN_DIR="${SCRIPT_DIR}/pi-gen"
PI_GEN_REPO="https://github.com/RPi-Distro/pi-gen.git"
PI_GEN_BRANCH="arm64"
APP_FILES_DIR="${SCRIPT_DIR}/stage-smart-panel/01-install-app/files"
OUTPUT_DIR="${SCRIPT_DIR}/output"

PREPARE_ONLY=false
SKIP_PREPARE=false

for arg in "$@"; do
	case "$arg" in
		--prepare-only) PREPARE_ONLY=true ;;
		--skip-prepare) SKIP_PREPARE=true ;;
		--help)
			echo "Usage: $0 [--prepare-only] [--skip-prepare]"
			echo "  --prepare-only  Only build and package the app, don't build the image"
			echo "  --skip-prepare  Skip app build, use existing files in stage files dir"
			exit 0
			;;
	esac
done

if [ "${PREPARE_ONLY}" = true ] && [ "${SKIP_PREPARE}" = true ]; then
	echo "Error: --prepare-only and --skip-prepare cannot be used together." >&2
	exit 1
fi

# ──────────────────────────────────────────────────────────────
# Step 1: Build the Smart Panel application
# ──────────────────────────────────────────────────────────────
prepare_app_files() {
	echo "==> Building Smart Panel application..."

	# Build backend
	echo "  -> Building backend..."
	cd "${PROJECT_ROOT}"
	pnpm install --frozen-lockfile
	pnpm run generate:spec
	pnpm run generate:openapi
	pnpm --filter @fastybird/smart-panel-extension-sdk build
	pnpm --filter @fastybird/smart-panel-backend build

	# Build admin UI
	echo "  -> Building admin UI..."
	pnpm --filter @fastybird/smart-panel-admin build:no-check

	# Package files for the image
	echo "  -> Packaging files..."
	rm -rf "${APP_FILES_DIR}/app"
	mkdir -p "${APP_FILES_DIR}/app"

	# Backend dist + production dependencies
	cp -r "${PROJECT_ROOT}/apps/backend/dist" "${APP_FILES_DIR}/app/dist"
	# Copy extension-sdk (needed at runtime — tsc doesn't bundle, dist/ has require() calls)
	mkdir -p "${APP_FILES_DIR}/app/extension-sdk"
	cp -r "${PROJECT_ROOT}/packages/extension-sdk/dist" "${APP_FILES_DIR}/app/extension-sdk/dist"
	cp "${PROJECT_ROOT}/packages/extension-sdk/package.json" "${APP_FILES_DIR}/app/extension-sdk/package.json"
	# Rewrite workspace:* to file: reference so pnpm can resolve it outside the monorepo
	jq '.dependencies["@fastybird/smart-panel-extension-sdk"] = "file:./extension-sdk"' \
		"${PROJECT_ROOT}/apps/backend/package.json" > "${APP_FILES_DIR}/app/package.json"

	# Copy the lockfile for reproducible installs
	cp "${PROJECT_ROOT}/pnpm-lock.yaml" "${APP_FILES_DIR}/app/"

	# Admin static files
	mkdir -p "${APP_FILES_DIR}/app/static"
	cp -r "${PROJECT_ROOT}/apps/admin/dist/"* "${APP_FILES_DIR}/app/static/"

	# Seed data and var files
	cp -r "${PROJECT_ROOT}/var" "${APP_FILES_DIR}/app/var"

	echo "  -> App files prepared in ${APP_FILES_DIR}/app"
}

if [ "${SKIP_PREPARE}" = false ]; then
	prepare_app_files
fi

if [ "${PREPARE_ONLY}" = true ]; then
	echo "==> Preparation complete. Files are in ${APP_FILES_DIR}/app"
	exit 0
fi

# ──────────────────────────────────────────────────────────────
# Step 2: Clone/update pi-gen
# ──────────────────────────────────────────────────────────────
echo "==> Setting up pi-gen..."

if [ ! -d "${PI_GEN_DIR}" ]; then
	git clone --depth 1 --branch "${PI_GEN_BRANCH}" "${PI_GEN_REPO}" "${PI_GEN_DIR}"
else
	cd "${PI_GEN_DIR}"
	git fetch origin "${PI_GEN_BRANCH}" --depth 1
	git checkout "origin/${PI_GEN_BRANCH}"
fi

# ──────────────────────────────────────────────────────────────
# Step 3: Configure pi-gen
# ──────────────────────────────────────────────────────────────
echo "==> Configuring pi-gen..."

# Copy our config
cp "${SCRIPT_DIR}/config" "${PI_GEN_DIR}/config"

# Skip intermediate image from stage2 and desktop stages
touch "${PI_GEN_DIR}/stage2/SKIP_IMAGES"
touch "${PI_GEN_DIR}/stage3/SKIP" "${PI_GEN_DIR}/stage3/SKIP_IMAGES"
touch "${PI_GEN_DIR}/stage4/SKIP" "${PI_GEN_DIR}/stage4/SKIP_IMAGES"
touch "${PI_GEN_DIR}/stage5/SKIP" "${PI_GEN_DIR}/stage5/SKIP_IMAGES"

# Copy our custom stage into pi-gen (symlinks don't work inside Docker)
rm -rf "${PI_GEN_DIR}/stage-smart-panel"
cp -r "${SCRIPT_DIR}/stage-smart-panel" "${PI_GEN_DIR}/stage-smart-panel"

# Fix Bookworm GPG keys: the debootstrapped rootfs has stale 2023 archive keys
# that can't verify 2025 Bookworm repo signatures. We patch stage0 to copy the
# Docker host's updated keyring files into the rootfs before apt-get update.
STAGE0_APT_SCRIPT="${PI_GEN_DIR}/stage0/00-configure-apt/00-run.sh"
if ! grep -q "debian-archive-keyring" "${STAGE0_APT_SCRIPT}"; then
	cat > "${STAGE0_APT_SCRIPT}" << 'STAGE0_SCRIPT'
#!/bin/bash -e

true > "${ROOTFS_DIR}/etc/apt/sources.list"
install -m 644 files/debian.sources "${ROOTFS_DIR}/etc/apt/sources.list.d/"
install -m 644 files/raspi.sources "${ROOTFS_DIR}/etc/apt/sources.list.d/"
sed -i "s/RELEASE/${RELEASE}/g" "${ROOTFS_DIR}/etc/apt/sources.list.d/debian.sources"
sed -i "s/RELEASE/${RELEASE}/g" "${ROOTFS_DIR}/etc/apt/sources.list.d/raspi.sources"

if [ -n "$APT_PROXY" ]; then
	install -m 644 files/51cache "${ROOTFS_DIR}/etc/apt/apt.conf.d/51cache"
	sed "${ROOTFS_DIR}/etc/apt/apt.conf.d/51cache" -i -e "s|APT_PROXY|${APT_PROXY}|"
else
	rm -f "${ROOTFS_DIR}/etc/apt/apt.conf.d/51cache"
fi

if [ -n "$TEMP_REPO" ]; then
	install -m 644 /dev/null "${ROOTFS_DIR}/etc/apt/sources.list.d/00-temp.list"
	echo "$TEMP_REPO" | sed "s/RELEASE/$RELEASE/g" > "${ROOTFS_DIR}/etc/apt/sources.list.d/00-temp.list"
else
	rm -f "${ROOTFS_DIR}/etc/apt/sources.list.d/00-temp.list"
fi

install -m 644 files/raspberrypi-archive-keyring.pgp "${ROOTFS_DIR}/usr/share/keyrings/"

# Fix: copy updated debian-archive-keyring from Docker host into rootfs
# The debootstrapped rootfs has stale 2023 keys; the Docker container has 2025 keys
# Use -L to dereference symlinks (.gpg -> .pgp) and copy actual key data
cp -L /usr/share/keyrings/debian-archive-keyring.gpg "${ROOTFS_DIR}/usr/share/keyrings/debian-archive-keyring.pgp" 2>/dev/null || true
cp -L /usr/share/keyrings/debian-archive-bookworm-automatic.gpg "${ROOTFS_DIR}/usr/share/keyrings/debian-archive-bookworm-automatic.pgp" 2>/dev/null || true
cp -L /usr/share/keyrings/debian-archive-bookworm-security-automatic.gpg "${ROOTFS_DIR}/usr/share/keyrings/debian-archive-bookworm-security-automatic.pgp" 2>/dev/null || true
cp -L /usr/share/keyrings/debian-archive-bookworm-stable.gpg "${ROOTFS_DIR}/usr/share/keyrings/debian-archive-bookworm-stable.pgp" 2>/dev/null || true

on_chroot <<- \EOF
	ARCH="$(dpkg --print-architecture)"
	if [ "$ARCH" = "armhf" ]; then
		dpkg --add-architecture arm64
	elif [ "$ARCH" = "arm64" ]; then
		dpkg --add-architecture armhf
	fi
	apt-get update
	apt-get dist-upgrade -y
EOF
STAGE0_SCRIPT
	chmod +x "${STAGE0_APT_SCRIPT}"
fi

# Fix stale arm64 branch: remove packages and services that no longer exist
# in current Bookworm repos
STAGE2_PACKAGES="${PI_GEN_DIR}/stage2/01-sys-tweaks/00-packages"
sed 's/rpi-swap rpi-loop-utils//' "${STAGE2_PACKAGES}" \
	| sed 's/rpi-usb-gadget //' \
	> "${STAGE2_PACKAGES}.tmp" \
	&& mv "${STAGE2_PACKAGES}.tmp" "${STAGE2_PACKAGES}"

STAGE2_TWEAKS="${PI_GEN_DIR}/stage2/01-sys-tweaks/01-run.sh"
sed 's/systemctl enable rpi-resize/systemctl enable rpi-resizerootfs 2>\/dev\/null || true/' \
	"${STAGE2_TWEAKS}" > "${STAGE2_TWEAKS}.tmp" \
	&& mv "${STAGE2_TWEAKS}.tmp" "${STAGE2_TWEAKS}" \
	&& chmod +x "${STAGE2_TWEAKS}"

# Skip cloud-init substage (rpi-cloud-init-mods package not available)
touch "${PI_GEN_DIR}/stage2/04-cloud-init/SKIP"

# Ensure the Docker container has the updated debian-archive-keyring package
sed 's/binfmt-support ca-certificates/binfmt-support ca-certificates debian-archive-keyring/' \
	"${PI_GEN_DIR}/Dockerfile" > "${PI_GEN_DIR}/Dockerfile.tmp" \
	&& mv "${PI_GEN_DIR}/Dockerfile.tmp" "${PI_GEN_DIR}/Dockerfile"

# ──────────────────────────────────────────────────────────────
# Step 4: Build the image
# ──────────────────────────────────────────────────────────────
echo "==> Building Raspberry Pi OS image..."

cd "${PI_GEN_DIR}"
./build-docker.sh

# ──────────────────────────────────────────────────────────────
# Step 5: Collect, rename, and compress output
# ──────────────────────────────────────────────────────────────
echo "==> Collecting output..."

mkdir -p "${OUTPUT_DIR}"

VERSION=$(git -C "${PROJECT_ROOT}" describe --tags --always 2>/dev/null || echo "dev")
VERSION="${VERSION//\//-}"

# pi-gen produces either .img or .zip in deploy/
IMAGE_FILE=$(ls "${PI_GEN_DIR}/deploy/"*.img 2>/dev/null | head -1)
ZIP_FILE=$(ls "${PI_GEN_DIR}/deploy/"*.zip 2>/dev/null | head -1)

if [ -n "${IMAGE_FILE}" ]; then
	NEW_NAME="smart-panel-${VERSION}-arm64.img"
	cp "${IMAGE_FILE}" "${OUTPUT_DIR}/${NEW_NAME}"
	echo "  -> Compressing image..."
	xz -9 -T0 "${OUTPUT_DIR}/${NEW_NAME}"
	( cd "${OUTPUT_DIR}" && sha256sum "${NEW_NAME}.xz" > "${NEW_NAME}.xz.sha256" )
elif [ -n "${ZIP_FILE}" ]; then
	NEW_NAME="smart-panel-${VERSION}-arm64.zip"
	cp "${ZIP_FILE}" "${OUTPUT_DIR}/${NEW_NAME}"
	( cd "${OUTPUT_DIR}" && sha256sum "${NEW_NAME}" > "${NEW_NAME}.sha256" )
else
	echo "ERROR: No .img or .zip file found in ${PI_GEN_DIR}/deploy/" >&2
	exit 1
fi

# Copy any additional deploy artifacts
cp "${PI_GEN_DIR}/deploy/"*.info "${OUTPUT_DIR}/" 2>/dev/null || true

echo "==> Build complete! Image available in ${OUTPUT_DIR}/"
ls -lh "${OUTPUT_DIR}/"
