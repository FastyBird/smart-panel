import { logger, snakeToCamel } from '../../../common';
import { SystemValidationException } from '../system.exceptions';

import { ThrottleStatusSchema } from './throttle-status.store.schemas';
import type { IThrottleStatus, IThrottleStatusRes } from './throttle-status.store.types';

export const transformThrottleStatusResponse = (response: IThrottleStatusRes): IThrottleStatus => {
	const parsed = ThrottleStatusSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new SystemValidationException('Failed to validate received throttle status data.');
	}

	return parsed.data;
};
