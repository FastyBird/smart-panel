#!/bin/sh
# Installs the pinned, checksum-verified go2rtc release binary for Smart Panel camera streaming.
#
# Usage: install-go2rtc.sh [--skip] [--strict] [--arch <name>] [--dir <path>] [--help]
#
# Every failure is a warning and exit 0 (the Smart Panel installation must not depend on go2rtc), unless --strict
# is given. Exit codes: 0 installed, already installed, skipped or failed; 1 failed with --strict; 2 usage error.
# Opt out with --skip, FB_SKIP_GO2RTC=1 or the marker file /etc/smart-panel/go2rtc.skip (the privileged update
# helper clears the worker environment, so only the marker reaches updates).
# The install directory and every existing ancestor must be owned by root or the current user and not writable by
# group or others (a root run must not execute a binary that someone else could swap); otherwise nothing is installed.
# Test-only hooks: FB_GO2RTC_PIN_FILE (default <script dir>/pin.env), FB_GO2RTC_SKIP_FILE (default the marker).

set -eu
LC_ALL=C
export LC_ALL
# Callers differ (the privileged update helper runs with umask 027): the service user must be able to traverse every
# directory created here and read the binary, so create everything world-searchable whatever the caller's umask.
umask 022

DEFAULT_DIR=/usr/local/lib/smart-panel/go2rtc
DEFAULT_SKIP_FILE=/etc/smart-panel/go2rtc.skip
DOWNLOAD_BASE=https://github.com/AlexxIT/go2rtc/releases/download

SKIP=0
STRICT=0
ARCH_OPT=
DIR=$DEFAULT_DIR
TMP=

log() {
	printf 'go2rtc: %s\n' "$*"
}

warn() {
	printf 'go2rtc: warning: %s\n' "$*" >&2
}

finish_failed() {
	if [ "$STRICT" = 1 ]; then
		exit 1
	fi
	exit 0
}

fail() {
	warn "$*"
	finish_failed
}

usage() {
	cat <<USAGE
Usage: install-go2rtc.sh [--skip] [--strict] [--arch <name>] [--dir <path>] [--help]

  --skip         install nothing (also: FB_SKIP_GO2RTC=1 or the marker file $DEFAULT_SKIP_FILE)
  --strict       exit 1 instead of 0 when the installation fails
  --arch <name>  architecture to install: amd64, arm64 or arm (default: detected)
  --dir <path>   install directory (default: $DEFAULT_DIR)
  --help         show this help
USAGE
}

cleanup() {
	if [ -n "$TMP" ]; then
		rm -rf "$TMP"
	fi
}

# Prints the value of KEY from the pin file when it is well formed, without ever sourcing the file.
read_pin() {
	pin_key=$1
	case $pin_key in
	GO2RTC_VERSION) pin_pattern='^[0-9A-Za-z.]\{1,\}$' ;;
	*) pin_pattern='^[0-9a-f]\{64\}$' ;;
	esac
	pin_value=$(grep "^$pin_key=" "$PIN_FILE" 2>/dev/null | head -n 1 | sed "s/^$pin_key=//") || return 1
	if [ -z "$pin_value" ] || ! printf '%s\n' "$pin_value" | grep -q "$pin_pattern"; then
		return 1
	fi
	printf '%s\n' "$pin_value"
}

# Prints amd64, arm64 or arm; warns and returns 1 for an architecture go2rtc cannot be installed on.
detect_arch() {
	kernel_machine=
	if command -v uname >/dev/null 2>&1; then
		kernel_machine=$(uname -m 2>/dev/null || true)
	fi

	# Raspberry Pi OS armhf userlands also run on ARMv6 boards, which Node 24 does not support.
	if [ "$kernel_machine" = armv6l ]; then
		warn "unsupported architecture: ARMv6 (armv6l) is not supported, go2rtc not installed"
		return 1
	fi

	detected=$ARCH_OPT
	if [ -z "$detected" ] && command -v dpkg >/dev/null 2>&1; then
		detected=$(dpkg --print-architecture 2>/dev/null || true)
	fi
	if [ -z "$detected" ]; then
		detected=$kernel_machine
	fi

	case $detected in
	amd64 | x86_64) printf 'amd64\n' ;;
	arm64 | aarch64) printf 'arm64\n' ;;
	arm | armhf | armv7 | armv7l) printf 'arm\n' ;;
	*)
		warn "unsupported architecture: ${detected:-unknown}, go2rtc not installed"
		return 1
		;;
	esac
}

