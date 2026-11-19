import { isIP } from 'net';

import { PROTECT_RTSPS_DEFAULT_PORT, PROTECT_STREAM_ALIAS_PATTERN } from '../devices-unifi-protect.constants';
import { isValidProtectHost } from '../validators/protect-config.validators';

const MAX_URL_LENGTH = 2048;

// The alias rule has one source (PROTECT_STREAM_ALIAS_PATTERN); the anchors come off to embed it.
const ALIAS_SOURCE = PROTECT_STREAM_ALIAS_PATTERN.source.replace(/^\^|\$$/g, '');
// No control character, whitespace, `@`, `\`, `#`; exactly one path segment; an optional query that is dropped.

const RAW_STREAM_URL = new RegExp(
	`^rtsps://[^/?#@\\s\\\\\\u0000-\\u001f\\u007f]+/(${ALIAS_SOURCE})(?:\\?[^#\\s\\\\\\u0000-\\u001f\\u007f]*)?$`,
);

/**
 * SECRET in and out. Accepts only `rtsps://<host>[:port]/<alias>[?query]`, checked on the raw string (never on a
 * normalised path) without credentials or a fragment; the console's host and query are dropped so only the port and
 * the alias travel on. Returns null when invalid; never throws and never echoes the input.
 */
export function parseProtectStreamUrl(consoleUrl: unknown): { port: number; alias: string } | null {
	if (typeof consoleUrl !== 'string' || consoleUrl.length === 0 || consoleUrl.length > MAX_URL_LENGTH) {
		return null;
	}

	const match = RAW_STREAM_URL.exec(consoleUrl);

	if (!match) {
		return null;
	}

	let url: URL;

	try {
		url = new URL(consoleUrl);
	} catch {
		return null;
	}

	if (url.hostname === '') {
		return null;
	}

	const port = url.port === '' ? PROTECT_RTSPS_DEFAULT_PORT : Number(url.port);

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return null;
	}

	return { port, alias: match[1] };
}

/** SECRET. `rtsp://<host>:<port>/<alias>` (IPv6 bracketed); null for an invalid host, port or alias. */
export function buildBridgeStreamUrl(endpoint: { host: string; port: number }, alias: string): string | null {
	if (
		typeof endpoint?.host !== 'string' ||
		!isValidProtectHost(endpoint.host) ||
		endpoint.host.includes('%') ||
		!Number.isInteger(endpoint.port) ||
		endpoint.port < 1 ||
		endpoint.port > 65535 ||
		typeof alias !== 'string' ||
		!PROTECT_STREAM_ALIAS_PATTERN.test(alias)
	) {
		return null;
	}

	const host = isIP(endpoint.host) === 6 ? `[${endpoint.host}]` : endpoint.host;

	return `rtsp://${host}:${endpoint.port}/${alias}`;
}
