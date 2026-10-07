#!/usr/bin/env bash
# Exercise the published runtime, including its normal migration/start command.
set +x
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
	printf 'Usage: %s IMAGE EXPECTED_VERSION [PLATFORM]\n' "$0" >&2
	exit 2
fi

image=$1
expected_version=$2
platform=${3:-}
for command in docker curl jq openssl python3; do
	command -v "$command" >/dev/null || { printf 'Required command missing: %s\n' "$command" >&2; exit 2; }
done

smoke_dir=$(mktemp -d)
container_id=
export FB_TOKEN_SECRET
FB_TOKEN_SECRET=$(openssl rand -hex 32)

cleanup() {
	local result=$?
	trap - EXIT
	if [[ -n "$container_id" ]]; then
		if [[ $result -ne 0 ]]; then
			docker logs --tail 100 "$container_id" 2>&1 | sed "s/$FB_TOKEN_SECRET/[redacted]/g" >&2 || true
		fi
		docker rm --force --volumes "$container_id" >/dev/null 2>&1 || true
	fi
	rm -rf "$smoke_dir"
	exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker_args=(run --detach --publish 127.0.0.1::3000 --volume /data --env FB_TOKEN_SECRET)
if [[ -n "$platform" ]]; then
	docker_args+=(--platform "$platform")
fi
container_id=$(docker "${docker_args[@]}" "$image")
port=$(docker inspect "$container_id" | jq --raw-output '.[0].NetworkSettings.Ports["3000/tcp"][0].HostPort // empty')
if [[ -z "$port" ]]; then
	printf 'Runtime exited or did not publish its backend port.\n' >&2
	exit 1
fi
origin="http://127.0.0.1:$port"
deadline=$((SECONDS + 120))

while true; do
	if [[ $(docker inspect --format '{{.State.Running}}' "$container_id") != true ]]; then
		printf 'Runtime exited before becoming ready.\n' >&2
		exit 1
	fi
	remaining=$((deadline - SECONDS))
	if (( remaining <= 0 )); then
		printf 'Runtime did not become ready within 120 seconds.\n' >&2
		exit 1
	fi
	request_timeout=2
	(( remaining >= request_timeout )) || request_timeout=$remaining
	if curl --silent --fail --connect-timeout 1 --max-time "$request_timeout" \
		"$origin/api/v1/modules/system/system/health" > "$smoke_dir/health.json"; then
		health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id")
		if [[ "$health" == healthy ]]; then
			break
		fi
	fi
	remaining=$((deadline - SECONDS))
	if (( remaining > 0 )); then
		poll_delay=2
		(( remaining >= poll_delay )) || poll_delay=$remaining
		sleep "$poll_delay"
	fi
done

jq --exit-status --arg version "$expected_version" \
	'.data.status == "ok" and .data.version == $version' "$smoke_dir/health.json" >/dev/null
curl --silent --show-error --fail --connect-timeout 2 --max-time 5 \
	"$origin/api/v1/modules/system/system/onboarding" > "$smoke_dir/onboarding.json"
jq --exit-status '.data.has_owner == false and .data.onboarding_completed == false' \
	"$smoke_dir/onboarding.json" >/dev/null

curl --silent --show-error --fail --connect-timeout 2 --max-time 5 \
	"$origin/" > "$smoke_dir/index.html"
asset=$(python3 - "$smoke_dir/index.html" <<'PY'
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit

class AdminHtml(HTMLParser):
    asset = None
    has_html = False

    def handle_starttag(self, tag, attrs):
        self.has_html |= tag == 'html'
        attributes = dict(attrs)
        if tag == 'script' and self.asset is None:
            src = attributes.get('src', '')
            url = urlsplit(src)
            if not url.scheme and not url.netloc and url.path.startswith('/assets/') and url.path.endswith('.js'):
                self.asset = src

parser = AdminHtml()
with open(sys.argv[1], encoding='utf-8') as source:
    parser.feed(source.read())
if not parser.has_html or parser.asset is None:
    sys.exit('Admin HTML does not reference a local JavaScript asset.')
print(parser.asset)
PY
)
curl --silent --show-error --fail --connect-timeout 2 --max-time 5 \
	--dump-header "$smoke_dir/asset.headers" "$origin$asset" > "$smoke_dir/asset.js"
test -s "$smoke_dir/asset.js"
# An SPA fallback also returns 200; require an actual JavaScript content type.
grep -Eiq '^content-type:.*(javascript|ecmascript)' "$smoke_dir/asset.headers"
printf 'Runtime smoke passed: migrations, container health, health/version, fresh onboarding and admin asset.\n'
