#!/usr/bin/env bash
#
# Smart Panel first-boot initialization (variant-aware)
#
# This script runs once on the first boot of a fresh image.
# It detects the variant (server/display/aio) and conditionally:
#   - Applies boot config and expands root partition (all variants)
#   - Generates JWT, builds native modules, configures InfluxDB,
#     runs migrations (backend variants: server, aio)
#   - Builds flutter-pi from source (display variants: display, aio)
#
# A log is written to /boot/firmware/smart-panel-firstboot.log
# so users can read it by mounting the SD card on any computer.
#
set -euo pipefail

LOG_TAG="smart-panel-firstboot"
BOOT_LOG="/boot/firmware/smart-panel-firstboot.log"

# ──────────────────────────────────────────────────────────────
# Determine variant
# ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VARIANT="server"

if [ -f "${SCRIPT_DIR}/.variant" ]; then
	VARIANT=$(cat "${SCRIPT_DIR}/.variant")
fi

HAS_BACKEND=false
HAS_DISPLAY=false

case "${VARIANT}" in
	server)  HAS_BACKEND=true ;;
	display) HAS_DISPLAY=true ;;
	aio)     HAS_BACKEND=true; HAS_DISPLAY=true ;;
esac

# Set paths based on variant
# Use /current symlink for image installs (points to versioned dir)
APP_DIR="/opt/smart-panel/current"
DATA_DIR="/var/lib/smart-panel"
DISPLAY_DIR="/opt/smart-panel-display"
ENV_FILE="/etc/smart-panel/environment"

if [ "${HAS_BACKEND}" = true ]; then
	MARKER="${DATA_DIR}/.first-boot"
else
	MARKER="${DISPLAY_DIR}/.first-boot"
fi

# Initialize boot log
echo "Smart Panel First Boot (${VARIANT}) — $(date -u '+%Y-%m-%d %H:%M:%S UTC')" > "${BOOT_LOG}"
echo "========================================" >> "${BOOT_LOG}"

log_ok() {
	echo "[OK]    $1" >> "${BOOT_LOG}"
	echo "$1"
	logger -t "${LOG_TAG}" "$1"
}

log_warn() {
	echo "[WARN]  $1" >> "${BOOT_LOG}"
	echo "WARNING: $1"
	logger -t "${LOG_TAG}" "WARNING: $1"
}

log_error() {
	echo "[ERROR] $1" >> "${BOOT_LOG}"
	echo "ERROR: $1" >&2
	logger -t "${LOG_TAG}" "ERROR: $1"
}

log_info() {
	echo "[INFO]  $1" >> "${BOOT_LOG}"
	echo "$1"
	logger -t "${LOG_TAG}" "$1"
}

# ──────────────────────────────────────────────────────────────
# 0a. Apply boot partition config (WiFi, hostname, timezone, etc.)
# ──────────────────────────────────────────────────────────────
BOOT_CONFIG_SCRIPT="${SCRIPT_DIR}/apply-boot-config.sh"
if [ -x "${BOOT_CONFIG_SCRIPT}" ]; then
	if "${BOOT_CONFIG_SCRIPT}" >> "${BOOT_LOG}" 2>&1; then
		log_ok "Boot configuration applied"
	else
		log_warn "Boot configuration failed or partially applied"
	fi
else
	log_info "No boot configuration script found"
fi

# ──────────────────────────────────────────────────────────────
# 0b. Expand root partition to fill SD card
# ──────────────────────────────────────────────────────────────
if command -v raspi-config >/dev/null 2>&1; then
	raspi-config --expand-rootfs >/dev/null 2>&1 || true
	ROOT_DEV=$(findmnt -n -o SOURCE /)
	if resize2fs "${ROOT_DEV}" 2>/dev/null; then
		ROOT_SIZE=$(df -h / | awk 'NR==2{print $2}')
		log_ok "Root partition expanded to ${ROOT_SIZE}"
	else
		log_warn "Root partition expansion failed — will expand on next reboot"
	fi
else
	log_warn "raspi-config not found, cannot expand root partition"
fi

