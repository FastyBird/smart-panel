#!/bin/sh
# ==============================================================================
# FastyBird Smart Panel - Entrypoint
#
# Works in two modes:
#   1. Standalone Docker: uses environment variables directly
#   2. Home Assistant add-on: reads /data/options.json for config
# ==============================================================================

set -e

# ---------------------------------------------------------------------------
# Home Assistant add-on integration
# When running as an HA add-on, /data/options.json contains user config
# ---------------------------------------------------------------------------
OPTIONS_FILE="/data/options.json"

if [ -f "$OPTIONS_FILE" ]; then
    echo "[entrypoint] Home Assistant add-on detected, reading options..."

    # Read options (using node since jq isn't available in alpine-slim)
    read_option() {
        node -e "
            const o = require('$OPTIONS_FILE');
            const v = o['$1'];
            if (v !== undefined && v !== null && v !== '') process.stdout.write(String(v));
        " 2>/dev/null || true
    }

    # Log level
    val=$(read_option "log_level")
    if [ -n "$val" ]; then
        export FB_LOG_LEVEL="$val"
    fi

    # Token secret — auto-generate if empty
    val=$(read_option "token_secret")
    if [ -n "$val" ]; then
        export FB_TOKEN_SECRET="$val"
    elif [ -z "$FB_TOKEN_SECRET" ]; then
        export FB_TOKEN_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
        echo "[entrypoint] Generated random token secret"
    fi

    # HA Supervisor token (injected by HA into the container env)
    export SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN:-}"

    # InfluxDB — generate config.yaml on first start
    if [ ! -f /data/config/config.yaml ]; then
        echo "[entrypoint] First start, generating initial configuration..."

        mkdir -p /data/config

        influx_host=$(read_option "influxdb_host")
        influx_database=$(read_option "influxdb_database")
        influx_username=$(read_option "influxdb_username")
        influx_password=$(read_option "influxdb_password")

        if [ -n "$influx_host" ]; then
            influx_enabled="true"
        else
            influx_enabled="false"
        fi

        cat > /data/config/config.yaml <<EOF
plugins:
  influx-v1-plugin:
    enabled: ${influx_enabled}
    host: ${influx_host:-127.0.0.1}
    database: ${influx_database:-fastybird}
    username: ${influx_username:-}
    password: ${influx_password:-}
  memory-storage-plugin:
    enabled: true
  devices-home-assistant-plugin:
    enabled: true
modules:
  storage-module:
    enabled: true
    primary_storage: influx-v1-plugin
    fallback_storage: memory-storage-plugin
EOF

        echo "[entrypoint] Initial configuration generated"
    fi

    echo "[entrypoint] Starting Smart Panel (log_level=${FB_LOG_LEVEL:-info})..."
fi

# ---------------------------------------------------------------------------
# Start the application
# ---------------------------------------------------------------------------
exec node dist/main.js
