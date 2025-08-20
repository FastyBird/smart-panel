import { describe, expect, it } from 'vitest';

import { ConfigModuleWeatherCityNameLocation_type, ConfigModuleWeatherType, ConfigModuleWeatherUnit } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigWeatherEditActionPayload, IConfigWeatherRes } from './config-weather.store.types';
import { transformConfigWeatherResponse, transformConfigWeatherUpdateRequest } from './config-weather.transformers';

const validConfigWeatherResponse: IConfigWeatherRes = {
	type: ConfigModuleWeatherType.weather,
	city_name: 'Prague,CZ',
	location_type: ConfigModuleWeatherCityNameLocation_type.city_name,
	unit: ConfigModuleWeatherUnit.celsius,
	open_weather_api_key: null,
} as IConfigWeatherRes;

const validConfigWeatherUpdatePayload: IConfigWeatherEditActionPayload['data'] = {
	cityName: 'Prague,CZ',
	locationType: ConfigModuleWeatherCityNameLocation_type.city_name,
	unit: ConfigModuleWeatherUnit.celsius,
	openWeatherApiKey: null,
};

describe('Config Weather Transformers', (): void => {
	describe('transformConfigWeatherResponse', (): void => {
		it('should transform a valid config weather response', (): void => {
			const result = transformConfigWeatherResponse(validConfigWeatherResponse);

			expect(result).toEqual({
				type: ConfigModuleWeatherType.weather,
				cityName: 'Prague,CZ',
				locationType: ConfigModuleWeatherCityNameLocation_type.city_name,
				unit: ConfigModuleWeatherUnit.celsius,
				openWeatherApiKey: null,
			});
		});

		it('should throw an error for an invalid config weather response', (): void => {
			expect(() =>
				transformConfigWeatherResponse({ ...(validConfigWeatherResponse as object), locationType: null } as unknown as IConfigWeatherRes)
			).toThrow(ConfigValidationException);
		});
	});

	describe('transformConfigWeatherUpdateRequest', (): void => {
		it('should transform a valid config weather update request', (): void => {
			const result = transformConfigWeatherUpdateRequest(validConfigWeatherUpdatePayload);

			expect(result).toEqual({
				type: ConfigModuleWeatherType.weather,
				city_name: 'Prague,CZ',
				location_type: ConfigModuleWeatherCityNameLocation_type.city_name,
				unit: ConfigModuleWeatherUnit.celsius,
				open_weather_api_key: null,
			});
		});

		it('should throw an error for an invalid config weather update request', (): void => {
			expect(() =>
				transformConfigWeatherUpdateRequest({
					...validConfigWeatherUpdatePayload,
					unit: 'kelvin',
				} as unknown as IConfigWeatherEditActionPayload['data'])
			).toThrow(ConfigValidationException);
		});
	});
});
