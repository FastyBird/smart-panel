import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

import { Injectable } from '@nestjs/common';

/**
 * Normalizes and validates a remote-access URL (`internal_url`, `external_url`):
 * an absolute origin — scheme, host, optional port — and nothing else. Unlike
 * `IsMcpOAuthPublicBaseUrlConstraint`, both `http:` and `https:` are accepted
 * (the posture layer warns about HTTP separately) and no path prefix is
 * tolerated at all, not even a reverse-proxy path: Home Assistant's
 * `core_config.py` forbids a path on either URL because a wrong prefix can
 * change security behaviour, and this module follows the same rule.
 *
 * Returns the canonical origin string, or `null` when `value` is not a
 * valid absolute HTTP(S) origin. `value` need not already be canonical —
 * a trailing slash, upper-case scheme/host, or a redundant default port
 * are all normalized away, since those are cosmetic differences from the
 * same origin, not a different one.
 */
// `new URL()` canonicalizes `.`/`..` path segments per the WHATWG URL algorithm before
// `.pathname` is ever read (e.g. `/..` collapses to `/`), so a literal dot-segment in the raw
// input would otherwise slip past the `pathname !== '/'` check below undetected. Checked against
// the raw value, before parsing.
const RAW_DOT_SEGMENT_PATTERN = /\/\.\.?(?:[/?#]|$)/;

export function normalizeRemoteAccessUrl(value: string): string | null {
	if (RAW_DOT_SEGMENT_PATTERN.test(value)) {
		return null;
	}

	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (
		(url.protocol !== 'http:' && url.protocol !== 'https:') ||
		!url.hostname ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.pathname !== '/'
	) {
		return null;
	}

	return url.origin;
}

@ValidatorConstraint({ name: 'isRemoteAccessUrl', async: false })
@Injectable()
export class IsRemoteAccessUrlConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return typeof value === 'string' && normalizeRemoteAccessUrl(value) !== null;
	}

	defaultMessage(_args: ValidationArguments): string {
		return 'URL must be a normalized absolute HTTP or HTTPS origin without a path, credentials, query, or fragment.';
	}
}
