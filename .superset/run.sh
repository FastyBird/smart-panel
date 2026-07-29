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

# Pick one free port per base, all in a single pass: every probe socket stays
# bound until the last port is chosen, and ports already claimed by the caller
# are excluded. Probing each base independently would hand two services the same
# port whenever their scan ranges meet — with 3000-3004 busy, a scan from 3000
# and a scan from 3003 both land on 3005.
# Usage: alloc_ports "<comma separated ports to avoid>" <base> [base...]
alloc_ports() {
	node -e '
		const net = require("net");
		const taken = new Set(String(process.argv[1]).split(",").filter(Boolean).map(Number));
		const bases = process.argv.slice(2).map(Number);
		const held = [];
		const chosen = [];

		const claim = (port, done) => {
			if (taken.has(port)) return claim(port + 1, done);

			const server = net.createServer();
			server.once("error", () => claim(port + 1, done));
			server.once("listening", () => {
				held.push(server);
				taken.add(port);
				done(port);
			});
			server.listen(port, "0.0.0.0");
		};

		const report = () => {
			let pending = held.length;
			if (pending === 0) return console.log(chosen.join(" "));
			held.forEach((server) => server.close(() => { if (--pending === 0) console.log(chosen.join(" ")); }));
		};

		const next = (index) => {
			if (index === bases.length) return report();
			claim(bases[index], (port) => { chosen.push(port); next(index + 1); });
		};

		next(0);
	' "$@"
}

starts_backend=no
starts_admin=no
starts_website=no
starts_testing=no

case "$TARGET" in
default | backend | all) starts_backend=yes ;;
esac
case "$TARGET" in
default | admin | all) starts_admin=yes ;;
esac
case "$TARGET" in
website | all) starts_website=yes ;;
esac
case "$TARGET" in
testing) starts_testing=yes ;;
esac

if [ "$starts_backend$starts_admin$starts_website$starts_testing" = "nononono" ]; then
	echo "Unknown target '$TARGET' — use: backend | admin | website | testing | all" >&2
	exit 1
fi

# Only allocate a port for a server this invocation actually starts. Allocating
# FB_BACKEND_PORT for an admin-only run would export a port that is free by
# construction, pointing the admin's /api proxy at nothing — an admin-only run
# has to keep whatever backend endpoint .env/.env.local already configures.
pinned=""
for port in "${FB_BACKEND_PORT:-}" "${FB_ADMIN_PORT:-}" "${FB_WEBSITE_PORT:-}"; do
	if [ -n "$port" ]; then
		pinned="$pinned,$port"
	fi
done

bases=""
if [ "$starts_backend" = yes ] && [ -z "${FB_BACKEND_PORT:-}" ]; then
	bases="$bases 3000"
fi
if [ "$starts_admin" = yes ] && [ -z "${FB_ADMIN_PORT:-}" ]; then
	bases="$bases 3003"
fi
if [ "$starts_website" = yes ] && [ -z "${FB_WEBSITE_PORT:-}" ]; then
	bases="$bases 3006"
fi

allocated=""
if [ -n "$bases" ]; then
	allocated="$(alloc_ports "$pinned" $bases)"
fi

# Consume the allocations in the same order the bases were queued.
set -- $allocated
if [ "$starts_backend" = yes ] && [ -z "${FB_BACKEND_PORT:-}" ]; then
	FB_BACKEND_PORT="$1"
	shift
fi
if [ "$starts_admin" = yes ] && [ -z "${FB_ADMIN_PORT:-}" ]; then
	FB_ADMIN_PORT="$1"
	shift
fi
if [ "$starts_website" = yes ] && [ -z "${FB_WEBSITE_PORT:-}" ]; then
	FB_WEBSITE_PORT="$1"
	shift
fi

# The backend reads these from process.env before .env/.env.local, and the admin
# vite config exposes any FB_APP_/FB_BACKEND_/FB_ADMIN_ prefixed process.env var
# with priority over the root .env files — so exporting them here wins.
export NODE_ENV="${NODE_ENV:-development}"
export FB_APP_HOST="${FB_APP_HOST:-http://127.0.0.1}"
if [ -n "${FB_BACKEND_PORT:-}" ]; then
	export FB_BACKEND_PORT
fi
if [ -n "${FB_ADMIN_PORT:-}" ]; then
	export FB_ADMIN_PORT
fi

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

if [ "$starts_backend" = yes ]; then
	printf '  backend   %s:%s  (docs at /api/docs)\n' "$FB_APP_HOST" "$FB_BACKEND_PORT"
fi

if [ "$starts_admin" = yes ]; then
	printf '  admin     http://localhost:%s\n' "$FB_ADMIN_PORT"

	if [ "$starts_backend" = no ]; then
		if [ -n "${FB_BACKEND_PORT:-}" ]; then
			printf '  api proxy %s:%s\n' "$FB_APP_HOST" "$FB_BACKEND_PORT"
		else
			printf '  api proxy → FB_BACKEND_PORT from .env/.env.local (export it to point elsewhere)\n'
		fi
	fi
fi

if [ "$starts_website" = yes ]; then
	printf '  website   http://localhost:%s\n' "$FB_WEBSITE_PORT"
fi

if [ "$starts_testing" = yes ]; then
	printf '  testing app — vite prints its URL below\n'
fi

printf '\n'

if [ "$starts_backend" = yes ]; then
	start "backend (nest --watch)" pnpm --filter @fastybird/smart-panel-backend run start:dev
fi

if [ "$starts_admin" = yes ]; then
	start "admin (vite)" pnpm --filter @fastybird/smart-panel-admin run start:dev
fi

if [ "$starts_website" = yes ]; then
	start "website (next)" pnpm --filter @fastybird/smart-panel-website exec next dev -p "$FB_WEBSITE_PORT"
fi

if [ "$starts_testing" = yes ]; then
	start "testing app (vite)" pnpm --filter @fastybird/smart-panel-testing run start:dev
fi

wait
