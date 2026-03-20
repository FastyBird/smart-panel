#!/usr/bin/env bash
#
# Smart Panel first-boot initialization
#
# This script runs once on the first boot of a fresh image.
# It generates secrets, runs database migrations, and prepares
# the system for use.
#
# A log is written to /boot/firmware/smart-panel-firstboot.log
# so users can read it by mounting the SD card on any computer.
#
set -euo pipefail

LOG_TAG="smart-panel-firstboot"
ENV_FILE="/etc/smart-panel/environment"
DATA_DIR="/var/lib/smart-panel"
APP_DIR="/usr/lib/smart-panel"
MARKER="${DATA_DIR}/.first-boot"
BOOT_LOG="/boot/firmware/smart-panel-firstboot.log"

# Initialize boot log
echo "Smart Panel First Boot — $(date -u '+%Y-%m-%d %H:%M:%S UTC')" > "${BOOT_LOG}"
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
if [ -x "${APP_DIR}/apply-boot-config.sh" ]; then
	if "${APP_DIR}/apply-boot-config.sh" >> "${BOOT_LOG}" 2>&1; then
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
# 1. Generate JWT secret
# ──────────────────────────────────────────────────────────────
if ! grep -q "^FB_TOKEN_SECRET=" "${ENV_FILE}" 2>/dev/null; then
	TOKEN_SECRET=$(openssl rand -base64 32)
	echo "FB_TOKEN_SECRET=${TOKEN_SECRET}" >> "${ENV_FILE}"
	log_ok "JWT secret generated"
else
	log_info "JWT secret already exists"
fi

# ──────────────────────────────────────────────────────────────
# 2. Build native modules (sqlite3, bcrypt) — must run before migrations
# ──────────────────────────────────────────────────────────────
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

# ──────────────────────────────────────────────────────────────
# 3. Create InfluxDB database and retention policies
# ──────────────────────────────────────────────────────────────
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
	touch "${DATA_DIR}/.influxdb-pending"
fi

# ──────────────────────────────────────────────────────────────
# 4. Ensure data directories exist with correct permissions
# ──────────────────────────────────────────────────────────────
mkdir -p "${DATA_DIR}/data" "${DATA_DIR}/config"
chown -R smart-panel:smart-panel "${DATA_DIR}"
log_ok "Data directories verified"

# ──────────────────────────────────────────────────────────────
# 5. Run database migrations
# ──────────────────────────────────────────────────────────────
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

# ──────────────────────────────────────────────────────────────
# 6. Copy seed data if not already present
# ──────────────────────────────────────────────────────────────
if [ -d "${APP_DIR}/var/db/seed" ] && [ ! -d "${DATA_DIR}/data/seed" ]; then
	cp -r "${APP_DIR}/var/db/seed" "${DATA_DIR}/data/seed"
	chown -R smart-panel:smart-panel "${DATA_DIR}/data/seed"
	log_ok "Seed data copied"
fi

# ──────────────────────────────────────────────────────────────
# 7. Remove first-boot marker and finalize
# ──────────────────────────────────────────────────────────────
rm -f "${MARKER}"

IP_ADDR=$(hostname -I | awk '{print $1}')
log_ok "Smart Panel is ready at http://${IP_ADDR}:3000"

echo "========================================" >> "${BOOT_LOG}"
echo "RESULT: SUCCESS" >> "${BOOT_LOG}"
echo "Access: http://${IP_ADDR}:3000" >> "${BOOT_LOG}"
