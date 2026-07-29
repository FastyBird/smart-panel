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
# FB_CONFIG_PATH / FB_DB_PATH are kept inside the worktree so a workspace cannot
# write another checkout's state; export SUPERSET_ALLOW_SHARED_STATE=1 to opt out.
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

# What the apps themselves will resolve for a variable: an exported one wins,
# then the given env files (.env.local then .env by default), then the fallback.
# Anything this script only needs to know (rather than change) goes through here
# — exporting a "default" would override a configured value, since both the
# backend and Vite give the process environment priority over the env files.
env_value() { # env_value <KEY> <fallback> [env file...]
	node -e '
		const fs = require("fs");
		const path = require("path");
		const [key, fallback, ...files] = process.argv.slice(1);
		const searched = files.length > 0 ? files : [".env.local", ".env"];
		const DOUBLE_QUOTE = 34;
		const SINGLE_QUOTE = 39;

		const resolveValue = () => {
			if (process.env[key]) return process.env[key];

			for (const file of searched) {
				const full = path.join(process.cwd(), file);
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

					if (value) return value;
				}
			}

			return fallback;
		};

		console.log(resolveValue());
	' "$@"
}

# Start the backend scan at the configured port so a separate admin-only pane,
# which proxies to whatever the env files say, agrees with it. FB_ADMIN_PORT is
# not treated the same way: .env sets it to 80 for the bundled production admin,
# which the Vite dev server cannot bind.
backend_base="$(env_value FB_BACKEND_PORT 3000)"
case "$backend_base" in
'' | *[!0-9]*) backend_base=3000 ;;
esac

bases=""
if [ "$starts_backend" = yes ] && [ -z "${FB_BACKEND_PORT:-}" ]; then
	bases="$bases $backend_base"
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

# .env ships NODE_ENV=production for deployments, so treating it as configured
# would leave this dev runner in production mode — global-error.filter.ts then
# replaces exception details with "An unexpected server error occurred.". Only
# an ambient value or .env.local counts as a deliberate choice here.
if [ -z "$(env_value NODE_ENV '' .env.local)" ]; then
	export NODE_ENV=development
fi

# Superset runs setup and this script as separate processes, so the paths setup
# exported do not reach here — an ambient FB_DB_PATH/FB_CONFIG_PATH pointing
# outside the worktree would have this backend open, migrate and write another
# checkout's state while the copies setup prepared sit unused. Writing them into
# .env.local would not help either: @nestjs/config skips keys already present in
# process.env. So clamp them again, here, for the processes we start.
state_notes=""

