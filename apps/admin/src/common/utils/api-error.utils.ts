import { get } from 'lodash';
import type { ErrorResponse, MediaType, ResponseObjectMap } from 'openapi-typescript-helpers';

export const getErrorReason = <T extends Record<string | number, unknown>>(
	error: ErrorResponse<ResponseObjectMap<T>, MediaType>,
	message: string
): string => {
	const details = get(error, 'error.details', null);

	if (Array.isArray(details)) {
		return details
			.map((row) => ('reason' in row && typeof row['reason'] === 'string' ? row.reason : undefined))
			.filter((row) => typeof row === 'undefined')
			.join(', ');
	} else if (details && typeof details === 'object' && 'reason' in details && typeof details['reason'] === 'string') {
		return details['reason'];
	}

	return message;
};
