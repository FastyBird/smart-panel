import { logger, snakeToCamel } from '../../../common';
import { SystemValidationException } from '../system.exceptions';

import { SystemInfoSchema } from './system-info.store.schemas';
import type { ISystemInfo, ISystemInfoRes } from './system-info.store.types';

export const transformSystemInfoResponse = (response: ISystemInfoRes): ISystemInfo => {
	const parsed = SystemInfoSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new SystemValidationException('Failed to validate received system info data.');
	}

	return parsed.data;
};
