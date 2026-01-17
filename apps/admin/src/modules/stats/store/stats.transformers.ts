import { logger, snakeToCamel } from '../../../common';
import { StatsValidationException } from '../stats.exceptions';

import { StatsSchema } from './stats.store.schemas';
import type { IStats, IStatsRes } from './stats.store.types';

/**
 * Checks if a module response is an error object from the backend.
 * When a stats provider throws an error, the backend returns { error: true, message: "..." }
 */
const isErrorResponse = (value: unknown): boolean => {
	return typeof value === 'object' && value !== null && 'error' in value && (value as { error: unknown }).error === true;
};

/**
 * Filters out error responses from stats modules.
 * The backend returns { error: true, message: "..." } when a stats provider fails,
 * which doesn't match the expected schema structure.
 */
const filterErrorModules = (data: Record<string, unknown>): Record<string, unknown> => {
	const filtered: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(data)) {
		if (!isErrorResponse(value)) {
			filtered[key] = value;
		}
	}

	return filtered;
};

export const transformStatsResponse = (response: IStatsRes): IStats => {
	const camelCased = snakeToCamel(response);
	const filtered = filterErrorModules(camelCased);
	const parsed = StatsSchema.safeParse(filtered);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new StatsValidationException('Failed to validate received stats data.');
	}

	return parsed.data;
};
