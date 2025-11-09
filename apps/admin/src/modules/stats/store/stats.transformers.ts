import { logger, snakeToCamel } from '../../../common';
import { StatsValidationException } from '../stats.exceptions';

import { StatsSchema } from './stats.store.schemas';
import type { IStats, IStatsRes } from './stats.store.types';

export const transformStatsResponse = (response: IStatsRes): IStats => {
	const parsed = StatsSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new StatsValidationException('Failed to validate received stats data.');
	}

	return parsed.data;
};