inside_workspace() {
	case "$1/" in
	"$ROOT_DIR"/*) return 0 ;;
	*) return 1 ;;
	esac
}

clamp_state_path() { # clamp_state_path <KEY> <workspace default>
	local key="$1"
	local workspace_default="$2"
	local current

	# Resolve before comparing: string-prefixing the worktree onto the raw value
	# lets `var/../../shared` look contained while the backend's path.resolve
	# lands outside it. Resolving against the worktree also matches how setup.sh
	# read the same value — the backend would otherwise resolve a relative path
	# against apps/backend and miss the state setup prepared.
	current="$(node -e 'console.log(require("path").resolve(process.argv[1], process.argv[2]))' \
		"$ROOT_DIR" "$(env_value "$key" "$workspace_default")")"

	if [ -z "${SUPERSET_ALLOW_SHARED_STATE:-}" ] && ! inside_workspace "$current"; then
		state_notes="$state_notes  note      $key pointed outside the workspace ($current); using $workspace_default
"
		current="$workspace_default"
	fi

	# Always hand over the resolved path — including when shared state is allowed,
	# where the point is to reach the very directory setup used. The backend
	# resolves a relative value against apps/backend, so passing the raw string
	# through would land it somewhere setup never prepared.
	export "$key=$current"
}

if [ "$starts_backend" = yes ]; then
	clamp_state_path FB_CONFIG_PATH "$ROOT_DIR/var/data"
	clamp_state_path FB_DB_PATH "$ROOT_DIR/var/db"
fi

# A backend pane records the port it actually got, so an admin pane started
# later proxies to this workspace instead of whatever the env files name — with
# the configured port taken, the allocator moves on and .env alone would send
# /api to the root checkout's backend.
run_state_dir="$ROOT_DIR/.superset/.run-state"
backend_port_file="$run_state_dir/backend-port"
recorded_backend=""

port_is_live() {
	node -e '
		const net = require("net");
		const socket = net.connect(Number(process.argv[1]), "127.0.0.1");
		const done = (code) => { socket.destroy(); process.exit(code); };
		socket.setTimeout(500);
		socket.once("connect", () => done(0));
		socket.once("timeout", () => done(1));
		socket.once("error", () => done(1));
	' "$1"
}

app_host="$(env_value FB_APP_HOST http://127.0.0.1)"
overridden_host=""

if [ "$starts_admin" = yes ] && [ "$starts_backend" = no ] && [ -f "$backend_port_file" ]; then
	# The record is "<pid of the backend pane> <port>". Trust it while that pane
	# is alive — Nest takes tens of seconds to bind, and an admin pane started in
	# the meantime would otherwise reject a perfectly good allocation and spend
	# its whole life proxying to the fallback. A port that answers is trusted too,
	# for a backend that outlived its pane; anything else is stale.
	read -r recorded_pid candidate < "$backend_port_file" || true

	if [ -n "${candidate:-}" ]; then
		if kill -0 "$recorded_pid" 2>/dev/null || port_is_live "$candidate"; then
			recorded_backend="$candidate"
			app_host="http://127.0.0.1"
			export FB_APP_HOST="$app_host"
			export FB_BACKEND_PORT="$recorded_backend"
		fi
	fi
fi

if [ "$starts_backend" = yes ] && [ "$starts_admin" = yes ]; then
	# Vite builds its proxy target by pairing FB_APP_HOST with FB_BACKEND_PORT,
	# and the port is the local one allocated above — so any host but loopback
	# sends /api to a machine that is not running this backend. This wins over an
	# exported value too: it is the one combination that cannot be correct.
	if [ "$app_host" != "http://127.0.0.1" ]; then
		overridden_host="$app_host"
	fi

	app_host="http://127.0.0.1"
	export FB_APP_HOST="$app_host"
elif [ "$starts_backend" = yes ]; then
	# No admin proxy in this invocation, so nothing pairs the host with our port.
	# Keep the configured public origin — it is what the backend puts in absolute
	# URLs, and it stays reachable because the backend binds 0.0.0.0.
	export FB_APP_HOST="$app_host"
fi
# An admin-only run exports nothing: keeping the configured endpoint is the
# entire point, and app_host above is only used for the banner.

# The ports are different — these are ports this script picked, so the servers
# and the proxy have to be told about them.
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

	if [ "$starts_backend" = yes ]; then
		rm -f "$backend_port_file"
	fi

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
	printf '  backend   %s:%s  (docs at /api/docs)\n' "$app_host" "$FB_BACKEND_PORT"

	if [ -n "$overridden_host" ]; then
		printf '  note      FB_APP_HOST %s ignored: the admin proxy has to reach the backend started here\n' "$overridden_host"
		printf '            run the backend on its own to keep it as the public origin\n'
	fi

	if [ -n "$state_notes" ]; then
		printf '%s' "$state_notes"
		printf '            set SUPERSET_ALLOW_SHARED_STATE=1 to use the shared location instead\n'
	fi
fi

if [ "$starts_admin" = yes ]; then
	printf '  admin     http://localhost:%s\n' "$FB_ADMIN_PORT"

	# An admin-only run proxies /api somewhere it did not start — say where,
	# since nothing else on screen would reveal it.
	if [ "$starts_backend" = no ]; then
		if [ -n "$recorded_backend" ]; then
			printf '  api proxy %s:%s (backend started by this workspace)\n' "$app_host" "$recorded_backend"
		else
			proxy_port="$(env_value FB_BACKEND_PORT 3000)"
			printf '  api proxy %s:%s (from .env/.env.local)\n' "$app_host" "$proxy_port"

			if ! port_is_live "$proxy_port"; then
				printf '            nothing is listening there yet\n'
			fi
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
	mkdir -p "$run_state_dir"
	printf '%s %s\n' "$$" "$FB_BACKEND_PORT" > "$backend_port_file"

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
