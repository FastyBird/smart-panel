import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';

import {
	AppConfigModel,
	AudioConfigModel,
	BaseConfigModel,
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
@ApiSchema({ name: 'ConfigModuleResApp' })
export class AppResponseModel extends BaseSuccessResponseModel<AppConfigModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => AppConfigModel,
	})
	@Expose()
	@Type(() => AppConfigModel)
	data: AppConfigModel;
}

/**
 * Response wrapper for PluginConfigModel
 */
@ApiSchema({ name: 'ConfigModuleResPlugin' })
export class PluginResponseModel extends BaseSuccessResponseModel<PluginConfigModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => PluginConfigModel,
	})
	@Expose()
	@Type(() => PluginConfigModel)
	data: PluginConfigModel;
}

/**
 * Response wrapper for array of PluginConfigModel
 */
@ApiSchema({ name: 'ConfigModuleResPlugins' })
export class PluginsResponseModel extends BaseSuccessResponseModel<PluginConfigModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(PluginConfigModel) },
	})
	@Expose()
	@Type(() => PluginConfigModel)
	data: PluginConfigModel[];
}

/**
 * Response wrapper for section config (union type)
 */
@ApiSchema({ name: 'ConfigModuleResSection' })
export class SectionResponseModel extends BaseSuccessResponseModel<
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
		description: 'The actual data payload returned by the API',
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
	@Type(() => BaseConfigModel, {
		discriminator: {
			property: 'type',
			subTypes: [
				{ value: AudioConfigModel, name: 'audio' },
				{ value: DisplayConfigModel, name: 'display' },
				{ value: LanguageConfigModel, name: 'language' },
				{ value: WeatherCityIdConfigModel, name: 'weather' },
				{ value: WeatherCityNameConfigModel, name: 'weather' },
				{ value: WeatherLatLonConfigModel, name: 'weather' },
				{ value: WeatherZipCodeConfigModel, name: 'weather' },
				{ value: SystemConfigModel, name: 'system' },
			],
		},
		keepDiscriminatorProperty: true,
	})
	data:
		| AudioConfigModel
		| DisplayConfigModel
		| LanguageConfigModel
		| WeatherCityIdConfigModel
		| WeatherCityNameConfigModel
		| WeatherLatLonConfigModel
		| WeatherZipCodeConfigModel
		| SystemConfigModel;
}