sha256_of() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$1" | awk '{print $1}'
	else
		shasum -a 256 "$1" | awk '{print $1}'
	fi
}

run_version() {
	if command -v timeout >/dev/null 2>&1; then
		timeout 10 "$1" --version 2>/dev/null
	else
		"$1" --version 2>/dev/null
	fi
}

# Prints the numeric gid of the local group named staff, or nothing when there is none.
staff_gid() {
	sg_line=
	if command -v getent >/dev/null 2>&1; then
		sg_line=$(getent group staff 2>/dev/null)
	elif [ -r /etc/group ]; then
		sg_line=$(grep '^staff:' /etc/group 2>/dev/null | head -n 1)
	fi
	sg_rest=${sg_line#*:}
	sg_rest=${sg_rest#*:}
	printf '%s' "${sg_rest%%:*}"
}

# Succeeds when the existing directory $1 (a physical path) is safe to trust while this script runs as root: owned
# by root or the current user, and not writable by group or others (a sticky world-writable /tmp is refused too),
# since anyone who can write the directory or one of its ancestors can swap the checksum-verified workspace.
check_trusted_dir() {
	td_path=$1
	td_listing=$(ls -ldn "$td_path" 2>/dev/null) || {
		warn "cannot inspect $td_path; refusing to install under it"
		return 1
	}
	read -r td_mode _ td_uid td_gid _ <<LISTING
$td_listing
LISTING
	case $td_mode in
	d*) ;;
	*)
		warn "$td_path is not a directory; refusing to install under it"
		return 1
		;;
	esac
	if [ "$td_uid" != 0 ] && [ "$td_uid" != "$CURRENT_UID" ]; then
		warn "$td_path is owned by uid $td_uid, not root or the current user; refusing to install under it"
		return 1
	fi
	case $td_mode in
	????????w*)
		warn "$td_path is writable by other users; refusing to install under it"
		return 1
		;;
	?????w*)
		# Debian and Ubuntu ship /usr/local and /usr/local/lib as root:staff 2775 (staff is the local-administrator
		# group); every default install passes through them, so those two root-owned paths stay trusted, but only
		# while their group is root or staff: a member of any other group could swap the workspace.
		if [ "$td_uid" = 0 ] && { [ "$td_path" = /usr/local ] || [ "$td_path" = /usr/local/lib ]; }; then
			if [ "$td_gid" = 0 ] || { [ -n "$(staff_gid)" ] && [ "$td_gid" = "$(staff_gid)" ]; }; then
				return 0
			fi
		fi
		warn "$td_path is writable by its group; refusing to install under it"
		return 1
		;;
	esac
}

