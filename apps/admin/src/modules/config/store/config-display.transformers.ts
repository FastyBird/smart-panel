import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ConfigValidationException } from '../config.exceptions';

import { ConfigDisplaySchema, ConfigDisplayUpdateReqSchema } from './config-display.store.schemas';
import type { IConfigDisplay, IConfigDisplayEditActionPayload, IConfigDisplayRes, IConfigDisplayUpdateReq } from './config-display.store.types';

// Note: Display configuration is now managed via the DisplaysModule

export const transformConfigDisplayResponse = (response: IConfigDisplayRes): IConfigDisplay => {
	const parsed = ConfigDisplaySchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received display config data.');
	}

	return parsed.data;
};

export const transformConfigDisplayUpdateRequest = (config: IConfigDisplayEditActionPayload['data']): IConfigDisplayUpdateReq => {
	const parsedRequest = ConfigDisplayUpdateReqSchema.safeParse(camelToSnake(config));

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update display config request.');
	}

	return parsedRequest.data;
};
