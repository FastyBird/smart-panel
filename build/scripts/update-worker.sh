#!/bin/bash
set -e

VERSION="${1:-${UPDATE_VERSION:-latest}}"
STATUS_FILE="${STATUS_FILE:-/var/lib/smart-panel/update-status.json}"

update_status() {
	local status="$1"
	local phase="$2"
	local error="${3:-}"
	local completed_at=""

	if [ "$status" = "complete" ] || [ "$status" = "failed" ]; then
		completed_at="\"completedAt\": \"$(date -Iseconds)\","
	fi

	local tmp_file="${STATUS_FILE}.tmp"

	cat > "$tmp_file" << EOF
{
	"status": "$status",
	"phase": "$phase",
	"targetVersion": "$VERSION",
	"startedAt": "$(date -Iseconds)",
	${completed_at}
	"error": "$error"
}
EOF

	mv "$tmp_file" "$STATUS_FILE"
}

cleanup() {
	local exit_code=$?

	if [ $exit_code -ne 0 ]; then
		update_status "failed" "failed" "Update process exited with code $exit_code"
	fi
}

trap cleanup EXIT

# Downloading / preparing
update_status "downloading" "downloading"

# Stop the service
update_status "stopping" "stopping"
systemctl stop smart-panel 2>/dev/null || true

# Install the update
update_status "installing" "installing"

if [ "$VERSION" = "latest" ]; then
	npm update -g @fastybird/smart-panel 2>&1 || {
		update_status "failed" "failed" "npm update failed"
		exit 1
	}
else
	npm install -g "@fastybird/smart-panel@$VERSION" 2>&1 || {
		update_status "failed" "failed" "npm install failed for version $VERSION"
		exit 1
	}
fi

# Run database migrations
update_status "migrating" "migrating"

DATA_DIR="${FB_DATA_DIR:-/var/lib/smart-panel}"
DB_PATH="${FB_DB_PATH:-${DATA_DIR}/data}"

if [ -f "$(npm root -g)/@fastybird/smart-panel/dataSource.js" ]; then
	node "$(npm root -g)/@fastybird/smart-panel/node_modules/typeorm/cli.js" \
		migration:run \
		-d "$(npm root -g)/@fastybird/smart-panel/dataSource.js" 2>&1 || {
		update_status "failed" "failed" "Database migration failed"
		exit 1
	}
fi

# Start the service
update_status "starting" "starting"
systemctl start smart-panel 2>&1 || {
	update_status "failed" "failed" "Failed to start service after update"
	exit 1
}

# Mark as complete
update_status "complete" "complete"

# Remove the exit trap since we completed successfully
trap - EXIT

exit 0
