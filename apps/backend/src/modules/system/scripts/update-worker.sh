#!/bin/bash
set -e

VERSION="${1:-${UPDATE_VERSION:-latest}}"
STATUS_FILE="${STATUS_FILE:-/var/lib/smart-panel/update-status.json}"
INSTALL_TYPE="${INSTALL_TYPE:-npm}"
IMAGE_BASE_DIR="${IMAGE_BASE_DIR:-/opt/smart-panel}"
DOWNLOAD_URL="${DOWNLOAD_URL:-}"

# Capture once — used for all status writes so timeout detection works correctly
STARTED_AT="$(date -Iseconds)"

update_status() {
	local status="$1"
	local phase="$2"
	local error="${3:-}"
	local completed_at=""

	if [ "$status" = "complete" ] || [ "$status" = "failed" ]; then
		completed_at=$(date -Iseconds)
	fi

	local tmp_file="${STATUS_FILE}.tmp"

	# Use printf with %s to prevent injection in JSON values.
	# Escape double-quotes and backslashes in the error message.
	local safe_error=""
	if [ -n "$error" ]; then
		safe_error=$(printf '%s' "$error" | sed 's/\\/\\\\/g; s/"/\\"/g')
	fi

	printf '{\n\t"status": "%s",\n\t"phase": "%s",\n\t"targetVersion": "%s",\n\t"startedAt": "%s"' \
		"$status" "$phase" "$VERSION" "$STARTED_AT" > "$tmp_file"

	if [ -n "$completed_at" ]; then
		printf ',\n\t"completedAt": "%s"' "$completed_at" >> "$tmp_file"
	fi

	printf ',\n\t"error": "%s"' "$safe_error" >> "$tmp_file"
	printf '\n}\n' >> "$tmp_file"

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
	# Verify passwordless sudo is available (required for systemctl, chown, ln).
	# The sudoers policy must include /usr/bin/true for this check.
	if ! sudo -n /usr/bin/true 2>/dev/null; then
		update_status "failed" "failed" "Passwordless sudo is not available for this user"
		exit 1
	fi
	# Strip leading 'v' prefix if present to avoid double-prefixed dirs like vv1.0.0
	CLEAN_VERSION="${VERSION#v}"
	NEW_VERSION_DIR="${IMAGE_BASE_DIR}/v${CLEAN_VERSION}"
	CURRENT_LINK="${IMAGE_BASE_DIR}/current"
	PREVIOUS_TARGET=""

	# Save the current version for rollback
	if [ -L "$CURRENT_LINK" ]; then
		PREVIOUS_TARGET=$(readlink "$CURRENT_LINK")
	fi

	# Guard: refuse to overwrite the currently running version
	# Resolve relative to IMAGE_BASE_DIR since PREVIOUS_TARGET may be relative
	RESOLVED_PREV=$(cd "$IMAGE_BASE_DIR" && realpath "$PREVIOUS_TARGET" 2>/dev/null || true)
	RESOLVED_NEW=$(cd "$IMAGE_BASE_DIR" && realpath "$NEW_VERSION_DIR" 2>/dev/null || true)

	if [ -n "$PREVIOUS_TARGET" ] && [ -n "$RESOLVED_PREV" ] && [ -n "$RESOLVED_NEW" ] && [ "$RESOLVED_PREV" = "$RESOLVED_NEW" ]; then
		update_status "failed" "failed" "Target version v${CLEAN_VERSION} is already the active version"
		exit 1
	fi

	# ── Download ──
	update_status "downloading" "downloading"

	if [ -z "$DOWNLOAD_URL" ]; then
		update_status "failed" "failed" "No download URL provided for image update"
		exit 1
	fi

	TMP_TARBALL="/tmp/smart-panel-backend-v${CLEAN_VERSION}.tar.gz"

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

	# ── Verify dependencies ──
	cd "$NEW_VERSION_DIR"

	# The release tarball includes pre-built node_modules with native modules
	# compiled for ARM64 by the CI arm-runner. Only install as fallback if
	# node_modules is missing (e.g. manually extracted tarball without deps).
	if [ ! -d "node_modules" ]; then
		npm install --omit=dev 2>&1 || {
			rm -rf "$NEW_VERSION_DIR"
			update_status "failed" "failed" "npm install failed"
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
				if sudo ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"; then
					rm -rf "$NEW_VERSION_DIR"
					update_status "failed" "failed" "Database migration failed — reverted to previous version"
				else
					# Symlink revert failed — keep new version so system stays bootable
					update_status "failed" "failed" "Database migration failed — symlink revert also failed"
				fi
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

	# Use the known current version rather than re-reading the symlink,
	# so cleanup is safe even if readlink fails unexpectedly
	CURRENT_BASENAME="v${CLEAN_VERSION}"

	if [ -n "$CURRENT_BASENAME" ]; then
		# Only match semver-versioned directories (v<digits>.<digits>.<digits>*)
		# to avoid accidentally deleting unrelated v-prefixed directories
		# shellcheck disable=SC2010
		OLD_VERSIONS=$(ls -d v[0-9]*.[0-9]*.[0-9]*/ 2>/dev/null | grep -v "^${CURRENT_BASENAME}/" | sort -V | head -n -2 || true)

		for old_dir in $OLD_VERSIONS; do
			rm -rf "${IMAGE_BASE_DIR}/${old_dir}"
		done
	fi

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
sudo systemctl stop smart-panel 2>/dev/null || true

# Install the update
update_status "installing" "installing"

if [ "$VERSION" = "latest" ]; then
	npm update -g @fastybird/smart-panel 2>&1 || {
		update_status "failed" "failed" "npm update failed"
		sudo systemctl start smart-panel 2>/dev/null || true
		exit 1
	}
else
	npm install -g "@fastybird/smart-panel@$VERSION" 2>&1 || {
		update_status "failed" "failed" "npm install failed for version $VERSION"
		sudo systemctl start smart-panel 2>/dev/null || true
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
		sudo systemctl start smart-panel 2>/dev/null || true
		exit 1
	}
fi

# Start the service
update_status "starting" "starting"
sudo systemctl start smart-panel 2>&1 || {
	update_status "failed" "failed" "Failed to start service after update"
	exit 1
}

# Mark as complete
update_status "complete" "complete"

# Remove the exit trap since we completed successfully
trap - EXIT

exit 0
