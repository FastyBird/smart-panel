#!/bin/sh
set -e

echo "Installing dependencies..."
pnpm install

# Override InfluxDB host in config for Docker networking
CONFIG_FILE="${FB_CONFIG_PATH:-/app/var/data}/config.yaml"
if [ -f "$CONFIG_FILE" ] && [ -n "$FB_INFLUXDB_HOST" ]; then
    echo "Patching InfluxDB host in config..."
    # Extract host from URL (e.g., http://influxdb:8086 -> influxdb)
    INFLUX_HOST=$(echo "$FB_INFLUXDB_HOST" | sed 's|https\?://||' | sed 's|:[0-9]*$||')
    sed -i "s|host: 127\.0\.0\.1|host: ${INFLUX_HOST}|" "$CONFIG_FILE"
fi

echo "Starting: $@"
exec "$@"
