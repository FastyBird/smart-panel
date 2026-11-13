import * as path from 'path';

const MAX_BINARY_PATH_LENGTH = 4096;
const MAX_EXTERNAL_URL_LENGTH = 2048;
const BINARY_BASENAME = /^go2rtc[A-Za-z0-9._-]*$/;

export function isValidGo2rtcBinaryPath(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_BINARY_PATH_LENGTH) {
		return false;
	}

	if (value.includes('\0') || value.endsWith('/') || !path.isAbsolute(value)) {
		return false;
	}

	return BINARY_BASENAME.test(path.basename(value));
}

export function isValidGo2rtcExternalUrl(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_EXTERNAL_URL_LENGTH) {
		return false;
	}

	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return false;
	}

	return (
		(url.protocol === 'http:' || url.protocol === 'https:') &&
		url.hostname.length > 0 &&
		url.username === '' &&
		url.password === '' &&
		url.search === '' &&
		url.hash === '' &&
		!value.includes('?') &&
		!value.includes('#')
	);
}

export function normalizeGo2rtcExternalUrl(value: string): string {
	return value.replace(/\/+$/, '');
}