# ──────────────────────────────────────────────────────────────
# Backend-only steps (server + aio)
# ──────────────────────────────────────────────────────────────
if [ "${HAS_BACKEND}" = true ]; then

	# 1. Generate JWT secret
	if ! grep -q "^FB_TOKEN_SECRET=" "${ENV_FILE}" 2>/dev/null; then
		TOKEN_SECRET=$(openssl rand -base64 32)
		echo "FB_TOKEN_SECRET=${TOKEN_SECRET}" >> "${ENV_FILE}"
		log_ok "JWT secret generated"
	else
		log_info "JWT secret already exists"
	fi

	# 2. Build native modules (sqlite3, bcrypt)
	log_info "Building native modules (this may take a minute)..."
	if [ -x "${APP_DIR}/rebuild-native.sh" ]; then
		if "${APP_DIR}/rebuild-native.sh" >> "${BOOT_LOG}" 2>&1; then
			log_ok "Native modules compiled"
		else
			log_error "Native module compilation failed"
			echo "========================================" >> "${BOOT_LOG}"
			echo "RESULT: FAILED" >> "${BOOT_LOG}"
			exit 1
		fi
	fi

	# 3. Create InfluxDB database and retention policies
	log_info "Configuring InfluxDB..."

	INFLUXDB_READY=false
	for i in $(seq 1 30); do
		if influx -execute "SHOW DATABASES" >/dev/null 2>&1; then
			INFLUXDB_READY=true
			break
		fi
		sleep 1
	done

	if [ "${INFLUXDB_READY}" = true ]; then
		influx -execute "CREATE DATABASE fastybird"
		influx -execute "CREATE RETENTION POLICY raw_24h ON fastybird DURATION 24h REPLICATION 1 DEFAULT" 2>/dev/null \
			|| influx -execute "ALTER RETENTION POLICY raw_24h ON fastybird DURATION 24h REPLICATION 1 DEFAULT"
		influx -execute "CREATE RETENTION POLICY min_14d ON fastybird DURATION 14d REPLICATION 1" 2>/dev/null \
			|| influx -execute "ALTER RETENTION POLICY min_14d ON fastybird DURATION 14d REPLICATION 1"
		log_ok "InfluxDB configured (database: fastybird, policies: raw_24h, min_14d)"
	else
		log_error "InfluxDB not ready after 30s — metrics features will be unavailable"
	fi

	# 4. Ensure data directories exist with correct permissions
	mkdir -p "${DATA_DIR}/data" "${DATA_DIR}/config"
	chown -R smart-panel:smart-panel "${DATA_DIR}"
	log_ok "Data directories verified"

	# 5. Run database migrations
	log_info "Running database migrations..."

	cd "${APP_DIR}"
	if su -s /bin/bash smart-panel -c "
		cd ${APP_DIR}
		set -a
		source ${ENV_FILE}
		set +a
		node node_modules/typeorm/cli.js migration:run -d dist/dataSource.js
	" >> "${BOOT_LOG}" 2>&1; then
		log_ok "Database migrations completed"
	else
		log_error "Database migration failed — will retry on next boot"
		echo "========================================" >> "${BOOT_LOG}"
		echo "RESULT: FAILED" >> "${BOOT_LOG}"
		exit 1
	fi

	# 6. Copy seed data if not already present
	if [ -d "${APP_DIR}/var/db/seed" ] && [ ! -d "${DATA_DIR}/data/seed" ]; then
		cp -r "${APP_DIR}/var/db/seed" "${DATA_DIR}/data/seed"
		chown -R smart-panel:smart-panel "${DATA_DIR}/data/seed"
		log_ok "Seed data copied"
	fi
fi

# ──────────────────────────────────────────────────────────────
# Remove first-boot marker (conditionally)
# ──────────────────────────────────────────────────────────────
# AIO: remove marker NOW so the backend can start even if flutter-pi fails.
# Display-only: keep marker until flutter-pi succeeds — it's the only
# critical component, and we want systemd to retry on next boot if it fails.
if [ "${VARIANT}" != "display" ]; then
	rm -f "${MARKER}"
fi

# ──────────────────────────────────────────────────────────────
# Display steps (display + aio) — non-fatal for AIO
# ──────────────────────────────────────────────────────────────
DISPLAY_OK=true
if [ "${HAS_DISPLAY}" = true ]; then

	# Build flutter-pi from source
	log_info "Building flutter-pi from source (this may take a few minutes)..."
	if [ -x "${DISPLAY_DIR}/build-flutter-pi.sh" ]; then
		if "${DISPLAY_DIR}/build-flutter-pi.sh" >> "${BOOT_LOG}" 2>&1; then
			log_ok "flutter-pi compiled and installed"
		else
			log_error "flutter-pi compilation failed — display will not work"
			DISPLAY_OK=false
			if [ "${VARIANT}" = "display" ]; then
				# Display-only variant: this is fatal
				echo "========================================" >> "${BOOT_LOG}"
				echo "RESULT: FAILED" >> "${BOOT_LOG}"
				exit 1
			fi
			# AIO: continue — backend still works without display
			log_warn "Backend will start without display. Run /opt/smart-panel-display/build-flutter-pi.sh manually to retry."
		fi
	else
		log_error "flutter-pi build script not found at ${DISPLAY_DIR}/build-flutter-pi.sh"
		DISPLAY_OK=false
		if [ "${VARIANT}" = "display" ]; then
			# Display-only variant: missing build script is fatal — retry on next boot
			echo "========================================" >> "${BOOT_LOG}"
			echo "RESULT: FAILED" >> "${BOOT_LOG}"
			exit 1
		fi
	fi
fi

# ──────────────────────────────────────────────────────────────
# Finalize (all variants)
# ──────────────────────────────────────────────────────────────

# Display-only: remove marker only if display succeeded.
# If DISPLAY_OK is false, the marker stays so systemd retries on next boot.
if [ "${VARIANT}" = "display" ] && [ "${DISPLAY_OK}" = true ]; then
	rm -f "${MARKER}"
fi

IP_ADDR=$(hostname -I | awk '{print $1}')

if [ "${DISPLAY_OK}" = false ]; then
	echo "========================================" >> "${BOOT_LOG}"
	echo "RESULT: PARTIAL (display failed)" >> "${BOOT_LOG}"
else
	echo "========================================" >> "${BOOT_LOG}"
	echo "RESULT: SUCCESS" >> "${BOOT_LOG}"
fi

if [ "${HAS_BACKEND}" = true ]; then
	log_ok "Smart Panel is ready at http://${IP_ADDR}:3000"
	echo "Access: http://${IP_ADDR}:3000" >> "${BOOT_LOG}"
fi

if [ "${HAS_DISPLAY}" = true ] && [ "${DISPLAY_OK}" = true ]; then
	log_ok "Smart Panel display is ready"
elif [ "${HAS_DISPLAY}" = true ]; then
	log_warn "Smart Panel display failed — run /opt/smart-panel-display/build-flutter-pi.sh manually"
fi
