#!/usr/bin/env bash
#
# Smart Panel first-boot initialization
#
# This script runs once on the first boot of a fresh image.
# It generates secrets, runs database migrations, and prepares
# the system for use.
#
set -euo pipefail

LOG_TAG="smart-panel-firstboot"
ENV_FILE="/etc/smart-panel/environment"
DATA_DIR="/var/lib/smart-panel"
APP_DIR="/usr/lib/smart-panel"
MARKER="${DATA_DIR}/.first-boot"

log() {
	echo "$1"
	logger -t "${LOG_TAG}" "$1"
}

# ──────────────────────────────────────────────────────────────
# 1. Generate JWT secret
# ──────────────────────────────────────────────────────────────
if ! grep -q "^FB_TOKEN_SECRET=" "${ENV_FILE}" 2>/dev/null; then
	TOKEN_SECRET=$(openssl rand -base64 32)
	echo "FB_TOKEN_SECRET=${TOKEN_SECRET}" >> "${ENV_FILE}"
	log "Generated JWT token secret"
fi

# ──────────────────────────────────────────────────────────────
# 2. Create InfluxDB database and retention policies
# ──────────────────────────────────────────────────────────────
log "Configuring InfluxDB..."

# Wait for InfluxDB to be ready (up to 30 seconds)
INFLUXDB_READY=false
for i in $(seq 1 30); do
	if influx -execute "SHOW DATABASES" >/dev/null 2>&1; then
		INFLUXDB_READY=true
		break
	fi
	sleep 1
done

if [ "${INFLUXDB_READY}" = true ]; then
	# Create the default database and retention policies
	influx -execute "CREATE DATABASE fastybird"
	influx -execute "CREATE RETENTION POLICY raw_24h ON fastybird DURATION 24h REPLICATION 1 DEFAULT"
	influx -execute "CREATE RETENTION POLICY min_14d ON fastybird DURATION 14d REPLICATION 1"
	log "InfluxDB database 'fastybird' configured with retention policies"
else
	log "WARNING: InfluxDB not ready after 30s, skipping database setup — metrics features will be unavailable"
	touch "${DATA_DIR}/.influxdb-pending"
fi

# ──────────────────────────────────────────────────────────────
# 3. Ensure data directories exist with correct permissions
# ──────────────────────────────────────────────────────────────
mkdir -p "${DATA_DIR}/data" "${DATA_DIR}/config"
chown -R smart-panel:smart-panel "${DATA_DIR}"
log "Data directories verified"

# ──────────────────────────────────────────────────────────────
# 4. Run database migrations
# ──────────────────────────────────────────────────────────────
log "Running database migrations..."

# Source environment for the migration
set -a
source "${ENV_FILE}"
set +a

cd "${APP_DIR}"
su -s /bin/bash smart-panel -c "
	cd ${APP_DIR}
	set -a
	source ${ENV_FILE}
	set +a
	node node_modules/typeorm/cli.js migration:run -d dist/dataSource.js
" || {
	log "WARNING: Database migration failed, will retry on next boot"
	exit 1
}

log "Database migrations completed"

# ──────────────────────────────────────────────────────────────
# 5. Copy seed data if not already present
# ──────────────────────────────────────────────────────────────
if [ -d "${APP_DIR}/var/db/seed" ] && [ ! -d "${DATA_DIR}/data/seed" ]; then
	cp -r "${APP_DIR}/var/db/seed" "${DATA_DIR}/data/seed"
	chown -R smart-panel:smart-panel "${DATA_DIR}/data/seed"
	log "Seed data copied"
fi

# ──────────────────────────────────────────────────────────────
# 6. Remove first-boot marker
# ──────────────────────────────────────────────────────────────
rm -f "${MARKER}"
log "First boot setup complete! Smart Panel is ready."
log "Access the panel at http://$(hostname -I | awk '{print $1}'):3000"
