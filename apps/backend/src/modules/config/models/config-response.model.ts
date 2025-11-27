import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import {
	AppConfigModel,
	AudioConfigModel,
	DisplayConfigModel,
	LanguageConfigModel,
	PluginConfigModel,
	SystemConfigModel,
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
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
 * Response wrapper for section config (union type)
 */
@ApiSchema({ name: 'ConfigModuleResSection' })
export class ConfigModuleResSection extends BaseSuccessResponseModel<
	| AudioConfigModel
	| DisplayConfigModel
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
			{ $ref: getSchemaPath(DisplayConfigModel) },
			{ $ref: getSchemaPath(LanguageConfigModel) },
			{ $ref: getSchemaPath(WeatherCityIdConfigModel) },
			{ $ref: getSchemaPath(WeatherCityNameConfigModel) },
			{ $ref: getSchemaPath(WeatherLatLonConfigModel) },
			{ $ref: getSchemaPath(WeatherZipCodeConfigModel) },
			{ $ref: getSchemaPath(SystemConfigModel) },
		],
		discriminator: {
			propertyName: 'type',
		},
	})
	@Expose()
	declare data:
		| AudioConfigModel
		| DisplayConfigModel
		| LanguageConfigModel
		| WeatherCityIdConfigModel
		| WeatherCityNameConfigModel
		| WeatherLatLonConfigModel
		| WeatherZipCodeConfigModel
		| SystemConfigModel;
}
