#!/usr/bin/env bash
#
# Superset workspace teardown — FastyBird Smart Panel
#
# Runs when the workspace is deleted. Setup only writes files inside the
# worktree (which Superset removes with the workspace), so the only thing worth
# undoing is Docker: the dev compose stack (backend, admin, InfluxDB, Chronograf)
# if it was ever started from this workspace.
#
# Only compose projects that belong to this workspace are removed. The root
# checkout's projects ("smart-panel" and "dev", the default name when running
# `docker compose -f docker/dev/docker-compose.yml`) are explicitly left alone —
# tearing those down would delete the InfluxDB data of the main checkout.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
	log "Docker not running — nothing to tear down"
	exit 0
fi

projects="$(docker compose ls --all --format json 2>/dev/null || echo '[]')"

for project in "smart-panel-${SUPERSET_WORKSPACE_NAME:-}" "$(basename "$ROOT_DIR")"; do
	case "$project" in
	"" | "smart-panel-" | smart-panel | dev)
		# Not workspace specific — belongs to the root checkout.
		continue
		;;
	esac

	case "$projects" in
	*"\"Name\":\"$project\""*) ;;
	*) continue ;;
	esac

	log "Removing docker compose project '$project'"
	docker compose -p "$project" down --volumes --remove-orphans || true
done
