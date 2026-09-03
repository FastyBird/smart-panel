/**
 * RFC 7230 `token`: the character set HTTP allows in a header field name. No spaces, no
 * colons, no control characters. Mirrors the backend's `webhook-headers-shape.validator.ts`.
 */
const HTTP_HEADER_TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * The `headers` secret travels through the admin as raw JSON text - the only shape a
 * `ConfigSecretInput` textarea can hold - and is parsed back into an object only at the
 * wire boundary, right before the update request is sent. See `store/config.store.schemas.ts`.
 * Every key must be a legal HTTP header field name and every value a string.
 */
export const isValidHeadersJson = (value: string): boolean => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(value);
	} catch {
		return false;
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return false;
	}

	return Object.entries(parsed).every(([key, headerValue]) => HTTP_HEADER_TOKEN_PATTERN.test(key) && typeof headerValue === 'string');
};

export const parseHeadersJson = (value: string): Record<string, string> => JSON.parse(value) as Record<string, string>;
