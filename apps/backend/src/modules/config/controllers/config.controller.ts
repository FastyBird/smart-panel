import { validate } from 'class-validator';

import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { CONFIG_MODULE_API_TAG_NAME, CONFIG_MODULE_NAME } from '../config.constants';
import { ConfigException, ConfigValidationException } from '../config.exceptions';
import {
	ReqUpdateModuleDto,
	ReqUpdatePluginDto,
	UpdateModuleConfigDto,
	UpdatePluginConfigDto,
} from '../dto/config.dto';
import {
	ConfigModuleResAppConfig,
	ConfigModuleResModuleConfig,
	ConfigModuleResModules,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
} from '../models/config-response.model';
import {
	ConfigModuleResPluginConfigValidation,
	ConfigValidationResultModel,
} from '../models/config-validation-response.model';
import { ModuleConfigModel, PluginConfigModel } from '../models/config.model';
import { ConfigSecretsService } from '../services/config-secrets.service';
import { ConfigService } from '../services/config.service';
import { ModuleTypeMapping, ModulesTypeMapperService } from '../services/modules-type-mapper.service';
import { PluginConfigValidatorService } from '../services/plugin-config-validator.service';
import { PluginTypeMapping, PluginsTypeMapperService } from '../services/plugins-type-mapper.service';

@ApiTags(CONFIG_MODULE_API_TAG_NAME)
@Controller('config')
export class ConfigController {
	private readonly logger = createExtensionLogger(CONFIG_MODULE_NAME, 'ConfigController');

	constructor(
		private readonly service: ConfigService,
		private readonly configSecrets: ConfigSecretsService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly pluginConfigValidator: PluginConfigValidatorService,
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
		this.logger.debug('Fetching application configuration');

		const config = this.service.getPublicConfig();

		this.logger.debug(`Retrieved application configuration`);

		const response = new ConfigModuleResAppConfig();
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
		this.logger.debug('Fetching configuration for all plugins');

		const config: PluginConfigModel[] = this.service.getPublicPluginsConfig();

		this.logger.debug('Found configuration for all plugins');

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
		this.logger.debug(`Fetching configuration plugin=${plugin}`);

		const config: PluginConfigModel = this.service.getPublicPluginConfig(plugin);

		this.logger.debug(`Found configuration plugin=${plugin}`);

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
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async updatePluginConfig(
		@Param('plugin') plugin: string,
		@Body() pluginConfig: { data: object },
	): Promise<ConfigModuleResPluginConfig> {
		this.logger.debug(`Incoming update request for plugin=${plugin}`);

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
			validationError: { target: false, value: false },
		});

		if (errors.length > 0) {
			const redactedErrors = this.configSecrets.redactForLogging(errors, mapping.secretFields, dtoInstance);

			this.logger.error(
				`[VALIDATION FAILED] Validation failed for plugin modification error=${JSON.stringify(redactedErrors)} plugin=${plugin} `,
			);

			throw ValidationExceptionFactory.createException(redactedErrors);
		}

