import { snakeToCamel } from '../../../common';
import { SystemValidationException } from '../system.exceptions';

import { type IThrottleStatus, type IThrottleStatusRes, ThrottleStatusSchema } from './throttle-status.store.types';

export function transformThrottleStatusResponse(response: IThrottleStatusRes): IThrottleStatus {
	const parsed = ThrottleStatusSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new SystemValidationException('Failed to validate received throttle status data.');
	}

	return parsed.data;
}
