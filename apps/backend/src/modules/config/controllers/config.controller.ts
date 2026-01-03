import { validate } from 'class-validator';

import { BadRequestException, Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CONFIG_MODULE_API_TAG_NAME, CONFIG_MODULE_NAME } from '../config.constants';
import { ConfigException } from '../config.exceptions';
import {
	ReqUpdateModuleDto,
	ReqUpdatePluginDto,
	ReqUpdateSectionDto,
	UpdateModuleConfigDto,
	UpdatePluginConfigDto,
} from '../dto/config.dto';
import {
	ConfigModuleResAppConfig,
	ConfigModuleResModuleConfig,
	ConfigModuleResModules,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
} from '../models/config-response.model';
import { AppConfigModel, ModuleConfigModel, PluginConfigModel } from '../models/config.model';
import { ConfigService } from '../services/config.service';
import { ModuleTypeMapping, ModulesTypeMapperService } from '../services/modules-type-mapper.service';
import { PluginTypeMapping, PluginsTypeMapperService } from '../services/plugins-type-mapper.service';

@ApiTags(CONFIG_MODULE_API_TAG_NAME)
@Controller('config')
export class ConfigController {
	private readonly logger = createExtensionLogger(CONFIG_MODULE_NAME, 'ConfigController');

	constructor(
		private readonly service: ConfigService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	@Get()
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Get all configuration',
		description: 'Retrieve the complete application configuration',
		operationId: 'get-config-module-config',
	})
	@ApiSuccessResponse(ConfigModuleResAppConfig, 'Configuration retrieved successfully')
	@ApiBadRequestResponse('Invalid request')
	@ApiInternalServerErrorResponse('Internal server error')
	getAllConfig(): ConfigModuleResAppConfig {
		const config = this.service.getConfig();

		const response = new ConfigModuleResAppConfig();
		response.data = config;
		return response;
	}

	@Get(':section')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Get configuration section',
		description: 'Retrieve a specific configuration section',
		operationId: 'get-config-module-config-section',
	})
	@ApiParam({
		name: 'section',
		description: 'Configuration section identifier (deprecated - use /config/module/:module instead)',
		type: 'string',
		example: 'language',
	})
	@ApiSuccessResponse(ConfigModuleResSection, 'Section configuration retrieved successfully')
	@ApiBadRequestResponse('Invalid section identifier')
	@ApiNotFoundResponse('Configuration section not found')
	@ApiInternalServerErrorResponse('Internal server error')
	getConfigSection(@Param('section') section: keyof AppConfigModel): ConfigModuleResSection {
		// Section-based endpoints are deprecated - use module endpoints instead
		throw new BadRequestException([
			JSON.stringify({
				field: 'section',
				reason: `Requested configuration section: ${section as string} not found. Use /config/module/:module instead.`,
			}),
		]);
	}

	@Patch(':section')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update configuration section',
		description: 'Update a specific configuration section',
		operationId: 'update-config-module-config-section',
	})
	@ApiParam({
		name: 'section',
		description: 'Configuration section identifier (deprecated - use /config/module/:module instead)',
		type: 'string',
		example: 'language',
	})
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Configuration section data' })
	@ApiSuccessResponse(ConfigModuleResSection, 'Section configuration updated successfully')
	@ApiBadRequestResponse('Invalid section identifier or configuration data')
	@ApiNotFoundResponse('Configuration section not found')
	@ApiInternalServerErrorResponse('Internal server error')
	updateConfigSection(
		@Param('section') section: keyof AppConfigModel,
		@Body() _dto: ReqUpdateSectionDto,
	): ConfigModuleResSection {
		// Section-based endpoints are deprecated - use module endpoints instead
		throw new BadRequestException([
			JSON.stringify({
				field: 'section',
				reason: `Requested configuration section: ${section as string} not found. Use /config/module/:module instead.`,
			}),
		]);
	}

	private createSectionResponse(config: ConfigModuleResSection['data']): ConfigModuleResSection {
		const response = new ConfigModuleResSection();
		response.data = config;
		return response;
	}

	@Get('plugins')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Get all plugin configurations',
		description: 'Retrieve configuration for all registered plugins',
		operationId: 'get-config-module-config-plugins',
	})
	@ApiSuccessResponse(ConfigModuleResPlugins, 'Plugin configurations retrieved successfully')
	@ApiBadRequestResponse('Invalid request')
	@ApiNotFoundResponse('Plugin configurations not found')
	@ApiInternalServerErrorResponse('Internal server error')
	getPluginsConfig(): ConfigModuleResPlugins {
		const config: PluginConfigModel[] = this.service.getPluginsConfig();

		const response = new ConfigModuleResPlugins();
		response.data = config;
		return response;
	}

	@Get('plugin/:plugin')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Get plugin configuration',
		description: 'Retrieve configuration for a specific plugin',
		operationId: 'get-config-module-config-plugin',
	})
	@ApiParam({ name: 'plugin', description: 'Plugin identifier', type: 'string', example: 'devices-shelly' })
	@ApiSuccessResponse(ConfigModuleResPluginConfig, 'Plugin configuration retrieved successfully')
	@ApiBadRequestResponse('Invalid plugin identifier')
	@ApiNotFoundResponse('Plugin configuration not found')
	@ApiInternalServerErrorResponse('Internal server error')
	getPluginConfig(@Param('plugin') plugin: string): ConfigModuleResPluginConfig {
		const config: PluginConfigModel = this.service.getPluginConfig(plugin);

		const response = new ConfigModuleResPluginConfig();
		response.data = config;
		return response;
	}

	@Patch('plugin/:plugin')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update plugin configuration',
		description: 'Update configuration for a specific plugin',
		operationId: 'update-config-module-config-plugin',
	})
	@ApiParam({ name: 'plugin', description: 'Plugin identifier', type: 'string', example: 'devices-shelly' })
	@ApiBody({
		type: ReqUpdatePluginDto,
		description: 'Plugin configuration data',
	})
	@ApiSuccessResponse(ConfigModuleResPluginConfig, 'Plugin configuration updated successfully')
	@ApiBadRequestResponse('Invalid plugin configuration data or unsupported plugin type')
	@ApiNotFoundResponse('Plugin configuration not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async updatePluginConfig(
		@Param('plugin') plugin: string,
		@Body() pluginConfig: { data: object },
	): Promise<ConfigModuleResPluginConfig> {
		let mapping: PluginTypeMapping<PluginConfigModel, UpdatePluginConfigDto>;

		try {
			mapping = this.pluginsMapperService.getMapping<PluginConfigModel, UpdatePluginConfigDto>(plugin);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported plugin type for update: ${plugin} `, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof ConfigException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported plugin type: ${plugin}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = toInstance(mapping.configDto, pluginConfig.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for plugin modification error=${JSON.stringify(errors)} plugin=${plugin} `,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		this.service.setPluginConfig(plugin, dtoInstance);

		const config = this.service.getPluginConfig(plugin);

		const response = new ConfigModuleResPluginConfig();
		response.data = config;
		return response;
	}

	@Get('modules')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Get all module configurations',
		description: 'Retrieve configuration for all registered modules',
		operationId: 'get-config-module-config-modules',
	})
	@ApiSuccessResponse(ConfigModuleResModules, 'Module configurations retrieved successfully')
	@ApiBadRequestResponse('Invalid request')
	@ApiNotFoundResponse('Module configurations not found')
	@ApiInternalServerErrorResponse('Internal server error')
	getModulesConfig(): ConfigModuleResModules {
		const config: ModuleConfigModel[] = this.service.getModulesConfig();

		const response = new ConfigModuleResModules();
		response.data = config;
		return response;
	}

	@Get('module/:module')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Get module configuration',
		description: 'Retrieve configuration for a specific module',
		operationId: 'get-config-module-config-module',
	})
	@ApiParam({ name: 'module', description: 'Module identifier', type: 'string', example: 'devices-module' })
	@ApiSuccessResponse(ConfigModuleResModuleConfig, 'Module configuration retrieved successfully')
	@ApiBadRequestResponse('Invalid module identifier')
	@ApiNotFoundResponse('Module configuration not found')
	@ApiInternalServerErrorResponse('Internal server error')
	getModuleConfig(@Param('module') module: string): ConfigModuleResModuleConfig {
		const config: ModuleConfigModel = this.service.getModuleConfig(module);

		const response = new ConfigModuleResModuleConfig();
		response.data = config;
		return response;
	}

	@Patch('module/:module')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update module configuration',
		description: 'Update configuration for a specific module',
		operationId: 'update-config-module-config-module',
	})
	@ApiParam({ name: 'module', description: 'Module identifier', type: 'string', example: 'devices-module' })
	@ApiBody({
		type: ReqUpdateModuleDto,
		description: 'Module configuration data',
	})
	@ApiSuccessResponse(ConfigModuleResModuleConfig, 'Module configuration updated successfully')
	@ApiBadRequestResponse('Invalid module configuration data or unsupported module type')
	@ApiNotFoundResponse('Module configuration not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async updateModuleConfig(
		@Param('module') module: string,
		@Body() moduleConfig: { data: object },
	): Promise<ConfigModuleResModuleConfig> {
		let mapping: ModuleTypeMapping<ModuleConfigModel, UpdateModuleConfigDto>;

		try {
			mapping = this.modulesMapperService.getMapping<ModuleConfigModel, UpdateModuleConfigDto>(module);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported module type for update: ${module} `, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof ConfigException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported module type: ${module}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = toInstance(mapping.configDto, moduleConfig.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for module modification error=${JSON.stringify(errors)} module=${module} `,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		this.service.setModuleConfig(module, dtoInstance);

		const config = this.service.getModuleConfig(module);

		const response = new ConfigModuleResModuleConfig();
		response.data = config;
		return response;
	}
}
