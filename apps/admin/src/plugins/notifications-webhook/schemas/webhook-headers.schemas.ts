/**
 * The `headers` secret travels through the admin as raw JSON text - the only shape a
 * `ConfigSecretInput` textarea can hold - and is parsed back into an object only at the
 * wire boundary, right before the update request is sent. See `store/config.store.schemas.ts`.
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

	return Object.values(parsed).every((headerValue) => typeof headerValue === 'string');
};

export const parseHeadersJson = (value: string): Record<string, string> => JSON.parse(value) as Record<string, string>;
