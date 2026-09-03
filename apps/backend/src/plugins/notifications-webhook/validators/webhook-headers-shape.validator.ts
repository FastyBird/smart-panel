import { ValidateBy, ValidationOptions } from 'class-validator';

/**
 * RFC 7230 `token`: the character set HTTP allows in a header field name. No spaces, no
 * colons, no control characters.
 */
const HTTP_HEADER_TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * `headers` is typed `Record<string, string>` on the wire, but a bare `@IsObject()` only
 * checks the outer shape - `{ "X-Retry": 1 }` passes it despite the numeric value, and a
 * key such as `"bad header"` (a space is not a legal header token) would reach `fetch()`
 * as a raw header name. Validates every key is a legal HTTP header field name and every
 * value is a string.
 */
export const isValidHeaderRecord = (value: unknown): value is Record<string, string> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	return Object.entries(value as Record<string, unknown>).every(
		([key, headerValue]) => HTTP_HEADER_TOKEN_PATTERN.test(key) && typeof headerValue === 'string',
	);
};

export const IsValidHeaderRecord = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isValidHeaderRecord',
			validator: {
				validate: isValidHeaderRecord,
				defaultMessage: () =>
					'Headers must be an object whose keys are valid HTTP header names and whose values are strings',
			},
		},
		validationOptions,
	);
