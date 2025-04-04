import { camelToSnake, snakeToCamel } from '../../../common';
import { ConfigWeatherType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import {
	ConfigWeatherSchema,
	ConfigWeatherUpdateReqSchema,
	type IConfigWeather,
	type IConfigWeatherEditActionPayload,
	type IConfigWeatherRes,
	type IConfigWeatherUpdateReq,
} from './config-weather.store.types';

export const transformConfigWeatherResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes
): IConfigWeather => {
	const parsed = ConfigWeatherSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new ConfigValidationException('Failed to validate received weather config data.');
	}

	return parsed.data;
};

export const transformConfigWeatherUpdateRequest = (config: IConfigWeatherEditActionPayload['data']): IConfigWeatherUpdateReq => {
	const parsedRequest = ConfigWeatherUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigWeatherType.weather });

	if (!parsedRequest.success) {
		throw new ConfigValidationException('Failed to validate update weather config request.');
	}

	return parsedRequest.data;
};
