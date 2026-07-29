#!/usr/bin/env bash
#
# Superset run command — FastyBird Smart Panel dev servers.
#
# Usage: ./.superset/run.sh [backend|admin|website|testing|all]
#        (default: backend + admin)
#
# Ports are picked automatically starting from the project defaults, so several
# workspaces (and the root checkout) can run side by side. Pin them by exporting
# FB_BACKEND_PORT / FB_ADMIN_PORT / FB_WEBSITE_PORT before starting.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGET="${1:-default}"

# First free TCP port at or above $1.
free_port() {
	node -e '
		const net = require("net");
		let port = Number(process.argv[1]);
		const probe = () => {
			const server = net.createServer();
			server.once("error", () => { port += 1; probe(); });
			server.once("listening", () => server.close(() => console.log(port)));
			server.listen(port, "0.0.0.0");
		};
		probe();
	' "$1"
}

# The backend reads these from process.env before .env/.env.local, and the admin
# vite config exposes any FB_APP_/FB_BACKEND_/FB_ADMIN_ prefixed process.env var
# with priority over the root .env files — so exporting them here wins.
export NODE_ENV="${NODE_ENV:-development}"
export FB_APP_HOST="${FB_APP_HOST:-http://127.0.0.1}"
export FB_BACKEND_PORT="${FB_BACKEND_PORT:-$(free_port 3000)}"
export FB_ADMIN_PORT="${FB_ADMIN_PORT:-$(free_port 3003)}"
FB_WEBSITE_PORT="${FB_WEBSITE_PORT:-$(free_port 3006)}"

pids=""

# The servers run three processes deep (pnpm → nest/vite → the app itself) and
# the leaf process is the one holding the port, so signalling just the pnpm
# parent orphans a listening server. Print every descendant of $1, depth first.
descendants() {
	local child
	for child in $(pgrep -P "$1" 2>/dev/null || true); do
		printf '%s ' "$child"
		descendants "$child"
	done
}

cleanup() {
	trap - INT TERM EXIT

	# Snapshot the trees while they are still intact — once a parent dies its
	# children are reparented and can no longer be found through it.
	local targets="" pid
	for pid in $pids; do
		targets="$targets $pid $(descendants "$pid")"
	done

	# Parents first, so watch mode cannot respawn what we just killed.
	for pid in $targets; do
		kill -TERM "$pid" 2>/dev/null || true
	done

	sleep 2

	for pid in $targets; do
		kill -KILL "$pid" 2>/dev/null || true
	done

	wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

start() {
	local label="$1"
	shift
	printf '\033[1;36m▸ starting %s\033[0m\n' "$label"
	"$@" &
	pids="$pids $!"
}

printf '\n\033[1mFastyBird Smart Panel — %s\033[0m\n' "${SUPERSET_WORKSPACE_NAME:-workspace}"

case "$TARGET" in
default | backend | all)
	printf '  backend   %s:%s  (docs at /api/docs)\n' "$FB_APP_HOST" "$FB_BACKEND_PORT"
	;;
esac

case "$TARGET" in
default | admin | all)
	printf '  admin     http://localhost:%s\n' "$FB_ADMIN_PORT"
	;;
esac

case "$TARGET" in
website | all)
	printf '  website   http://localhost:%s\n' "$FB_WEBSITE_PORT"
	;;
esac

case "$TARGET" in
testing)
	printf '  testing app — vite prints its URL below\n'
	;;
esac

printf '\n'

case "$TARGET" in
default | backend | all)
	start "backend (nest --watch)" pnpm --filter @fastybird/smart-panel-backend run start:dev
	;;
esac

case "$TARGET" in
default | admin | all)
	start "admin (vite)" pnpm --filter @fastybird/smart-panel-admin run start:dev
	;;
esac

case "$TARGET" in
website | all)
	start "website (next)" pnpm --filter @fastybird/smart-panel-website exec next dev -p "$FB_WEBSITE_PORT"
	;;
esac

case "$TARGET" in
testing)
	start "testing app (vite)" pnpm --filter @fastybird/smart-panel-testing run start:dev
	;;
esac

if [ -z "$pids" ]; then
	echo "Unknown target '$TARGET' — use: backend | admin | website | testing | all" >&2
	exit 1
fi

wait
