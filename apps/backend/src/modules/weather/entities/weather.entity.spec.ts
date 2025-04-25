import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import 'reflect-metadata';

import type { components } from '../../../openapi';

import { LocationWeatherEntity } from './weather.entity';

type LocationWeather = components['schemas']['WeatherModuleLocationWeather'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Weather module entity and OpenAPI Model Synchronization', () => {
	const validateEntityAgainstModel = <T extends object, U extends object>(entity: T, model: U) => {
		// Convert model keys from snake_case to camelCase
		const modelKeys = Object.keys(model).map((attribute) => attribute.replaceAll(caseRegex, (g) => g[1].toUpperCase()));

		// Check that all keys in the model (converted to camelCase) exist in the entity
		modelKeys.forEach((key) => {
			expect(entity).toHaveProperty(key);
		});

		// Convert entity keys to snake_case and compare against the model keys
		const entityKeys = Object.keys(entity).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));

		const originalModelKeys = Object.keys(model);
		entityKeys.forEach((key) => {
			expect(originalModelKeys).toContain(key);
		});
	};

	test('LocationWeatherEntity matches LocationWeather', () => {
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

		const entityInstance = plainToInstance(LocationWeatherEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(0);
	});
});
