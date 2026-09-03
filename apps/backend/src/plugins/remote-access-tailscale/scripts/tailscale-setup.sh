#!/bin/bash
# Privileged Tailscale setup job, run by PrivilegedWorkerService as
# `sudo -n systemd-run --scope --unit=smart-panel-remote-access bash
# tailscale-setup.sh` (see TailscaleSetupService.install()). Idempotent:
# re-running is harmless once every step has already succeeded.
#
# Steps: (1) install the `tailscale` package from the signed vendor apt
# repository if missing — never a downloaded script piped into a shell;
# (2) enable and start `tailscaled`; (3) grant SMART_PANEL_USER as operator
# so the backend can drive the daemon without sudo from then on.
#
# --dry-run prints the commands each step would run instead of running them
# and always finishes at "complete" with exit 0, regardless of the host OS —
# it previews the real branching logic without requiring root, apt, systemd
# or a Debian-family host, so it can run from a Jest spec on any platform.
set -e

STATUS_FILE="${STATUS_FILE:-/var/lib/smart-panel/remote-access/tailscale-setup-status.json}"
SMART_PANEL_USER="${SMART_PANEL_USER:-$(id -un)}"

DRY_RUN=0
for arg in "$@"; do
	case "$arg" in
	--dry-run) DRY_RUN=1 ;;
	esac
done

# Writes the canonical `{ state, step, message }` status PrivilegedWorkerService
# expects, via a temp file + rename so a concurrent read never sees a
# half-written file. printf %s (never direct interpolation into the format
# string) and the sed escape below keep an unexpected value out of the JSON
# structure.
write_status() {
	local state="$1"
	local step="$2"
	local message="${3:-}"
	local tmp_file="${STATUS_FILE}.tmp"
	local safe_message=""

	if [ -n "$message" ]; then
		safe_message=$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g')
	fi

	mkdir -p "$(dirname "$STATUS_FILE")"

	printf '{\n\t"state": "%s",\n\t"step": "%s",\n\t"message": "%s"\n}\n' \
		"$state" "$step" "$safe_message" >"$tmp_file"

	mv "$tmp_file" "$STATUS_FILE"
}

# Only fires on an exit this script did not already report itself (a crash,
# an unset-variable error, an unhandled command failure) — a step that
# already wrote "failed" leaves that status alone.
cleanup() {
	local exit_code=$?

	if [ "$exit_code" -ne 0 ]; then
		if [ -f "$STATUS_FILE" ] && grep -q '"state": "failed"' "$STATUS_FILE" 2>/dev/null; then
			return
		fi

		write_status "failed" "unknown" "Setup exited unexpectedly with code $exit_code"
	fi
}

trap cleanup EXIT

# ──────────────────────────────────────────────────────────────
# Step 1: install the tailscale package if missing
# ──────────────────────────────────────────────────────────────
if command -v tailscale >/dev/null 2>&1; then
	write_status "running" "install" "tailscale is already installed"
else
	write_status "running" "install" "Installing the tailscale package"

	OS_ID=""
	VERSION_CODENAME=""

	if [ -f /etc/os-release ]; then
		# shellcheck source=/dev/null
		. /etc/os-release
		OS_ID="${ID:-}"
		VERSION_CODENAME="${VERSION_CODENAME:-}"
	fi

	case "$OS_ID" in
	raspbian | debian | ubuntu)
		KEYRING="/usr/share/keyrings/tailscale-archive-keyring.gpg"
		LIST="/etc/apt/sources.list.d/tailscale.list"
		KEYRING_URL="https://pkgs.tailscale.com/stable/${OS_ID}/${VERSION_CODENAME}.noarmor.gpg"
		LIST_URL="https://pkgs.tailscale.com/stable/${OS_ID}/${VERSION_CODENAME}.tailscale-keyring.list"

		if [ "$DRY_RUN" -eq 1 ]; then
			echo "[dry-run] curl -fsSL $KEYRING_URL | tee $KEYRING"
			echo "[dry-run] curl -fsSL $LIST_URL | tee $LIST"
			echo "[dry-run] apt-get update -qq"
			echo "[dry-run] apt-get install -y -qq --no-install-recommends tailscale"
		else
			# Only the signed keyring and the apt source list are downloaded —
			# never a script. apt-get itself verifies every package against
			# this keyring before installing it.
			curl -fsSL "$KEYRING_URL" | tee "$KEYRING" >/dev/null || {
				write_status "failed" "install" "Failed to download the Tailscale apt keyring"
				exit 1
			}
			curl -fsSL "$LIST_URL" | tee "$LIST" >/dev/null || {
				write_status "failed" "install" "Failed to download the Tailscale apt source list"
				exit 1
			}
			apt-get update -qq || {
				write_status "failed" "install" "apt-get update failed"
				exit 1
			}
			apt-get install -y -qq --no-install-recommends tailscale || {
				write_status "failed" "install" "apt-get install tailscale failed"
				exit 1
			}
		fi
		;;
	*)
		if [ "$DRY_RUN" -eq 1 ]; then
			echo "[dry-run] unsupported OS (ID=${OS_ID:-unknown}) — a real run would stop here and report failed/install"
		else
			write_status "failed" "install" "Tailscale must be installed manually: https://tailscale.com/download/linux"
			exit 1
		fi
		;;
	esac
fi

# ──────────────────────────────────────────────────────────────
# Step 2: enable and start the daemon
# ──────────────────────────────────────────────────────────────
write_status "running" "daemon" "Enabling the tailscaled service"

if [ "$DRY_RUN" -eq 1 ]; then
	echo "[dry-run] systemctl enable --now tailscaled"
else
	systemctl enable --now tailscaled || {
		write_status "failed" "daemon" "systemctl enable --now tailscaled failed"
		exit 1
	}
fi

# ──────────────────────────────────────────────────────────────
# Step 3: grant the service user as operator
# ──────────────────────────────────────────────────────────────
write_status "running" "operator" "Granting $SMART_PANEL_USER as the Tailscale operator"

if [ "$DRY_RUN" -eq 1 ]; then
	echo "[dry-run] tailscale set --operator=$SMART_PANEL_USER"
else
	tailscale set "--operator=${SMART_PANEL_USER}" || {
		write_status "failed" "operator" "tailscale set --operator failed"
		exit 1
	}
fi

# ──────────────────────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────────────────────
write_status "complete" "complete" "Tailscale setup completed"

trap - EXIT
exit 0
