#!/bin/bash
# Privileged Cloudflare Tunnel setup job, run by PrivilegedWorkerService as
# `sudo -n systemd-run --scope --unit=smart-panel-remote-access-cloudflare
# bash cloudflared-setup.sh` (see CloudflareTunnelSetupService.install()).
# Idempotent: re-running is harmless once the package is already installed.
#
# Unlike tailscale-setup.sh, this script has exactly one step: install the
# `cloudflared` package from the signed vendor apt repository — never a
# downloaded script piped into a shell. Enabling a daemon and granting an
# operator are Tailscale-specific: the Cloudflare Tunnel connector itself
# runs unprivileged as a child process of the backend (D9), never through
# systemd, so there is nothing else for this privileged job to do.
#
# --dry-run prints the commands each step would run instead of running them
# and always finishes at "complete" with exit 0, regardless of the host OS —
# it previews the real branching logic without requiring root, apt or a
# Debian-family host, so it can run from a Jest spec on any platform.
#
# --print-plan is a separate, read-only mode for CloudflareTunnelManagedService's
# D12 remedy builder: it prints one command per line for the detected
# ID/VERSION_CODENAME from /etc/os-release and executes nothing at all — no
# status file, no trap. This is what keeps the admin-facing "run this
# yourself" remedy list from ever drifting out of sync with what the
# privileged install step above actually runs. An unsupported (non-Debian-family)
# distribution prints nothing on stdout — the caller's own signal to fall
# back to a vendor link instead of a command list.
set -e
# Without this, `curl ... | tee ...` reports tee's exit status, not curl's —
# a failed download would be silently treated as success by the `|| { ... }`
# guards below.
set -o pipefail

STATUS_FILE="${STATUS_FILE:-/var/lib/smart-panel/remote-access-cloudflare-tunnel/cloudflare-tunnel-setup-status.json}"

KEYRING_URL="https://pkg.cloudflare.com/cloudflare-main.gpg"
KEYRING_PATH="/usr/share/keyrings/cloudflare-main.gpg"
LIST_PATH="/etc/apt/sources.list.d/cloudflared.list"
LIST_LINE="deb [signed-by=${KEYRING_PATH}] https://pkg.cloudflare.com/cloudflared any main"

DRY_RUN=0
PRINT_PLAN=0
for arg in "$@"; do
	case "$arg" in
	--dry-run) DRY_RUN=1 ;;
	--print-plan) PRINT_PLAN=1 ;;
	esac
done

# Read-only, side-effect-free: print the plan and exit before this script
# ever touches STATUS_FILE or registers the cleanup trap below.
if [ "$PRINT_PLAN" -eq 1 ]; then
	OS_ID=""

	if [ -f /etc/os-release ]; then
		# shellcheck source=/dev/null
		. /etc/os-release
		OS_ID="${ID:-}"
	fi

	case "$OS_ID" in
	raspbian | debian | ubuntu)
		# `sudo` sits on the `tee` side, not the whole pipeline - prefixing the
		# entire line would only elevate `curl`/`echo` and leave `tee` unable to
		# write these root-owned paths. The caller (CloudflareTunnelManagedService)
		# only blind-prefixes `sudo` onto lines that do not already contain a pipe.
		echo "curl -fsSL ${KEYRING_URL} | sudo tee ${KEYRING_PATH} >/dev/null"
		echo "echo '${LIST_LINE}' | sudo tee ${LIST_PATH} >/dev/null"
		echo "apt-get update -qq"
		echo "apt-get install -y -qq --no-install-recommends cloudflared"
		;;
	*)
		# Unsupported distribution: intentionally prints nothing on stdout — the
		# caller's signal to fall back to a vendor link instead of a command
		# list. A note on stderr only, for a human running this script directly.
		echo "unsupported distribution (ID=${OS_ID:-unknown}); install manually: https://pkg.cloudflare.com/index.html" >&2
		;;
	esac

	exit 0
fi

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
		safe_message=$(printf '%s' "$message" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g')
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
# Install the cloudflared package if missing
# ──────────────────────────────────────────────────────────────
if command -v cloudflared >/dev/null 2>&1; then
	write_status "running" "install" "cloudflared is already installed"
else
	write_status "running" "install" "Installing the cloudflared package"

	OS_ID=""

	if [ -f /etc/os-release ]; then
		# shellcheck source=/dev/null
		. /etc/os-release
		OS_ID="${ID:-}"
	fi

	case "$OS_ID" in
	raspbian | debian | ubuntu)
		if [ "$DRY_RUN" -eq 1 ]; then
			echo "[dry-run] curl -fsSL $KEYRING_URL | tee $KEYRING_PATH"
			echo "[dry-run] echo '$LIST_LINE' | tee $LIST_PATH"
			echo "[dry-run] apt-get update -qq"
			echo "[dry-run] apt-get install -y -qq --no-install-recommends cloudflared"
		else
			# Only the signed keyring and the apt source list are downloaded —
			# never a script. apt-get itself verifies every package against
			# this keyring before installing it.
			curl -fsSL "$KEYRING_URL" | tee "$KEYRING_PATH" >/dev/null || {
				write_status "failed" "install" "Failed to download the Cloudflare apt keyring"
				exit 1
			}
			echo "$LIST_LINE" | tee "$LIST_PATH" >/dev/null || {
				write_status "failed" "install" "Failed to write the Cloudflare apt source list"
				exit 1
			}
			apt-get update -qq || {
				write_status "failed" "install" "apt-get update failed"
				exit 1
			}
			apt-get install -y -qq --no-install-recommends cloudflared || {
				write_status "failed" "install" "apt-get install cloudflared failed"
				exit 1
			}
		fi
		;;
	*)
		if [ "$DRY_RUN" -eq 1 ]; then
			echo "[dry-run] unsupported OS (ID=${OS_ID:-unknown}) — a real run would stop here and report failed/install"
		else
			write_status "failed" "install" "cloudflared must be installed manually: https://pkg.cloudflare.com/index.html"
			exit 1
		fi
		;;
	esac
fi

# ──────────────────────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────────────────────
write_status "complete" "complete" "Cloudflare Tunnel setup completed"

trap - EXIT
exit 0
