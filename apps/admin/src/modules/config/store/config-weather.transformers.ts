import { camelToSnake, snakeToCamel } from '../../../common';
import { ConfigModuleWeatherType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import { ConfigWeatherSchema, ConfigWeatherUpdateReqSchema } from './config-weather.store.schemas';
import type { IConfigWeather, IConfigWeatherEditActionPayload, IConfigWeatherRes, IConfigWeatherUpdateReq } from './config-weather.store.types';

export const transformConfigWeatherResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes
): IConfigWeather => {
	const parsed = ConfigWeatherSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received weather config data.');
	}

	return parsed.data;
};

export const transformConfigWeatherUpdateRequest = (config: IConfigWeatherEditActionPayload['data']): IConfigWeatherUpdateReq => {
	const parsedRequest = ConfigWeatherUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigModuleWeatherType.weather });

	if (!parsedRequest.success) {
		console.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update weather config request.');
	}

	return parsedRequest.data;
};
