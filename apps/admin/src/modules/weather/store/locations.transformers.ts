import { camelToSnake, snakeToCamel } from '../../../common';
import { WeatherValidationException } from '../weather.exceptions';

import {
	WeatherLocationSchema,
	WeatherLocationCreateReqSchema,
	WeatherLocationUpdateReqSchema,
} from './locations.store.schemas';
import type {
	IWeatherLocation,
	IWeatherLocationRes,
	IWeatherLocationsAddActionPayload,
	IWeatherLocationsEditActionPayload,
} from './locations.store.types';

export const transformLocationResponse = <T extends IWeatherLocation = IWeatherLocation>(
	response: IWeatherLocationRes,
	schema: typeof WeatherLocationSchema = WeatherLocationSchema,
): T => {
	const camelCaseResponse = snakeToCamel(response);

	const parsed = schema.safeParse({
		...camelCaseResponse,
		draft: false,
	});

	if (!parsed.success) {
		console.error('[WEATHER_MODULE] Failed to validate location data:', parsed.error.issues);

		throw new WeatherValidationException('Failed to validate location data');
	}

	return parsed.data as T;
};

export const transformLocationCreateRequest = (
	data: IWeatherLocationsAddActionPayload['data'],
	schema: typeof WeatherLocationCreateReqSchema = WeatherLocationCreateReqSchema,
) => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		console.error('[WEATHER_MODULE] Failed to validate location create request:', parsed.error.issues);

		throw new WeatherValidationException('Failed to validate location create request');
	}

	return parsed.data;
};

export const transformLocationUpdateRequest = (
	data: IWeatherLocationsEditActionPayload['data'],
	schema: typeof WeatherLocationUpdateReqSchema = WeatherLocationUpdateReqSchema,
) => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		console.error('[WEATHER_MODULE] Failed to validate location update request:', parsed.error.issues);

		throw new WeatherValidationException('Failed to validate location update request');
	}

	return parsed.data;
};
