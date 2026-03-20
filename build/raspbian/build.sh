#!/usr/bin/env bash
#
# Build a Raspberry Pi OS image with Smart Panel pre-installed.
#
# Prerequisites:
#   - Docker installed and running
#   - Pre-built Smart Panel backend + admin artifacts in build/raspbian/stage-smart-panel/01-install-app/files/
#
# Usage:
#   ./build.sh                    # Full build (server variant)
#   ./build.sh --variant server   # Headless backend + admin UI
#   ./build.sh --variant display  # Flutter-pi display only
#   ./build.sh --variant aio      # All-in-one (backend + display)
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
DISPLAY_FILES_DIR="${SCRIPT_DIR}/modules/install-display/files"
OUTPUT_DIR="${SCRIPT_DIR}/output"

PREPARE_ONLY=false
SKIP_PREPARE=false
VARIANT="server"

for arg in "$@"; do
	case "$arg" in
		--prepare-only) PREPARE_ONLY=true ;;
		--skip-prepare) SKIP_PREPARE=true ;;
		--variant=*) VARIANT="${arg#--variant=}" ;;
		--help)
			echo "Usage: $0 [--variant=server|display|aio] [--prepare-only] [--skip-prepare]"
			echo "  --variant=NAME  Image variant: server (default), display, aio"
			echo "  --prepare-only  Only build and package the app, don't build the image"
			echo "  --skip-prepare  Skip app build, use existing files in stage files dir"
			exit 0
			;;
	esac
done

# Handle --variant as separate argument (--variant display)
ARGS=("$@")
for i in "${!ARGS[@]}"; do
	if [ "${ARGS[$i]}" = "--variant" ] && [ $((i + 1)) -lt ${#ARGS[@]} ]; then
		VARIANT="${ARGS[$((i + 1))]}"
	fi
done

# Validate variant
case "${VARIANT}" in
	server|display|aio) ;;
	*)
		echo "Error: Unknown variant '${VARIANT}'. Use server, display, or aio." >&2
		exit 1
		;;
esac

echo "==> Building variant: ${VARIANT}"

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

prepare_display_files() {
	echo "==> Preparing Smart Panel display files..."

	mkdir -p "${DISPLAY_FILES_DIR}/display-app"

	# Build Flutter app bundle for ARM64 Linux
	echo "  -> Building Flutter panel app..."
	cd "${PROJECT_ROOT}/apps/panel"
	flutter build linux --release --target-platform linux-arm64

	# Copy the built bundle
	cp -r "${PROJECT_ROOT}/apps/panel/build/linux/arm64/release/bundle/"* \
		"${DISPLAY_FILES_DIR}/display-app/"

	echo "  -> Display files prepared in ${DISPLAY_FILES_DIR}/display-app"
}

# Determine what to prepare based on variant
if [ "${SKIP_PREPARE}" = false ]; then
	case "${VARIANT}" in
		server)
			prepare_app_files
			;;
		display)
			prepare_display_files
			;;
		aio)
			prepare_app_files
			prepare_display_files
			;;
	esac
fi

if [ "${PREPARE_ONLY}" = true ]; then
	echo "==> Preparation complete."
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

# Start with base config
cp "${SCRIPT_DIR}/config" "${PI_GEN_DIR}/config"

# Skip intermediate image from stage2 and desktop stages
touch "${PI_GEN_DIR}/stage2/SKIP_IMAGES"
touch "${PI_GEN_DIR}/stage3/SKIP" "${PI_GEN_DIR}/stage3/SKIP_IMAGES"
touch "${PI_GEN_DIR}/stage4/SKIP" "${PI_GEN_DIR}/stage4/SKIP_IMAGES"
touch "${PI_GEN_DIR}/stage5/SKIP" "${PI_GEN_DIR}/stage5/SKIP_IMAGES"

# ──────────────────────────────────────────────────────────────
# Step 3a: Assemble stage based on variant
# ──────────────────────────────────────────────────────────────
if [ "${VARIANT}" = "server" ]; then
	# Server variant: use the existing stage-smart-panel as-is
	rm -rf "${PI_GEN_DIR}/stage-smart-panel"
	cp -r "${SCRIPT_DIR}/stage-smart-panel" "${PI_GEN_DIR}/stage-smart-panel"
else
	# display/aio: assemble from modules
	echo "  -> Assembling stage from modules for ${VARIANT} variant..."

	# Load variant config for IMG_NAME and TARGET_HOSTNAME
	VARIANT_CONF="${SCRIPT_DIR}/variants/${VARIANT}.conf"
	if [ ! -f "${VARIANT_CONF}" ]; then
		echo "Error: Variant config not found: ${VARIANT_CONF}" >&2
		exit 1
	fi

	# Override pi-gen config values from variant
	# shellcheck disable=SC1090
	source "${VARIANT_CONF}"

	# Update pi-gen config with variant-specific values
	sed -i.bak "s/^IMG_NAME=.*/IMG_NAME=\"${IMG_NAME}\"/" "${PI_GEN_DIR}/config"
	sed -i.bak "s/^TARGET_HOSTNAME=.*/TARGET_HOSTNAME=\"${TARGET_HOSTNAME}\"/" "${PI_GEN_DIR}/config"
	rm -f "${PI_GEN_DIR}/config.bak"

	# Build the assembled stage
	ASSEMBLED_STAGE="${PI_GEN_DIR}/stage-smart-panel"
	rm -rf "${ASSEMBLED_STAGE}"
	mkdir -p "${ASSEMBLED_STAGE}"

	# Create pi-gen marker files required for stage processing
	cat > "${ASSEMBLED_STAGE}/prerun.sh" << 'PRERUN'
