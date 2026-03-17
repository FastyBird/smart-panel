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

# Link our custom stage
if [ -L "${PI_GEN_DIR}/stage-smart-panel" ]; then
	rm "${PI_GEN_DIR}/stage-smart-panel"
fi
ln -sf "${SCRIPT_DIR}/stage-smart-panel" "${PI_GEN_DIR}/stage-smart-panel"

# ──────────────────────────────────────────────────────────────
# Step 4: Build the image
# ──────────────────────────────────────────────────────────────
echo "==> Building Raspberry Pi OS image..."

cd "${PI_GEN_DIR}"
./build-docker.sh

# ──────────────────────────────────────────────────────────────
# Step 5: Copy output
# ──────────────────────────────────────────────────────────────
echo "==> Collecting output..."

mkdir -p "${OUTPUT_DIR}"
cp "${PI_GEN_DIR}/deploy/"*.img.xz "${OUTPUT_DIR}/" 2>/dev/null || true
cp "${PI_GEN_DIR}/deploy/"*.zip "${OUTPUT_DIR}/" 2>/dev/null || true
cp "${PI_GEN_DIR}/deploy/"*.info "${OUTPUT_DIR}/" 2>/dev/null || true

echo "==> Build complete! Image(s) available in ${OUTPUT_DIR}/"
ls -lh "${OUTPUT_DIR}/"
