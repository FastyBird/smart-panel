import { validateSync } from 'class-validator';
import 'reflect-metadata';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	LanguageType,
	LogLevelType,
	SectionType,
	TemperatureUnitType,
	TimeFormatType,
	WeatherLocationType,
} from '../config.constants';

import {
	AppConfigModel,
	AudioConfigModel,
	DisplayConfigModel,
	LanguageConfigModel,
	SystemConfigModel,
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
	WeatherLatLonConfigModel,
	WeatherZipCodeConfigModel,
} from './config.model';

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
		const openApiModel = {
			type: SectionType.AUDIO,
			speaker: true,
			speaker_volume: 50,
			microphone: false,
			microphone_volume: 30,
		};

		const modelInstance = toInstance(AudioConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('DisplayConfigModel matches ConfigDisplay', () => {
		const openApiModel = {
			type: SectionType.DISPLAY,
			dark_mode: false,
			brightness: 55,
			screen_lock_duration: 30,
			screen_saver: false,
		};

		const modelInstance = toInstance(DisplayConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('LanguageConfigModel matches ConfigLanguage', () => {
		const openApiModel = {
			type: SectionType.LANGUAGE,
			language: LanguageType.ENGLISH,
			timezone: 'Europe\\Prague',
			time_format: TimeFormatType.HOUR_24,
		};

		const modelInstance = toInstance(LanguageConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('WeatherLatLonConfigModel matches WeatherLatLon', () => {
		const openApiModel = {
			type: SectionType.WEATHER,
			location_type: WeatherLocationType.LAT_LON,
			latitude: null,
			longitude: null,
			unit: TemperatureUnitType.CELSIUS,
			open_weather_api_key: null,
		};

		const modelInstance = toInstance(WeatherLatLonConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('WeatherCityNameConfigModel matches WeatherCityName', () => {
		const openApiModel = {
			type: SectionType.WEATHER,
			location_type: WeatherLocationType.CITY_NAME,
			city_name: null,
			latitude: null,
			longitude: null,
			unit: TemperatureUnitType.CELSIUS,
			open_weather_api_key: null,
		};

		const modelInstance = toInstance(WeatherCityNameConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('WeatherCityIdConfigModel matches WeatherCityId', () => {
		const openApiModel = {
			type: SectionType.WEATHER,
			location_type: WeatherLocationType.CITY_ID,
			city_id: null,
			unit: TemperatureUnitType.CELSIUS,
			open_weather_api_key: null,
		};

		const modelInstance = toInstance(WeatherCityIdConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('WeatherZipCodeConfigModel matches WeatherZipCode', () => {
		const openApiModel = {
			type: SectionType.WEATHER,
			location_type: WeatherLocationType.ZIP_CODE,
			zip_code: null,
			latitude: null,
			longitude: null,
			unit: TemperatureUnitType.CELSIUS,
			open_weather_api_key: null,
		};

		const modelInstance = toInstance(WeatherZipCodeConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('SystemConfigModel matches ConfigSystem', () => {
		const openApiModel = {
			type: SectionType.SYSTEM,
			log_levels: [LogLevelType.ERROR],
		};

		const modelInstance = toInstance(SystemConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('AppConfigModel matches ConfigApp', () => {
		const openApiModel = {
			path: '/var/smart-panel/config.yml',
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
				city_name: null,
				latitude: null,
				longitude: null,
				location_type: WeatherLocationType.CITY_NAME,
				unit: TemperatureUnitType.CELSIUS,
				open_weather_api_key: null,
			},
			system: {
				type: SectionType.SYSTEM,
				log_levels: [LogLevelType.ERROR],
			},
			plugins: [],
		};

		const modelInstance = toInstance(AppConfigModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});
