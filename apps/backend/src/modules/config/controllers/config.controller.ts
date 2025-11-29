import { validate } from 'class-validator';

import { BadRequestException, Body, Controller, Get, Logger, Param, Patch } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DevicesException } from '../../devices/devices.exceptions';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CONFIG_MODULE_API_TAG_NAME } from '../config.constants';
import { SectionType } from '../config.constants';
import {
	ReqUpdatePluginDto,
	ReqUpdateSectionDto,
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdatePluginConfigDto,
	UpdateSystemConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherZipCodeConfigDto,
} from '../dto/config.dto';
import {
	ConfigModuleResAppConfig,
	ConfigModuleResAudio,
	ConfigModuleResDisplay,
	ConfigModuleResLanguage,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
	ConfigModuleResSystem,
	ConfigModuleResWeather,
} from '../models/config-response.model';
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
} from '../models/config.model';
import { ConfigService } from '../services/config.service';
import { PluginTypeMapping, PluginsTypeMapperService } from '../services/plugins-type-mapper.service';

@ApiTags(CONFIG_MODULE_API_TAG_NAME)
@Controller('config')
export class ConfigController {
	private readonly logger = new Logger(ConfigController.name);

	constructor(
		private readonly service: ConfigService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
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
		this.logger.debug('[LOOKUP ALL] Fetching application configuration');

		const config = this.service.getConfig();

		this.logger.debug(`[LOOKUP ALL] Retrieved application configuration`);

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
		description: 'Configuration section identifier',
		enum: Object.values(SectionType),
		example: SectionType.AUDIO,
	})
	@ApiSuccessResponse(ConfigModuleResSection, 'Section configuration retrieved successfully')
	@ApiBadRequestResponse('Invalid section identifier')
	@ApiNotFoundResponse('Configuration section not found')
	@ApiInternalServerErrorResponse('Internal server error')
	getConfigSection(@Param('section') section: keyof AppConfigModel): ConfigModuleResSection {
		this.logger.debug(`[LOOKUP] Fetching configuration section=${section}`);

		switch (section) {
			case SectionType.AUDIO: {
				const config = this.service.getConfigSection<AudioConfigModel>(section, AudioConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return this.createSectionResponse(config);
			}
			case SectionType.DISPLAY: {
				const config = this.service.getConfigSection<DisplayConfigModel>(section, DisplayConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return this.createSectionResponse(config);
			}
			case SectionType.LANGUAGE: {
				const config = this.service.getConfigSection<LanguageConfigModel>(section, LanguageConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return this.createSectionResponse(config);
			}
			case SectionType.WEATHER: {
				const config = this.service.getConfigSection<
					WeatherLatLonConfigModel | WeatherCityNameConfigModel | WeatherCityIdConfigModel | WeatherZipCodeConfigModel
				>(section, [
					WeatherLatLonConfigModel,
					WeatherCityNameConfigModel,
					WeatherCityIdConfigModel,
					WeatherZipCodeConfigModel,
				]);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return this.createSectionResponse(config);
			}
			case SectionType.SYSTEM: {
				const config = this.service.getConfigSection<SystemConfigModel>(section, SystemConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return this.createSectionResponse(config);
			}
		}

		throw new BadRequestException([
			JSON.stringify({ field: 'section', reason: `Requested configuration section: ${section as string} not found.` }),
		]);
	}

	@Patch(SectionType.AUDIO)
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update audio configuration',
		description: 'Update the audio section configuration',
		operationId: 'update-config-module-audio',
	})
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Audio configuration data' })
	@ApiSuccessResponse(ConfigModuleResAudio, 'Audio configuration updated successfully')
	@ApiBadRequestResponse('Invalid audio configuration data')
	@ApiInternalServerErrorResponse('Internal server error')
	async updateAudioConfig(@Body() audioConfig: ReqUpdateSectionDto): Promise<ConfigModuleResAudio> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.AUDIO}`);

		await this.service.setConfigSection(SectionType.AUDIO, audioConfig.data, UpdateAudioConfigDto);

		const config = this.service.getConfigSection<AudioConfigModel>(SectionType.AUDIO, AudioConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.AUDIO}`);

		return this.createSectionResponse(config) as ConfigModuleResAudio;
	}

	@Patch(SectionType.DISPLAY)
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update display configuration',
		description: 'Update the display section configuration',
		operationId: 'update-config-module-display',
	})
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Display configuration data' })
	@ApiSuccessResponse(ConfigModuleResDisplay, 'Display configuration updated successfully')
	@ApiBadRequestResponse('Invalid display configuration data')
	@ApiInternalServerErrorResponse('Internal server error')
	async updateDisplayConfig(@Body() displayConfig: ReqUpdateSectionDto): Promise<ConfigModuleResDisplay> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.DISPLAY}`);

		await this.service.setConfigSection(SectionType.DISPLAY, displayConfig.data, UpdateDisplayConfigDto);

		const config = this.service.getConfigSection<DisplayConfigModel>(SectionType.DISPLAY, DisplayConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.DISPLAY}`);

		return this.createSectionResponse(config) as ConfigModuleResDisplay;
	}

	@Patch(SectionType.LANGUAGE)
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update language configuration',
		description: 'Update the language section configuration',
		operationId: 'update-config-module-language',
	})
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Language configuration data' })
	@ApiSuccessResponse(ConfigModuleResLanguage, 'Language configuration updated successfully')
	@ApiBadRequestResponse('Invalid language configuration data')
	@ApiInternalServerErrorResponse('Internal server error')
	async updateLanguageConfig(@Body() languageConfig: ReqUpdateSectionDto): Promise<ConfigModuleResLanguage> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.LANGUAGE}`);

		await this.service.setConfigSection(SectionType.LANGUAGE, languageConfig.data, UpdateLanguageConfigDto);

		const config = this.service.getConfigSection<LanguageConfigModel>(SectionType.LANGUAGE, LanguageConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.LANGUAGE}`);

		return this.createSectionResponse(config) as ConfigModuleResLanguage;
	}

	@Patch(SectionType.WEATHER)
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update weather configuration',
		description: 'Update the weather section configuration',
		operationId: 'update-config-module-weather',
	})
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Weather configuration data' })
	@ApiSuccessResponse(ConfigModuleResWeather, 'Weather configuration updated successfully')
	@ApiBadRequestResponse('Invalid weather configuration data')
	@ApiInternalServerErrorResponse('Internal server error')
	async updateWeatherConfig(@Body() weatherConfig: ReqUpdateSectionDto): Promise<ConfigModuleResWeather> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.WEATHER}`);

		await this.service.setConfigSection(SectionType.WEATHER, weatherConfig.data, [
			UpdateWeatherLatLonConfigDto,
			UpdateWeatherCityNameConfigDto,
			UpdateWeatherCityIdConfigDto,
			UpdateWeatherZipCodeConfigDto,
		]);

		const config = this.service.getConfigSection<
			WeatherLatLonConfigModel | WeatherCityNameConfigModel | WeatherCityIdConfigModel | WeatherZipCodeConfigModel
		>(SectionType.WEATHER, [
			WeatherLatLonConfigModel,
			WeatherCityNameConfigModel,
			WeatherCityIdConfigModel,
			WeatherZipCodeConfigModel,
		]);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.WEATHER}`);

		return this.createSectionResponse(config) as ConfigModuleResWeather;
	}

	@Patch(SectionType.SYSTEM)
	@ApiOperation({
		tags: [CONFIG_MODULE_API_TAG_NAME],
		summary: 'Update system configuration',
		description: 'Update the system section configuration',
		operationId: 'update-config-module-system',
	})
	@ApiBody({ type: ReqUpdateSectionDto, description: 'System configuration data' })
	@ApiSuccessResponse(ConfigModuleResSystem, 'System configuration updated successfully')
	@ApiBadRequestResponse('Invalid system configuration data')
	@ApiInternalServerErrorResponse('Internal server error')
	async updateSystemConfig(@Body() systemConfig: ReqUpdateSectionDto): Promise<ConfigModuleResSystem> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.SYSTEM}`);

		await this.service.setConfigSection(SectionType.SYSTEM, systemConfig.data, UpdateSystemConfigDto);

		const config = this.service.getConfigSection<SystemConfigModel>(SectionType.SYSTEM, SystemConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.SYSTEM}`);

		return this.createSectionResponse(config) as ConfigModuleResSystem;
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
		this.logger.debug('[LOOKUP] Fetching configuration for all plugins');

		const config: PluginConfigModel[] = this.service.getPluginsConfig();

		this.logger.debug('[LOOKUP] Found configuration for all plugins');

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
		this.logger.debug(`[LOOKUP] Fetching configuration plugin=${plugin}`);

		const config: PluginConfigModel = this.service.getPluginConfig(plugin);

		this.logger.debug(`[LOOKUP] Found configuration plugin=${plugin}`);

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
		@Body() pluginConfig: ReqUpdatePluginDto,
	): Promise<ConfigModuleResPluginConfig> {
		this.logger.debug(`[UPDATE] Incoming update request for plugin=${plugin}`);

		let mapping: PluginTypeMapping<PluginConfigModel, UpdatePluginConfigDto>;

		try {
			mapping = this.pluginsMapperService.getMapping<PluginConfigModel, UpdatePluginConfigDto>(plugin);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported plugin type for update: ${plugin} `, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DevicesException) {
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

		this.logger.debug(`[UPDATE] Successfully updated configuration plugin=${plugin}`);

		const response = new ConfigModuleResPluginConfig();
		response.data = config;
		return response;
	}
}
