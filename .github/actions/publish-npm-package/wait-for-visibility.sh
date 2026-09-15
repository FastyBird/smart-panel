#!/usr/bin/env bash

set -euo pipefail

PACKAGE_NAME=${1:?package name is required}
VERSION=${2:?package version is required}
REGISTRY_URL=${3:?registry URL is required}
MAX_ATTEMPTS=${MAX_ATTEMPTS:-90}
SLEEP_SECONDS=${SLEEP_SECONDS:-2}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
	if npm view "$PACKAGE_NAME@$VERSION" \
		--registry="$REGISTRY_URL" \
		--prefer-online \
		--fetch-retries=0 \
		--fetch-timeout=5000 \
		--cache=/tmp/npm-publish-visibility-cache > /dev/null 2>&1; then
		echo "✅ $PACKAGE_NAME@$VERSION is visible on $REGISTRY_URL"
		exit 0
	fi

	if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
		echo "Waiting for $PACKAGE_NAME@$VERSION to become visible (attempt $attempt/$MAX_ATTEMPTS)..."
		sleep "$SLEEP_SECONDS"
	fi
done

echo "::error::$PACKAGE_NAME@$VERSION was not visible on $REGISTRY_URL after $MAX_ATTEMPTS attempts."
exit 1
