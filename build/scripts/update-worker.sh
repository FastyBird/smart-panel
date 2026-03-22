#!/bin/bash
set -e

VERSION="${1:-${UPDATE_VERSION:-latest}}"
STATUS_FILE="${STATUS_FILE:-/var/lib/smart-panel/update-status.json}"
INSTALL_TYPE="${INSTALL_TYPE:-npm}"
IMAGE_BASE_DIR="${IMAGE_BASE_DIR:-/opt/smart-panel}"
DOWNLOAD_URL="${DOWNLOAD_URL:-}"

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
		# Only write a generic failure if a specific error wasn't already recorded
		if [ -f "$STATUS_FILE" ] && grep -q '"status": "failed"' "$STATUS_FILE" 2>/dev/null; then
			return
		fi
		update_status "failed" "failed" "Update process exited with code $exit_code"
	fi
}

trap cleanup EXIT

# ──────────────────────────────────────────────────────────────
# Image-based update (Raspbian image installs)
# ──────────────────────────────────────────────────────────────
if [ "$INSTALL_TYPE" = "image" ]; then
	NEW_VERSION_DIR="${IMAGE_BASE_DIR}/v${VERSION}"
	CURRENT_LINK="${IMAGE_BASE_DIR}/current"
	PREVIOUS_TARGET=""

	# Save the current version for rollback
	if [ -L "$CURRENT_LINK" ]; then
		PREVIOUS_TARGET=$(readlink "$CURRENT_LINK")
	fi

	# Guard: refuse to overwrite the currently running version
	RESOLVED_PREV=$(realpath "$PREVIOUS_TARGET" 2>/dev/null || true)
	RESOLVED_NEW=$(realpath "$NEW_VERSION_DIR" 2>/dev/null || true)

	if [ -n "$PREVIOUS_TARGET" ] && [ -n "$RESOLVED_PREV" ] && [ -n "$RESOLVED_NEW" ] && [ "$RESOLVED_PREV" = "$RESOLVED_NEW" ]; then
		update_status "failed" "failed" "Target version v${VERSION} is already the active version"
		exit 1
	fi

	# ── Download ──
	update_status "downloading" "downloading"

	if [ -z "$DOWNLOAD_URL" ]; then
		update_status "failed" "failed" "No download URL provided for image update"
		exit 1
	fi

	TMP_TARBALL="/tmp/smart-panel-backend-v${VERSION}.tar.gz"

	curl -fSL -o "$TMP_TARBALL" "$DOWNLOAD_URL" 2>&1 || {
		update_status "failed" "failed" "Download failed from ${DOWNLOAD_URL}"
		exit 1
	}

	# ── Extract ──
	update_status "installing" "installing"

	mkdir -p "$NEW_VERSION_DIR"

	tar -xzf "$TMP_TARBALL" -C "$NEW_VERSION_DIR" 2>&1 || {
		rm -rf "$NEW_VERSION_DIR"
		rm -f "$TMP_TARBALL"
		update_status "failed" "failed" "Failed to extract update archive"
		exit 1
	}

	rm -f "$TMP_TARBALL"

	# Create the image-install marker in the new version
	touch "${NEW_VERSION_DIR}/.image-install" || {
		rm -rf "$NEW_VERSION_DIR"
		update_status "failed" "failed" "Failed to create image-install marker"
		exit 1
	}

	# ── Install dependencies ──
	cd "$NEW_VERSION_DIR"

	pnpm install --prod --ignore-scripts 2>&1 || {
		rm -rf "$NEW_VERSION_DIR"
		update_status "failed" "failed" "pnpm install failed"
		exit 1
	}

	# ── Rebuild native modules ──
	if [ -x "${IMAGE_BASE_DIR}/rebuild-native.sh" ]; then
		"${IMAGE_BASE_DIR}/rebuild-native.sh" "${NEW_VERSION_DIR}" 2>&1 || {
			rm -rf "$NEW_VERSION_DIR"
			update_status "failed" "failed" "Native module rebuild failed"
			exit 1
		}
	fi

	# Set ownership
	sudo chown -R smart-panel:smart-panel "$NEW_VERSION_DIR" || {
		rm -rf "$NEW_VERSION_DIR"
		update_status "failed" "failed" "Failed to set ownership on ${NEW_VERSION_DIR}"
		exit 1
	}

	# ── Stop service ──
	update_status "stopping" "stopping"
	sudo systemctl stop smart-panel 2>/dev/null || true

	# ── Switch symlink (atomic on same filesystem) ──
	sudo ln -sfn "$NEW_VERSION_DIR" "$CURRENT_LINK" || {
		# Revert on failure
		if [ -n "$PREVIOUS_TARGET" ]; then
			sudo ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"
		fi
		sudo systemctl start smart-panel 2>/dev/null || true
		update_status "failed" "failed" "Failed to switch version symlink"
		exit 1
	}

	# ── Run database migrations ──
	update_status "migrating" "migrating"

	ENV_FILE="/etc/smart-panel/environment"

	if [ -f "${NEW_VERSION_DIR}/dist/dataSource.js" ]; then
		(
			set -a
			# shellcheck source=/dev/null
			[ -f "$ENV_FILE" ] && . "$ENV_FILE"
			set +a
			cd "$NEW_VERSION_DIR"
			node node_modules/typeorm/cli.js migration:run -d dist/dataSource.js
		) 2>&1 || {
			# Migration failed — revert symlink if possible
			update_status "stopping" "stopping"
			sudo systemctl stop smart-panel 2>/dev/null || true

			if [ -n "$PREVIOUS_TARGET" ]; then
				sudo ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"
				rm -rf "$NEW_VERSION_DIR"
				update_status "failed" "failed" "Database migration failed — reverted to previous version"
			else
				# No previous version — keep current in place so system stays bootable
				update_status "failed" "failed" "Database migration failed — no previous version to revert to"
			fi

			sudo systemctl start smart-panel 2>/dev/null || true
			exit 1
		}
	fi

	# ── Start service ──
	update_status "starting" "starting"
	sudo systemctl start smart-panel 2>&1 || {
		# Try to revert if start fails
		if [ -n "$PREVIOUS_TARGET" ]; then
			sudo ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"
			sudo systemctl start smart-panel 2>/dev/null || true
		fi
		update_status "failed" "failed" "Failed to start service after update"
		exit 1
	}

	# ── Cleanup old versions (keep max 2 previous) ──
	cd "$IMAGE_BASE_DIR"
	# shellcheck disable=SC2012
	OLD_VERSIONS=$(ls -d v*/ 2>/dev/null | sort -V | head -n -3 || true)

	for old_dir in $OLD_VERSIONS; do
		# Never remove the current version
		if [ "$old_dir" != "$(basename "$(readlink "$CURRENT_LINK")")/" ]; then
			rm -rf "${IMAGE_BASE_DIR}/${old_dir}"
		fi
	done

	# ── Mark complete ──
	update_status "complete" "complete"
	trap - EXIT
	exit 0
fi

# ──────────────────────────────────────────────────────────────
# NPM-based update (global npm installs)
# ──────────────────────────────────────────────────────────────

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
