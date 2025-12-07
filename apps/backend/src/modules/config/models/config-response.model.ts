import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import {
	AppConfigModel,
	AudioConfigModel,
	LanguageConfigModel,
	ModuleConfigModel,
	PluginConfigModel,
	SystemConfigModel,
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
	WeatherConfigModel,
	WeatherLatLonConfigModel,
	WeatherZipCodeConfigModel,
} from './config.model';

/**
 * Response wrapper for AppConfigModel
 */
@ApiSchema({ name: 'ConfigModuleResAppConfig' })
export class ConfigModuleResAppConfig extends BaseSuccessResponseModel<AppConfigModel> {
	@ApiProperty({
		description: 'Application configuration',
		type: () => AppConfigModel,
	})
	@Expose()
	declare data: AppConfigModel;
}

/**
 * Response wrapper for PluginConfigModel
 */
@ApiSchema({ name: 'ConfigModuleResPluginConfig' })
export class ConfigModuleResPluginConfig extends BaseSuccessResponseModel<PluginConfigModel> {
	@ApiProperty({
		description: 'Plugin configuration',
		type: () => PluginConfigModel,
	})
	@Expose()
	declare data: PluginConfigModel;
}

/**
 * Response wrapper for array of PluginConfigModel
 */
@ApiSchema({ name: 'ConfigModuleResPlugins' })
export class ConfigModuleResPlugins extends BaseSuccessResponseModel<PluginConfigModel[]> {
	@ApiProperty({
		description: 'List of plugin configurations',
		type: 'array',
		items: { $ref: getSchemaPath(PluginConfigModel) },
	})
	@Expose()
	declare data: PluginConfigModel[];
}

/**
 * Response wrapper for ModuleConfigModel
 */
@ApiSchema({ name: 'ConfigModuleResModuleConfig' })
export class ConfigModuleResModuleConfig extends BaseSuccessResponseModel<ModuleConfigModel> {
	@ApiProperty({
		description: 'Module configuration',
		type: () => ModuleConfigModel,
	})
	@Expose()
	declare data: ModuleConfigModel;
}

/**
 * Response wrapper for array of ModuleConfigModel
 */
@ApiSchema({ name: 'ConfigModuleResModules' })
export class ConfigModuleResModules extends BaseSuccessResponseModel<ModuleConfigModel[]> {
	@ApiProperty({
		description: 'List of module configurations',
		type: 'array',
		items: { $ref: getSchemaPath(ModuleConfigModel) },
	})
	@Expose()
	declare data: ModuleConfigModel[];
}

@ApiSchema({ name: 'ConfigModuleResAudio' })
export class ConfigModuleResAudio extends BaseSuccessResponseModel<AudioConfigModel> {
	@ApiProperty({
		description: 'Single configuration section payload',
		type: () => AudioConfigModel,
	})
	@Expose()
	declare data: AudioConfigModel;
}

@ApiSchema({ name: 'ConfigModuleResLanguage' })
export class ConfigModuleResLanguage extends BaseSuccessResponseModel<LanguageConfigModel> {
	@ApiProperty({
		description: 'Single configuration section payload',
		type: () => LanguageConfigModel,
	})
	@Expose()
	declare data: LanguageConfigModel;
}
@ApiSchema({ name: 'ConfigModuleResWeather' })
export class ConfigModuleResWeather extends BaseSuccessResponseModel<
	WeatherCityIdConfigModel | WeatherCityNameConfigModel | WeatherLatLonConfigModel | WeatherZipCodeConfigModel
> {
	@ApiProperty({
		description: 'Single configuration section payload',
		oneOf: [
			{ $ref: getSchemaPath(WeatherCityIdConfigModel) },
			{ $ref: getSchemaPath(WeatherCityNameConfigModel) },
			{ $ref: getSchemaPath(WeatherLatLonConfigModel) },
			{ $ref: getSchemaPath(WeatherZipCodeConfigModel) },
		],
		discriminator: {
			propertyName: 'location_type',
			mapping: {
				city_id: getSchemaPath(WeatherCityIdConfigModel),
				city_name: getSchemaPath(WeatherCityNameConfigModel),
				lat_lon: getSchemaPath(WeatherLatLonConfigModel),
				zip_code: getSchemaPath(WeatherZipCodeConfigModel),
			},
		},
	})
	@Expose()
	declare data:
		| WeatherCityIdConfigModel
		| WeatherCityNameConfigModel
		| WeatherLatLonConfigModel
		| WeatherZipCodeConfigModel;
}

@ApiSchema({ name: 'ConfigModuleResSystem' })
export class ConfigModuleResSystem extends BaseSuccessResponseModel<SystemConfigModel> {
	@ApiProperty({
		description: 'Single configuration section payload',
		type: () => SystemConfigModel,
	})
	@Expose()
	declare data: SystemConfigModel;
}

/**
 * Response wrapper for section config (union type)
 */
@ApiSchema({ name: 'ConfigModuleResSection' })
export class ConfigModuleResSection extends BaseSuccessResponseModel<
	| AudioConfigModel
	| LanguageConfigModel
	| WeatherCityIdConfigModel
	| WeatherCityNameConfigModel
	| WeatherLatLonConfigModel
	| WeatherZipCodeConfigModel
	| SystemConfigModel
> {
	@ApiProperty({
		description: 'Single configuration section payload',
		oneOf: [
			{ $ref: getSchemaPath(AudioConfigModel) },
			{ $ref: getSchemaPath(LanguageConfigModel) },
			{ $ref: getSchemaPath(WeatherConfigModel) },
			{ $ref: getSchemaPath(SystemConfigModel) },
		],
		discriminator: {
			propertyName: 'type',
			mapping: {
				audio: getSchemaPath(AudioConfigModel),
				language: getSchemaPath(LanguageConfigModel),
				weather: getSchemaPath(WeatherConfigModel),
				system: getSchemaPath(SystemConfigModel),
			},
		},
	})
	@Expose()
	declare data:
		| AudioConfigModel
		| LanguageConfigModel
		| WeatherCityIdConfigModel
		| WeatherCityNameConfigModel
		| WeatherLatLonConfigModel
		| WeatherZipCodeConfigModel
		| SystemConfigModel;
}
