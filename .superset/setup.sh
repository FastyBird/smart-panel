#!/usr/bin/env bash
#
# Superset workspace setup — FastyBird Smart Panel
#
# Runs once when a new workspace (git worktree) is created. It installs the pnpm
# workspace dependencies, generates the code that the apps import at build time
# (device/channel specs, OpenAPI clients), seeds the workspace with the local dev
# state from the root checkout, and applies the database migrations.
#
# It intentionally skips the production builds that `pnpm run bootstrap` does
# (backend `nest build`, admin `vue-tsc` + `vite build`) — the dev servers
# started by `.superset/run.sh` compile on the fly, and those builds are the
# slowest part of bootstrap.
#
# Knobs:
#   SUPERSET_SKIP_DB_COPY=1   start from an empty database instead of copying
#                             the root checkout's SQLite database
#   SUPERSET_SKIP_FLUTTER=1   skip `flutter pub get` for apps/panel
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

# --- toolchain ---------------------------------------------------------------

if ! command -v pnpm >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then
	log "Enabling pnpm through corepack"
	corepack enable >/dev/null 2>&1 || true
fi

if ! command -v pnpm >/dev/null 2>&1; then
	echo "pnpm not found. Install Node.js >= 24 and run 'corepack enable'." >&2
	exit 1
fi

# --- dependencies ------------------------------------------------------------

log "Installing workspace dependencies"
if ! pnpm install --frozen-lockfile; then
	warn "Frozen install failed (lockfile out of sync?) — retrying without --frozen-lockfile"
	pnpm install
fi

# --- runtime directories -----------------------------------------------------

log "Creating runtime directories"
node init.js

# --- local dev state from the root checkout ----------------------------------
#
# .env.local, var/data/config.yaml and var/db/database.sqlite are gitignored, so
# a fresh worktree has none of them. Copying them over means the workspace boots
# with the same configuration and user account as the root checkout instead of
# needing `pnpm run onboard` first. Existing files are never overwritten.

if [ -n "${SUPERSET_ROOT_PATH:-}" ] && [ -d "$SUPERSET_ROOT_PATH" ] && [ "$SUPERSET_ROOT_PATH" != "$ROOT_DIR" ]; then
	if [ -f "$SUPERSET_ROOT_PATH/.env.local" ] && [ ! -f .env.local ]; then
		log "Copying .env.local from the root checkout"
		cp "$SUPERSET_ROOT_PATH/.env.local" .env.local
	fi

	if [ -f "$SUPERSET_ROOT_PATH/var/data/config.yaml" ] && [ ! -f var/data/config.yaml ]; then
		log "Copying var/data/config.yaml from the root checkout"
		cp "$SUPERSET_ROOT_PATH/var/data/config.yaml" var/data/config.yaml
		chmod 600 var/data/config.yaml
		# ConfigService stores its own absolute location in the file — repoint it
		# at this workspace so the copied value is not misleading.
		node -e '
			const fs = require("fs");
			const file = "var/data/config.yaml";
			const target = `${process.cwd()}/${file}`;
			const content = fs.readFileSync(file, "utf8");
			if (/^path: .*$/m.test(content)) {
				fs.writeFileSync(file, content.replace(/^path: .*$/m, `path: ${target}`));
			}
		'
	fi

	if [ -z "${SUPERSET_SKIP_DB_COPY:-}" ] && [ -f "$SUPERSET_ROOT_PATH/var/db/database.sqlite" ] && [ ! -f var/db/database.sqlite ]; then
		log "Copying the SQLite database from the root checkout"
		if command -v sqlite3 >/dev/null 2>&1; then
			# .backup takes a consistent snapshot even if the root backend is running.
			sqlite3 "$SUPERSET_ROOT_PATH/var/db/database.sqlite" ".backup '$ROOT_DIR/var/db/database.sqlite'"
		else
			cp "$SUPERSET_ROOT_PATH/var/db/database.sqlite" var/db/database.sqlite
		fi
	fi
fi

# --- generated code ----------------------------------------------------------
#
# spec/api/v1/openapi.json, apps/admin/src/openapi.ts and apps/backend/src/spec
# are generated, not committed — the apps do not compile without them.

log "Generating device & channel specs"
pnpm run generate:spec

log "Building the extension SDK"
pnpm --filter @fastybird/smart-panel-extension-sdk run build

log "Generating the OpenAPI spec and typed API clients"
pnpm run generate:openapi

log "Applying database migrations"
pnpm --filter @fastybird/smart-panel-backend run typeorm:migration:run

# --- Flutter panel (optional) ------------------------------------------------

if [ -z "${SUPERSET_SKIP_FLUTTER:-}" ] && command -v flutter >/dev/null 2>&1; then
	log "Fetching Flutter packages for apps/panel"
	(cd apps/panel && flutter pub get) || warn "flutter pub get failed — run it manually before working on the panel app"
fi

printf '\n\033[1;32m✓ Workspace ready\033[0m\n'
printf '  Start the dev servers with the Run button (or ./.superset/run.sh).\n'
printf '  No user account yet? Run: pnpm run onboard\n\n'
