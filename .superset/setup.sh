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
#   SUPERSET_SKIP_DB_COPY=1        start from an empty database instead of
#                                  copying the root checkout's SQLite database
#   SUPERSET_SKIP_FLUTTER=1        skip the apps/panel steps (`flutter pub get`
#                                  and `melos rebuild-all`, ~2 min)
#   SUPERSET_ALLOW_SHARED_STATE=1  let FB_CONFIG_PATH/FB_DB_PATH point outside
#                                  the worktree instead of falling back to the
#                                  workspace copies — this branch's migrations
#                                  then run against that shared database
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
		# FB_CONFIG_PATH, FB_DB_PATH and FB_ADMIN_UI_PATH are read from the repo
		# root .env.local by the running backend. Copied verbatim they would point
		# this workspace at the root checkout's config and database — so anything
		# resolving inside the root checkout is repointed at the workspace copy.
		node -e '
			const fs = require("fs");
			const [src, dst, rootPath, workspacePath] = process.argv.slice(1);
			const DOUBLE_QUOTE = 34;
			const SINGLE_QUOTE = 39;
			const shared = [];

			const rewritten = fs
				.readFileSync(src, "utf8")
				.split(/\r?\n/)
				.map((line) => {
					const match = line.match(/^(\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)(.*)$/);
					if (!match) return line;

					const [, assignment, key, rawValue] = match;
					if (!/_PATH$/.test(key)) return line;

					const trimmed = rawValue.trim();
					const first = trimmed.charCodeAt(0);
					const quoted =
						trimmed.length > 1 &&
						(first === DOUBLE_QUOTE || first === SINGLE_QUOTE) &&
						trimmed.charCodeAt(trimmed.length - 1) === first;
					const quote = quoted ? trimmed[0] : "";
					const value = quoted ? trimmed.slice(1, -1) : trimmed;

					if (!value) return line;

					if (value === rootPath || value.startsWith(`${rootPath}/`)) {
						return `${assignment}${quote}${workspacePath}${value.slice(rootPath.length)}${quote}`;
					}

					if (value.startsWith("/")) shared.push(`${key}=${value}`);

					return line;
				})
				.join("\n");

			fs.writeFileSync(dst, rewritten);

			if (shared.length > 0) {
				console.error(`  kept absolute paths outside the root checkout: ${shared.join(", ")}`);
				console.error("  this workspace shares that state with the root checkout");
			}
		' "$SUPERSET_ROOT_PATH/.env.local" .env.local "$SUPERSET_ROOT_PATH" "$ROOT_DIR"
		# Written through writeFileSync, so it lands at 0644 under the usual umask
		# no matter how the source was protected — and it carries FB_TOKEN_SECRET.
		chmod 600 .env.local
	fi

fi

# --- effective config & database locations -----------------------------------
#
# FB_CONFIG_PATH and FB_DB_PATH may move either directory somewhere other than
# var/data and var/db, so resolve them from the env files rather than assuming
# the defaults — copying into (and migrating) the wrong directory would leave
# the workspace with empty state.

env_path() { # env_path <checkout> <KEY> <fallback>
	node -e '
		const fs = require("fs");
		const path = require("path");
		const [checkout, key, fallback] = process.argv.slice(1);
		const DOUBLE_QUOTE = 34;
		const SINGLE_QUOTE = 39;

		const resolveValue = () => {
			// @nestjs/config keeps an already-exported variable in preference to the
			// env files, so an ambient FB_DB_PATH/FB_CONFIG_PATH is what the backend
			// will actually open — resolve it the same way or setup prepares a
			// location nothing ever reads.
			if (process.env[key]) return path.resolve(checkout, process.env[key]);

			for (const file of [".env.local", ".env"]) {
				const full = path.join(checkout, file);
				if (!fs.existsSync(full)) continue;

				for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
					const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
					if (!match || match[1] !== key) continue;

					let value = match[2].trim();
					const first = value.charCodeAt(0);
					if (
						value.length > 1 &&
						(first === DOUBLE_QUOTE || first === SINGLE_QUOTE) &&
						value.charCodeAt(value.length - 1) === first
					) {
						value = value.slice(1, -1);
					}

					if (value) return path.resolve(checkout, value);
				}
			}

			return fallback;
		};

		console.log(resolveValue());
	' "$1" "$2" "$3"
}

# Resolve the root checkout's locations first: env_path honours ambient
# variables, and the exports below would otherwise answer for both sides.
root_config_dir=""
root_db_dir=""
if [ -n "${SUPERSET_ROOT_PATH:-}" ] && [ -d "$SUPERSET_ROOT_PATH" ] && [ "$SUPERSET_ROOT_PATH" != "$ROOT_DIR" ]; then
	root_config_dir="$(env_path "$SUPERSET_ROOT_PATH" FB_CONFIG_PATH "$SUPERSET_ROOT_PATH/var/data")"
	root_db_dir="$(env_path "$SUPERSET_ROOT_PATH" FB_DB_PATH "$SUPERSET_ROOT_PATH/var/db")"
fi

config_dir="$(env_path "$ROOT_DIR" FB_CONFIG_PATH "$ROOT_DIR/var/data")"
db_dir="$(env_path "$ROOT_DIR" FB_DB_PATH "$ROOT_DIR/var/db")"

