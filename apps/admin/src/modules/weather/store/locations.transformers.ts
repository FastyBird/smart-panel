import type { ZodType } from 'zod';

import { snakeToCamel } from '../../../common';
import { WeatherValidationException } from '../weather.exceptions';

import {
	WeatherLocationSchema,
	WeatherLocationCreateReqSchema,
	WeatherLocationUpdateReqSchema,
} from './locations.store.schemas';
import type {
	IWeatherLocation,
	IWeatherLocationRes,
	IWeatherLocationCreateReq,
	IWeatherLocationUpdateReq,
} from './locations.store.types';

export const transformLocationResponse = <TLocation extends IWeatherLocation = IWeatherLocation>(
	response: IWeatherLocationRes,
	schema: ZodType<TLocation> = WeatherLocationSchema as unknown as ZodType<TLocation>
): TLocation => {
	const transformed = snakeToCamel<IWeatherLocationRes>(response);

	const parsed = schema.safeParse({
		...transformed,
		draft: false,
	});

	if (!parsed.success) {
		console.error('[WEATHER_MODULE] Failed to validate location data:', parsed.error.errors);

		throw new WeatherValidationException('Failed to validate location data');
	}

	return parsed.data;
};

export const transformLocationCreateRequest = <TRequest extends IWeatherLocationCreateReq = IWeatherLocationCreateReq>(
	data: TRequest,
	schema: ZodType<TRequest> = WeatherLocationCreateReqSchema as unknown as ZodType<TRequest>
): TRequest => {
	const parsed = schema.safeParse(data);

	if (!parsed.success) {
		console.error('[WEATHER_MODULE] Failed to validate location create request:', parsed.error.errors);

		throw new WeatherValidationException('Failed to validate location create request');
	}

	return parsed.data;
};

export const transformLocationUpdateRequest = <TRequest extends IWeatherLocationUpdateReq = IWeatherLocationUpdateReq>(
	data: TRequest,
	schema: ZodType<TRequest> = WeatherLocationUpdateReqSchema as unknown as ZodType<TRequest>
): TRequest => {
	const parsed = schema.safeParse(data);

	if (!parsed.success) {
		console.error('[WEATHER_MODULE] Failed to validate location update request:', parsed.error.errors);

		throw new WeatherValidationException('Failed to validate location update request');
	}

	return parsed.data;
};