# Checks $DIR (when it exists) and every existing ancestor up to / with check_trusted_dir, before anything is created,
# then rewrites DIR to the physical path that was checked (the deepest existing ancestor, symlinks resolved, followed
# by the components that do not exist yet) so no later command can follow a symlink that is retargeted after the check.
check_install_path() {
	case /$DIR/ in
	*/../*)
		warn "$DIR contains a .. component; refusing to install into it"
		return 1
		;;
	esac
	chain_path=$DIR
	case $chain_path in
	/*) ;;
	*) chain_path=$PWD/$chain_path ;;
	esac
	chain_rest=
	while [ ! -e "$chain_path" ] && [ ! -L "$chain_path" ]; do
		chain_name=$(basename "$chain_path")
		case $chain_name in
		. | /) ;;
		*) chain_rest=/$chain_name$chain_rest ;;
		esac
		chain_path=$(dirname "$chain_path")
	done
	chain_path=$(cd -P "$chain_path" 2>/dev/null && pwd -P) || {
		warn "$DIR or one of its parents is not a directory; refusing to install into it"
		return 1
	}
	physical_dir=${chain_path%/}$chain_rest
	while :; do
		check_trusted_dir "$chain_path" || return 1
		if [ "$chain_path" = / ]; then
			break
		fi
		chain_path=$(dirname "$chain_path")
	done
	DIR=$physical_dir
}

# Creates this run's workspace in $DIR and records the owning pid so another run's sweep leaves it alone.
make_workspace() {
	trap cleanup EXIT
	trap 'exit 129' HUP
	trap 'exit 130' INT
	trap 'exit 143' TERM
	TMP=$(mktemp -d "$DIR/.install.XXXXXX" 2>/dev/null) || fail "cannot create a temporary directory in $DIR"
	printf '%s\n' "$$" >"$TMP/.owner" || fail "cannot write the workspace owner file in $TMP"
}

# Removes workspaces abandoned by a killed run (SIGKILL on a timeout): owner pid gone, or no readable owner and
# older than an hour. A workspace whose owner is still running belongs to another installer and is never touched.
sweep_workspaces() {
	for stale in "$DIR"/.install.*; do
		if [ ! -d "$stale" ] || [ -L "$stale" ]; then
			continue
		fi
		owner=
		if [ -f "$stale/.owner" ] && [ ! -L "$stale/.owner" ]; then
			owner=$(head -n 1 "$stale/.owner" 2>/dev/null || true)
		fi
		case $owner in
		'' | *[!0-9]*)
			if [ -n "$(find "$stale" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then
				rm -rf "$stale"
			fi
			;;
		*)
			if ! kill -0 "$owner" 2>/dev/null; then
				rm -rf "$stale"
			fi
			;;
		esac
	done
}

# Installs the licence text next to the binary unless an identical regular file is already there.
install_license() {
	if [ ! -f "$SCRIPT_DIR/LICENSE" ]; then
		return 0
	fi
	if [ -L "$DIR/LICENSE" ]; then
		rm -f "$DIR/LICENSE"
	fi
	if [ -f "$DIR/LICENSE" ] && [ "$(sha256_of "$DIR/LICENSE")" = "$(sha256_of "$SCRIPT_DIR/LICENSE")" ]; then
		chmod 0644 "$DIR/LICENSE" || fail "cannot set permissions on $DIR/LICENSE"
		return 0
	fi
	if [ -z "$TMP" ]; then
		make_workspace
	fi
	{
		cp "$SCRIPT_DIR/LICENSE" "$TMP/LICENSE" &&
			chmod 0644 "$TMP/LICENSE" &&
			mv -f "$TMP/LICENSE" "$DIR/LICENSE"
	} || fail "installed go2rtc but cannot install its LICENSE into $DIR"
}

main() {
	while [ $# -gt 0 ]; do
		case $1 in
		--skip) SKIP=1 ;;
		--strict) STRICT=1 ;;
		--arch | --dir)
			if [ $# -lt 2 ]; then
				printf 'go2rtc: option %s requires a value\n' "$1" >&2
				usage >&2
				exit 2
			fi
			if [ "$1" = --arch ]; then
				ARCH_OPT=$2
			else
				DIR=$2
			fi
			shift
			;;
		--help)
			usage
			exit 0
			;;
		*)
			printf 'go2rtc: unknown option: %s\n' "$1" >&2
			usage >&2
			exit 2
			;;
		esac
		shift
	done

	SKIP_FILE=${FB_GO2RTC_SKIP_FILE:-$DEFAULT_SKIP_FILE}
	if [ "$SKIP" = 1 ] || [ "${FB_SKIP_GO2RTC:-}" = 1 ] || [ -e "$SKIP_FILE" ]; then
		log "skipped (opted out)"
		exit 0
	fi

	ARCH=$(detect_arch) || finish_failed

	SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
	PIN_FILE=${FB_GO2RTC_PIN_FILE:-$SCRIPT_DIR/pin.env}
	VERSION=$(read_pin GO2RTC_VERSION) || fail "invalid pin file $PIN_FILE: GO2RTC_VERSION is missing or malformed"
	for key in GO2RTC_SHA256_LINUX_AMD64 GO2RTC_SHA256_LINUX_ARM64 GO2RTC_SHA256_LINUX_ARM; do
		read_pin "$key" >/dev/null || fail "invalid pin file $PIN_FILE: $key is missing or malformed"
	done
	case $ARCH in
	amd64) EXPECTED=$(read_pin GO2RTC_SHA256_LINUX_AMD64) ;;
	arm64) EXPECTED=$(read_pin GO2RTC_SHA256_LINUX_ARM64) ;;
	*) EXPECTED=$(read_pin GO2RTC_SHA256_LINUX_ARM) ;;
	esac
	ASSET=go2rtc_linux_$ARCH

	if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
		fail "sha256sum or shasum is required to verify the download"
	fi

	# The installer usually runs as root: never write through a symlinked or foreign-owned install directory.
	if [ -L "$DIR" ]; then
		fail "$DIR is a symbolic link; refusing to install into it"
	fi
	# test -O is not POSIX but dash, busybox ash, bash and the macOS sh all support it.
	# shellcheck disable=SC3067
	if [ -e "$DIR" ] && [ ! -O "$DIR" ]; then
		fail "$DIR is not owned by the current user; refusing to install into it"
	fi
	CURRENT_UID=$(id -u)
	check_install_path || finish_failed
	for target in "$DIR/go2rtc" "$DIR/LICENSE"; do
		if [ -d "$target" ] && [ ! -L "$target" ]; then
			fail "$target is a directory; refusing to install over it"
		fi
	done
	if [ -d "$DIR" ]; then
		sweep_workspaces
	fi

	if [ -f "$DIR/go2rtc" ] && [ ! -L "$DIR/go2rtc" ] && [ "$(sha256_of "$DIR/go2rtc")" = "$EXPECTED" ]; then
		chmod 0755 "$DIR/go2rtc" || fail "cannot set permissions on $DIR/go2rtc"
		install_license
		log "already installed $VERSION ($ARCH) in $DIR"
		exit 0
	fi

	if ! command -v curl >/dev/null 2>&1; then
		fail "curl is required to download go2rtc"
	fi

	CREATED_DIR=0
	if [ ! -d "$DIR" ]; then
		CREATED_DIR=1
	fi
	mkdir -p "$DIR" 2>/dev/null || fail "cannot create $DIR"
	if [ "$CREATED_DIR" = 1 ]; then
		chmod 0755 "$DIR" || fail "cannot set permissions on $DIR"
	fi
	make_workspace

	URL=$DOWNLOAD_BASE/v$VERSION/$ASSET
	curl --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 300 --retry 2 --retry-delay 2 \
		-fsSL -o "$TMP/go2rtc" "$URL" || fail "download failed: $URL"

	ACTUAL=$(sha256_of "$TMP/go2rtc")
	if [ "$ACTUAL" != "$EXPECTED" ]; then
		fail "checksum mismatch for $ASSET: expected $(printf '%.8s' "$EXPECTED")..., got $(printf '%.8s' "$ACTUAL")..."
	fi

	chmod 0755 "$TMP/go2rtc" || fail "cannot set permissions on the downloaded binary"
	REPORTED=$(run_version "$TMP/go2rtc" | head -n 1) || REPORTED=
	case $REPORTED in
	"go2rtc version $VERSION" | "go2rtc version $VERSION "*) ;;
	*) fail "downloaded binary does not run on this system (--version gave: ${REPORTED:-no output})" ;;
	esac

	# mv would move into a symlink that points at a directory and a root-owned write must not follow one.
	if [ -L "$DIR/go2rtc" ]; then
		rm -f "$DIR/go2rtc"
	fi
	mv -f "$TMP/go2rtc" "$DIR/go2rtc" || fail "cannot install $DIR/go2rtc"

	install_license

	log "installed $VERSION ($ARCH) to $DIR"
}

main "$@"
