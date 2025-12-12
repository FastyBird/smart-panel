import { logger, snakeToCamel } from '../../../common';
import { ConfigValidationException } from '../config.exceptions';

import { ConfigAppSchema } from './config-app.store.schemas';
import type { IConfigApp, IConfigAppRes } from './config-app.store.types';
// Language and weather types removed - these configs are now accessed via modules

export const transformConfigAppResponse = (response: IConfigAppRes): IConfigApp => {
	const parsed = ConfigAppSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received system config data.');
	}

	return parsed.data;
};
