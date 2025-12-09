import { logger, snakeToCamel } from '../../../common';
import { ConfigValidationException } from '../config.exceptions';

import { ConfigAppSchema } from './config-app.store.schemas';
import type { IConfigApp, IConfigAppRes } from './config-app.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigAppResponse = (response: IConfigLanguageRes | IConfigWeatherRes | IConfigAppRes): IConfigApp => {
	const parsed = ConfigAppSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received system config data.');
	}

	return parsed.data;
};
