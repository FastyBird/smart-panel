import { camelToSnake, snakeToCamel } from '../../../common';
import { ConfigModuleWeatherType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import {
	ConfigWeatherCityIdUpdateReqSchema,
	ConfigWeatherCityNameUpdateReqSchema,
	ConfigWeatherLatLonUpdateReqSchema,
	ConfigWeatherSchema,
	ConfigWeatherZipCodeUpdateReqSchema,
} from './config-weather.store.schemas';
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
	for (const schema of [
		ConfigWeatherLatLonUpdateReqSchema,
		ConfigWeatherCityNameUpdateReqSchema,
		ConfigWeatherCityIdUpdateReqSchema,
		ConfigWeatherZipCodeUpdateReqSchema,
	]) {
		const parsedRequest = schema.safeParse({ ...camelToSnake(config), type: ConfigModuleWeatherType.weather });

		if (parsedRequest.success) {
			return parsedRequest.data as unknown as IConfigWeatherUpdateReq;
		}
	}

	throw new ConfigValidationException('Failed to validate update weather config request.');
};
