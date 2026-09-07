import { get } from 'lodash';
import type { ErrorResponse, MediaType, ResponseObjectMap } from 'openapi-typescript-helpers';

export const getErrorReason = <T extends Record<string | number, unknown>>(
	error: ErrorResponse<ResponseObjectMap<T>, MediaType>,
	message: string
): string => {
	const details = get(error, 'error.details', null);

	if (Array.isArray(details)) {
		const reasons = details
			.map((row) => ('reason' in row && typeof row['reason'] === 'string' ? row.reason : undefined))
			.filter((row): row is string => typeof row === 'string');

		return reasons.length > 0 ? reasons.join(', ') : message;
	} else if (details && typeof details === 'object' && 'reason' in details && typeof details['reason'] === 'string') {
		return details['reason'];
	}

	return message;
};

/**
 * Reads the application-specific reason code some 409/422 responses attach alongside their
 * `reason` (D13, RA-27, #996 - `error.details.code`, never the coarse class code at the top-level
 * `error.code`, which stays e.g. `'ConflictError'`/`'UnprocessableEntity'`). Mirrors
 * `getErrorReason()`'s exact null-safety - missing `details`, a non-object `details`, or a missing/
 * non-string `code` all fall through to `null` rather than throwing - but never falls back to a
 * caller-supplied message: an unrecognised/absent code is meaningful to a caller branching on it
 * (unlike a reason, which always needs some string to display), so this returns `string | null`
 * instead of a guaranteed string.
 */
export const getErrorCode = <T extends Record<string | number, unknown>>(error: ErrorResponse<ResponseObjectMap<T>, MediaType>): string | null => {
	const details = get(error, 'error.details', null);

	if (Array.isArray(details)) {
		const codes = details
			.map((row) => (row && typeof row === 'object' && 'code' in row && typeof row['code'] === 'string' ? row.code : undefined))
			.filter((row): row is string => typeof row === 'string');

		return codes.length > 0 ? codes[0] : null;
	} else if (details && typeof details === 'object' && 'code' in details && typeof details['code'] === 'string') {
		return details['code'];
	}

	return null;
};
