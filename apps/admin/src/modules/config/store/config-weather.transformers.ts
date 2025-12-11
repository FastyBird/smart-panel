import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ConfigModuleWeatherType } from '../../../openapi.constants';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigLanguageRes } from './config-language.store.types';
import type { IConfigSystemRes } from './config-system.store.types';
import {
	ConfigWeatherCityIdUpdateReqSchema,
	ConfigWeatherCityNameUpdateReqSchema,
	ConfigWeatherLatLonUpdateReqSchema,
	ConfigWeatherSchema,
	ConfigWeatherZipCodeUpdateReqSchema,
} from './config-weather.store.schemas';
import type { IConfigWeather, IConfigWeatherEditActionPayload, IConfigWeatherRes, IConfigWeatherUpdateReq } from './config-weather.store.types';

export const transformConfigWeatherResponse = (response: IConfigLanguageRes | IConfigWeatherRes | IConfigSystemRes): IConfigWeather => {
	const parsed = ConfigWeatherSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

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
