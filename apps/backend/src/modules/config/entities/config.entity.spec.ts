import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import 'reflect-metadata';

import { components } from '../../../openapi';
import { LanguageEnum, TemperatureUnitEnum, TimeFormatEnum, WeatherLocationTypeEnum } from '../config.constants';

import {
	AppConfigEntity,
	AudioConfigEntity,
	DisplayConfigEntity,
	LanguageConfigEntity,
	WeatherConfigEntity,
} from './config.entity';

type Audio = components['schemas']['ConfigAudio'];
type Display = components['schemas']['ConfigDisplay'];
type Language = components['schemas']['ConfigLanguage'];
type Weather = components['schemas']['ConfigWeather'];
type App = components['schemas']['ConfigApp'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Config module entity and OpenAPI Model Synchronization', () => {
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

	test('AudioConfigEntity matches ConfigAudio', () => {
		const openApiModel: Audio = {
			speaker: true,
			speaker_volume: 50,
			microphone: false,
			microphone_volume: 30,
		};

		const entityInstance = plainToInstance(AudioConfigEntity, openApiModel, {
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

	test('DisplayConfigEntity matches ConfigDisplay', () => {
		const openApiModel: Display = {
			dark_mode: false,
			brightness: 55,
			screen_lock_duration: 30,
			screen_saver: false,
		};

		const entityInstance = plainToInstance(DisplayConfigEntity, openApiModel, {
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

	test('LanguageConfigEntity matches ConfigLanguage', () => {
		const openApiModel: Language = {
			language: LanguageEnum.ENGLISH,
			timezone: 'Europe\\Prague',
			time_format: TimeFormatEnum.HOUR_24,
		};

		const entityInstance = plainToInstance(LanguageConfigEntity, openApiModel, {
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

	test('WeatherConfigEntity matches ConfigWeather', () => {
		const openApiModel: Weather = {
			location: null,
			location_type: WeatherLocationTypeEnum.CITY_NAME,
			unit: TemperatureUnitEnum.CELSIUS,
			open_weather_api_key: null,
		};

		const entityInstance = plainToInstance(WeatherConfigEntity, openApiModel, {
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

	test('AppConfigEntity matches ConfigApp', () => {
		const openApiModel: App = {
			audio: {
				speaker: true,
				speaker_volume: 50,
				microphone: false,
				microphone_volume: 30,
			},
			display: {
				dark_mode: false,
				brightness: 55,
				screen_lock_duration: 30,
				screen_saver: false,
			},
			language: {
				language: LanguageEnum.ENGLISH,
				timezone: 'Europe\\Prague',
				time_format: TimeFormatEnum.HOUR_24,
			},
			weather: {
				location: null,
				location_type: WeatherLocationTypeEnum.CITY_NAME,
				unit: TemperatureUnitEnum.CELSIUS,
				open_weather_api_key: null,
			},
		};

		const entityInstance = plainToInstance(AppConfigEntity, openApiModel, {
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