		// Plugin-specific validation (connection tests) is NOT run here — it would
		// block saves when the target service is temporarily unreachable. Users must
		// be able to pre-configure credentials before the service is online.
		// Use POST plugin/:plugin/validate for explicit validation.
		try {
			await this.service.updatePluginConfig(plugin, dtoInstance, pluginConfig.data as Record<string, unknown>);
		} catch (error) {
			if (error instanceof ConfigValidationException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'config', reason: 'The resolved plugin configuration is invalid.' }),
				]);
			}

			throw error;
		}

		const config = this.service.getPublicPluginConfig(plugin);

		this.logger.debug(`Successfully updated configuration plugin=${plugin}`);

		const response = new ConfigModuleResPluginConfig();
		response.data = config;
		return response;
	}

	@Post('plugin/:plugin/validate')
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Validate plugin configuration',
		description:
			'Validate plugin configuration without persisting. Returns validation result with optional field-level errors.',
		operationId: 'validate-config-module-config-plugin',
	})
	@ApiParam({ name: 'plugin', description: 'Plugin identifier', type: 'string', example: 'devices-shelly' })
	@ApiBody({
		type: ReqUpdatePluginDto,
		description: 'Plugin configuration data to validate',
	})
	@ApiSuccessResponse(ConfigModuleResPluginConfigValidation, 'Plugin configuration validation result')
	@ApiBadRequestResponse('Invalid plugin configuration data or unsupported plugin type')
	@ApiInternalServerErrorResponse('Internal server error')
	async validatePluginConfig(
		@Param('plugin') plugin: string,
		@Body() pluginConfig: { data: object },
	): Promise<ConfigModuleResPluginConfigValidation> {
		this.logger.debug(`Incoming validate request for plugin=${plugin}`);

		let mapping: PluginTypeMapping<PluginConfigModel, UpdatePluginConfigDto>;

		try {
			mapping = this.pluginsMapperService.getMapping<PluginConfigModel, UpdatePluginConfigDto>(plugin);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported plugin type for validation: ${plugin}`, {
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

		// DTO schema validation (field types, required fields, etc.)
		const dtoInstance = toInstance(mapping.configDto, pluginConfig.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
			validationError: { target: false, value: false },
		});

		if (errors.length > 0) {
			const redactedErrors = this.configSecrets.redactForLogging(errors, mapping.secretFields, dtoInstance);

			this.logger.error(`[VALIDATION FAILED] Schema validation failed for plugin validation plugin=${plugin}`);

			throw ValidationExceptionFactory.createException(redactedErrors);
		}

		// Plugin-specific validation (connection tests, credential checks, etc.).
		// Resolve omitted write-only fields from storage so a saved configuration can
		// be validated without returning or re-entering its secret.
		const resolvedConfig = this.service.resolvePluginConfigUpdate(
			plugin,
			dtoInstance,
			pluginConfig.data as Record<string, unknown>,
		);
		const result = await this.pluginConfigValidator.validate(
			plugin,
			resolvedConfig as unknown as Record<string, unknown>,
		);
		const redactedResult = this.configSecrets.redactForLogging(result, mapping.secretFields, resolvedConfig);

		const resultModel = new ConfigValidationResultModel();
		resultModel.valid = redactedResult.valid;
		resultModel.errors = redactedResult.errors;

		const response = new ConfigModuleResPluginConfigValidation();
		response.data = resultModel;
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
		this.logger.debug('Fetching configuration for all modules');

		const config: ModuleConfigModel[] = this.service.getPublicModulesConfig();

		this.logger.debug('Found configuration for all modules');

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
		this.logger.debug(`Fetching configuration module=${module}`);

		const config: ModuleConfigModel = this.service.getPublicModuleConfig(module);

		this.logger.debug(`Found configuration module=${module}`);

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
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async updateModuleConfig(
		@Param('module') module: string,
		@Body() moduleConfig: { data: object },
	): Promise<ConfigModuleResModuleConfig> {
		this.logger.debug(`Incoming update request for module=${module}`);

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
			validationError: { target: false, value: false },
		});

		if (errors.length > 0) {
			const redactedErrors = this.configSecrets.redactForLogging(errors, mapping.secretFields, dtoInstance);

			this.logger.error(
				`[VALIDATION FAILED] Validation failed for module modification error=${JSON.stringify(redactedErrors)} module=${module} `,
			);

			throw ValidationExceptionFactory.createException(redactedErrors);
		}

		await this.service.updateModuleConfig(module, dtoInstance, moduleConfig.data as Record<string, unknown>);

		const config = this.service.getPublicModuleConfig(module);

		this.logger.debug(`Successfully updated configuration module=${module}`);

		const response = new ConfigModuleResModuleConfig();
		response.data = config;
		return response;
	}
}
