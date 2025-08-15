import { validateSync } from 'class-validator';
import 'reflect-metadata';

import { toInstance } from '../../../common/utils/transform.utils';
import type { components } from '../../../openapi';

import { LocationWeatherModel } from './weather.model';

type LocationWeather = components['schemas']['WeatherModuleLocationWeather'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Weather module model and OpenAPI component synchronization', () => {
	const validateModelAgainstComponent = <T extends object, U extends object>(model: T, component: U) => {
		// Convert component keys from snake_case to camelCase
		const componentKeys = Object.keys(component).map((attribute) =>
			attribute.replaceAll(caseRegex, (g) => g[1].toUpperCase()),
		);

		// Check that all keys in the component (converted to camelCase) exist in the model
		componentKeys.forEach((key) => {
			expect(model).toHaveProperty(key);
		});

		// Convert model keys to snake_case and compare against the component keys
		const modelKeys = Object.keys(model).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));

		const originalModelKeys = Object.keys(component);
		modelKeys.forEach((key) => {
			expect(originalModelKeys).toContain(key);
		});
	};

	test('LocationWeatherModel matches LocationWeather', () => {
		const openApiModel: LocationWeather = {
			current: {
				temperature: 23.3,
				temperature_min: 23.3,
				temperature_max: 23.3,
				feels_like: 23.3,
				pressure: 1003,
				humidity: 42,
				weather: {
					code: 800,
					main: 'Cloudy',
					description: 'Weather cloudy',
					icon: '01d',
				},
				wind: {
					speed: 3.5,
					deg: 180,
					gust: 5.8,
				},
				clouds: 10,
				rain: null,
				snow: null,
				sunrise: new Date().toISOString(),
				sunset: new Date().toISOString(),
				day_time: new Date().toISOString(),
			},
			forecast: [
				{
					temperature: {
						morn: 23.3,
						day: 23.3,
						eve: 23.3,
						night: 23.3,
						min: 23.3,
						max: 23.3,
					},
					feels_like: {
						morn: 23.3,
						day: 23.3,
						eve: 23.3,
						night: 23.3,
					},
					pressure: 1003,
					humidity: 42,
					weather: {
						code: 800,
						main: 'Cloudy',
						description: 'Weather cloudy',
						icon: '01d',
					},
					wind: {
						speed: 3.5,
						deg: 180,
						gust: 5.8,
					},
					clouds: 10,
					rain: null,
					snow: null,
					sunrise: new Date().toISOString(),
					sunset: new Date().toISOString(),
					moonrise: new Date().toISOString(),
					moonset: new Date().toISOString(),
					day_time: new Date().toISOString(),
				},
			],
			location: {
				name: 'Prague',
				country: 'CZE',
			},
		};

		const modelInstance = toInstance(LocationWeatherModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(0);
	});
});
