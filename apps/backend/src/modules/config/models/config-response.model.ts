import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import {
	AppConfigModel,
	LanguageConfigModel,
	ModuleConfigModel,
	PluginConfigModel,
	SystemConfigModel,
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

@ApiSchema({ name: 'ConfigModuleResLanguage' })
export class ConfigModuleResLanguage extends BaseSuccessResponseModel<LanguageConfigModel> {
	@ApiProperty({
		description: 'Single configuration section payload',
		type: () => LanguageConfigModel,
	})
	@Expose()
	declare data: LanguageConfigModel;
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
export class ConfigModuleResSection extends BaseSuccessResponseModel<LanguageConfigModel | SystemConfigModel> {
	@ApiProperty({
		description: 'Single configuration section payload',
		oneOf: [{ $ref: getSchemaPath(LanguageConfigModel) }, { $ref: getSchemaPath(SystemConfigModel) }],
		discriminator: {
			propertyName: 'type',
			mapping: {
				language: getSchemaPath(LanguageConfigModel),
				system: getSchemaPath(SystemConfigModel),
			},
		},
	})
	@Expose()
	declare data: LanguageConfigModel | SystemConfigModel;
}
