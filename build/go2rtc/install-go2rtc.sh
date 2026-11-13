#!/bin/sh
# Installs the pinned, checksum-verified go2rtc release binary for Smart Panel camera streaming.
#
# Usage: install-go2rtc.sh [--skip] [--strict] [--arch <name>] [--dir <path>] [--help]
#
# Every failure is a warning and exit 0 (the Smart Panel installation must not depend on go2rtc), unless --strict
# is given. Exit codes: 0 installed, already installed, skipped or failed; 1 failed with --strict; 2 usage error.
# Opt out with --skip, FB_SKIP_GO2RTC=1 or the marker file /etc/smart-panel/go2rtc.skip (the privileged update
# helper clears the worker environment, so only the marker reaches updates).
# Test-only hooks: FB_GO2RTC_PIN_FILE (default <script dir>/pin.env), FB_GO2RTC_SKIP_FILE (default the marker).

set -eu
LC_ALL=C
export LC_ALL

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

	if [ -f "$DIR/go2rtc" ] && [ "$(sha256_of "$DIR/go2rtc")" = "$EXPECTED" ]; then
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
	TMP=$(mktemp -d "$DIR/.install.XXXXXX" 2>/dev/null) || fail "cannot create a temporary directory in $DIR"
	trap cleanup EXIT
	trap 'exit 129' HUP
	trap 'exit 130' INT
	trap 'exit 143' TERM

	URL=$DOWNLOAD_BASE/v$VERSION/$ASSET
	curl --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 60 --retry 2 --retry-delay 2 \
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

	mv -f "$TMP/go2rtc" "$DIR/go2rtc" || fail "cannot install $DIR/go2rtc"

	if [ -f "$SCRIPT_DIR/LICENSE" ]; then
		{
			cp "$SCRIPT_DIR/LICENSE" "$TMP/LICENSE" &&
				chmod 0644 "$TMP/LICENSE" &&
				mv -f "$TMP/LICENSE" "$DIR/LICENSE"
		} || fail "installed go2rtc but cannot install its LICENSE into $DIR"
	fi

	log "installed $VERSION ($ARCH) to $DIR"
}

main "$@"
