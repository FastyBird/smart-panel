import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import 'reflect-metadata';

import { components } from '../../../openapi';
import {
	LanguageType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationTypeType,
} from '../config.constants';

import {
	AppConfigModel,
	AudioConfigModel,
	DisplayConfigModel,
	LanguageConfigModel,
	WeatherConfigModel,
} from './config.model';

type Audio = components['schemas']['ConfigModuleAudio'];
type Display = components['schemas']['ConfigModuleDisplay'];
type Language = components['schemas']['ConfigModuleLanguage'];
type Weather = components['schemas']['ConfigModuleWeather'];
type App = components['schemas']['ConfigModuleApp'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Config module model and OpenAPI component synchronization', () => {
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

	test('AudioConfigModel matches ConfigAudio', () => {
		const openApiModel: Audio = {
			type: SectionType.AUDIO,
			speaker: true,
			speaker_volume: 50,
			microphone: false,
			microphone_volume: 30,
		};

		const modelInstance = plainToInstance(AudioConfigModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('DisplayConfigModel matches ConfigDisplay', () => {
		const openApiModel: Display = {
			type: SectionType.DISPLAY,
			dark_mode: false,
			brightness: 55,
			screen_lock_duration: 30,
			screen_saver: false,
		};

		const modelInstance = plainToInstance(DisplayConfigModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('LanguageConfigModel matches ConfigLanguage', () => {
		const openApiModel: Language = {
			type: SectionType.LANGUAGE,
			language: LanguageType.ENGLISH,
			timezone: 'Europe\\Prague',
			time_format: TimeFormatType.HOUR_24,
		};

		const modelInstance = plainToInstance(LanguageConfigModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('WeatherConfigModel matches ConfigWeather', () => {
		const openApiModel: Weather = {
			type: SectionType.WEATHER,
			location: null,
			location_type: WeatherLocationTypeType.CITY_NAME,
			unit: TemperatureUnitType.CELSIUS,
			open_weather_api_key: null,
		};

		const modelInstance = plainToInstance(WeatherConfigModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('AppConfigModel matches ConfigApp', () => {
		const openApiModel: App = {
			audio: {
				type: SectionType.AUDIO,
				speaker: true,
				speaker_volume: 50,
				microphone: false,
				microphone_volume: 30,
			},
			display: {
				type: SectionType.DISPLAY,
				dark_mode: false,
				brightness: 55,
				screen_lock_duration: 30,
				screen_saver: false,
			},
			language: {
				type: SectionType.LANGUAGE,
				language: LanguageType.ENGLISH,
				timezone: 'Europe\\Prague',
				time_format: TimeFormatType.HOUR_24,
			},
			weather: {
				type: SectionType.WEATHER,
				location: null,
				location_type: WeatherLocationTypeType.CITY_NAME,
				unit: TemperatureUnitType.CELSIUS,
				open_weather_api_key: null,
			},
			plugins: [],
		};

		const modelInstance = plainToInstance(AppConfigModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});