# A location outside the worktree belongs to someone else — the root checkout or
# whatever an exported variable points at. Setup falls back to the workspace
# defaults there: it must not copy over live files, and it must not apply this
# branch's migrations to a database another checkout is running on.
inside_workspace() {
	case "$1/" in
	"$ROOT_DIR"/*) return 0 ;;
	*) return 1 ;;
	esac
}

if [ -n "${SUPERSET_ALLOW_SHARED_STATE:-}" ]; then
	if ! inside_workspace "$config_dir" || ! inside_workspace "$db_dir"; then
		warn "SUPERSET_ALLOW_SHARED_STATE is set — using state outside this workspace as-is"
		warn "Migrations from this branch will be applied to whatever else runs on it"
	fi
else
	if ! inside_workspace "$config_dir"; then
		warn "FB_CONFIG_PATH points outside this workspace ($config_dir)"
		warn "Preparing workspace-local configuration instead; .superset/run.sh keeps the backend on it"
		config_dir="$ROOT_DIR/var/data"
	fi

	if ! inside_workspace "$db_dir"; then
		warn "FB_DB_PATH points outside this workspace ($db_dir)"
		warn "Preparing a workspace-local database instead; .superset/run.sh keeps the backend on it"
		db_dir="$ROOT_DIR/var/db"
	fi
fi

mkdir -p "$config_dir" "$db_dir"

# Pin every later step to these. Generating the OpenAPI spec boots the whole
# Nest app, so without this an ambient FB_DB_PATH would have setup opening — and
# writing to — the database of another checkout.
export FB_CONFIG_PATH="$config_dir"
export FB_DB_PATH="$db_dir"

if [ -n "$root_config_dir" ]; then
	if [ -f "$root_config_dir/config.yaml" ] && [ ! -f "$config_dir/config.yaml" ]; then
		log "Copying config.yaml from the root checkout"
		cp "$root_config_dir/config.yaml" "$config_dir/config.yaml"
		chmod 600 "$config_dir/config.yaml"
		# ConfigService stores its own absolute location in the file — repoint it
		# at this workspace so the copied value is not misleading.
		node -e '
			const fs = require("fs");
			const [file] = process.argv.slice(1);
			const content = fs.readFileSync(file, "utf8");
			if (/^path: .*$/m.test(content)) {
				fs.writeFileSync(file, content.replace(/^path: .*$/m, `path: ${file}`));
			}
		' "$config_dir/config.yaml"
	fi

	if [ -z "${SUPERSET_SKIP_DB_COPY:-}" ] && [ -f "$root_db_dir/database.sqlite" ] && [ ! -f "$db_dir/database.sqlite" ]; then
		log "Copying the SQLite database from the root checkout"
		# Always go through the SQLite backup API. A plain cp of a database the
		# root backend is writing to can miss committed data still sitting in the
		# -wal file, or capture a torn page — and setup would report success while
		# handing over a database that is short of rows or will not open at all.
		if command -v sqlite3 >/dev/null 2>&1; then
			db_copied=$(sqlite3 "$root_db_dir/database.sqlite" ".backup '$db_dir/database.sqlite'" && echo yes || echo no)
		else
			# Node >= 24 is required by this repo and ships the same backup API.
			db_copied=$(node -e '
				const { DatabaseSync, backup } = require("node:sqlite");
				const [src, dst] = process.argv.slice(1);
				if (typeof backup !== "function") process.exit(1);
				const db = new DatabaseSync(src, { readOnly: true });
				backup(db, dst).then(
					() => db.close(),
					(error) => { db.close(); console.error(error.message); process.exit(1); },
				);
			' "$root_db_dir/database.sqlite" "$db_dir/database.sqlite" && echo yes || echo no)
		fi

		if [ "$db_copied" != "yes" ]; then
			rm -f "$db_dir/database.sqlite"
			warn "Could not snapshot the root database — starting empty. Create a user with 'pnpm run onboard'."
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
# The migration CLI reads its env from apps/backend, not the repo root, so it
# would default to var/db even when FB_DB_PATH moves the database elsewhere.
pnpm --filter @fastybird/smart-panel-backend run typeorm:migration:run

# --- Flutter panel (optional) ------------------------------------------------
#
# apps/panel/lib/api and apps/panel/lib/spec are generated and untracked, so the
# panel does not compile in a fresh worktree until they are rebuilt.

if [ -z "${SUPERSET_SKIP_FLUTTER:-}" ] && command -v flutter >/dev/null 2>&1; then
	log "Fetching Flutter packages for apps/panel"
	if ! (cd apps/panel && flutter pub get); then
		warn "flutter pub get failed — run it manually before working on the panel app"
	elif command -v melos >/dev/null 2>&1; then
		log "Generating the panel API client and specs (melos rebuild-all)"
		melos rebuild-all || warn "melos rebuild-all failed — run it manually before working on the panel app"
	else
		warn "melos not found — run 'melos rebuild-all' after installing it to generate apps/panel/lib/{api,spec}"
	fi
fi

printf '\n\033[1;32m✓ Workspace ready\033[0m\n'
printf '  Start the dev servers with the Run button (or ./.superset/run.sh).\n'
printf '  No user account yet? Run: pnpm run onboard\n\n'
