import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ConfigModuleDataDisplayType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import { ConfigDisplaySchema, ConfigDisplayUpdateReqSchema } from './config-display.store.schemas';
import type { IConfigDisplay, IConfigDisplayEditActionPayload, IConfigDisplayRes, IConfigDisplayUpdateReq } from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import type { IConfigSystemRes } from './config-system.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigDisplayResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes | IConfigSystemRes
): IConfigDisplay => {
	const parsed = ConfigDisplaySchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received display config data.');
	}

	return parsed.data;
};

export const transformConfigDisplayUpdateRequest = (config: IConfigDisplayEditActionPayload['data']): IConfigDisplayUpdateReq => {
	const parsedRequest = ConfigDisplayUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigModuleDataDisplayType.display });

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update display config request.');
	}

	return parsedRequest.data;
};