#!/bin/bash -e
if [ ! -d "${ROOTFS_DIR}" ]; then
	copy_previous
fi
PRERUN
	chmod +x "${ASSEMBLED_STAGE}/prerun.sh"
	touch "${ASSEMBLED_STAGE}/EXPORT_IMAGE"

	# Sub-stage counter
	SUBSTAGE_IDX=0

	for MODULE in ${MODULES}; do
		SUBSTAGE_DIR="${ASSEMBLED_STAGE}/$(printf '%02d' ${SUBSTAGE_IDX})-${MODULE}"

		case "${MODULE}" in
			backend-deps)
				# Map to existing stage-smart-panel/00-install-deps
				cp -r "${SCRIPT_DIR}/stage-smart-panel/00-install-deps" "${SUBSTAGE_DIR}"
				;;
			display-deps)
				cp -r "${SCRIPT_DIR}/modules/display-deps" "${SUBSTAGE_DIR}"
				;;
			install-backend)
				# Map to existing stage-smart-panel/01-install-app
				cp -r "${SCRIPT_DIR}/stage-smart-panel/01-install-app" "${SUBSTAGE_DIR}"
				;;
			install-display)
				cp -r "${SCRIPT_DIR}/modules/install-display" "${SUBSTAGE_DIR}"
				;;
			configure)
				cp -r "${SCRIPT_DIR}/modules/configure" "${SUBSTAGE_DIR}"
				;;
			*)
				echo "Error: Unknown module '${MODULE}'" >&2
				exit 1
				;;
		esac

		SUBSTAGE_IDX=$((SUBSTAGE_IDX + 1))
	done

	# Write variant marker into the configure module's files/ directory.
	# This file is copied into rootfs by 00-run.sh and read by 01-run-chroot.sh.
	# Using a file avoids env-var propagation issues across the Docker boundary.
	CONFIGURE_DIR=$(find "${ASSEMBLED_STAGE}" -maxdepth 1 -name "*-configure" -type d | head -1)
	if [ -n "${CONFIGURE_DIR}" ]; then
		echo "${VARIANT}" > "${CONFIGURE_DIR}/files/variant"
	fi

	echo "  -> Assembled ${SUBSTAGE_IDX} sub-stages for ${VARIANT}"
fi

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
echo "==> Building Raspberry Pi OS image (${VARIANT})..."

cd "${PI_GEN_DIR}"
./build-docker.sh

# ──────────────────────────────────────────────────────────────
# Step 5: Collect, rename, and compress output
# ──────────────────────────────────────────────────────────────
echo "==> Collecting output..."

mkdir -p "${OUTPUT_DIR}"

VERSION=$(git -C "${PROJECT_ROOT}" describe --tags --always 2>/dev/null || echo "dev")
VERSION="${VERSION//\//-}"

# Include variant in filename (server omits it for backwards compatibility)
if [ "${VARIANT}" = "server" ]; then
	NAME_PREFIX="smart-panel"
else
	NAME_PREFIX="smart-panel-${VARIANT}"
fi

echo "  -> Deploy directory contents:"
ls -lh "${PI_GEN_DIR}/deploy/" 2>/dev/null || echo "  -> Deploy directory not found!"

# pi-gen produces either .img or .zip in deploy/
IMAGE_FILE=$(find "${PI_GEN_DIR}/deploy/" -maxdepth 1 -name "*.img" -type f 2>/dev/null | head -1)
ZIP_FILE=$(find "${PI_GEN_DIR}/deploy/" -maxdepth 1 -name "*.zip" -type f 2>/dev/null | head -1)

if [ -n "${IMAGE_FILE}" ]; then
	NEW_NAME="${NAME_PREFIX}-${VERSION}-arm64.img"
	echo "  -> Copying ${IMAGE_FILE} to ${OUTPUT_DIR}/${NEW_NAME}"
	cp "${IMAGE_FILE}" "${OUTPUT_DIR}/${NEW_NAME}"
	echo "  -> Compressing image..."
	xz -9 -T0 "${OUTPUT_DIR}/${NEW_NAME}"
	sha256sum "${OUTPUT_DIR}/${NEW_NAME}.xz" > "${OUTPUT_DIR}/${NEW_NAME}.xz.sha256"
elif [ -n "${ZIP_FILE}" ]; then
	NEW_NAME="${NAME_PREFIX}-${VERSION}-arm64.zip"
	echo "  -> Copying ${ZIP_FILE} to ${OUTPUT_DIR}/${NEW_NAME}"
	cp "${ZIP_FILE}" "${OUTPUT_DIR}/${NEW_NAME}"
	sha256sum "${OUTPUT_DIR}/${NEW_NAME}" > "${OUTPUT_DIR}/${NEW_NAME}.sha256"
else
	echo "ERROR: No .img or .zip file found in ${PI_GEN_DIR}/deploy/" >&2
	exit 1
fi

# Copy any additional deploy artifacts
cp "${PI_GEN_DIR}/deploy/"*.info "${OUTPUT_DIR}/" 2>/dev/null || true

echo "==> Build complete! Image available in ${OUTPUT_DIR}/"
ls -lh "${OUTPUT_DIR}/"
