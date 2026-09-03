/**
 * RFC 7230 `token`: the character set HTTP allows in a header field name. No spaces, no
 * colons, no control characters. Mirrors the backend's `webhook-headers-shape.validator.ts`.
 */
const HTTP_HEADER_TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * NUL, CR and LF are the bytes `fetch()` itself rejects in a header value (CR/LF also being
 * how a smuggled value could inject an extra header line). A raw control byte would already
 * make the JSON malformed and get caught by the `JSON.parse` below, but a validly *escaped*
 * one (NUL, `\r`, `\n`) parses just fine into a string carrying the real character, so it
 * has to be rejected here too. Mirrors the backend's `webhook-headers-shape.validator.ts`.
 */
const FORBIDDEN_HEADER_VALUE_PATTERN = /[\0\r\n]/;

/**
 * The `headers` secret travels through the admin as raw JSON text - the only shape a
 * `ConfigSecretInput` textarea can hold - and is parsed back into an object only at the
 * wire boundary, right before the update request is sent. See `store/config.store.schemas.ts`.
 * Every key must be a legal HTTP header field name and every value a string clear of the
 * bytes `fetch()` rejects in a header value.
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

	return Object.entries(parsed).every(
		([key, headerValue]) =>
			HTTP_HEADER_TOKEN_PATTERN.test(key) && typeof headerValue === 'string' && !FORBIDDEN_HEADER_VALUE_PATTERN.test(headerValue)
	);
};

export const parseHeadersJson = (value: string): Record<string, string> => JSON.parse(value) as Record<string, string>;
