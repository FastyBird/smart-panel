import { validate } from 'class-validator';

import { BadRequestException, Body, Controller, Get, Logger, Param, Patch } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
	ApiSuccessUnionResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DevicesException } from '../../devices/devices.exceptions';
import { SectionType } from '../config.constants';
import {
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
} from '../models/config.model';
import { ConfigService } from '../services/config.service';
import { PluginTypeMapping, PluginsTypeMapperService } from '../services/plugins-type-mapper.service';

@ApiTags('config-module')
@Controller('config')
export class ConfigController {
	private readonly logger = new Logger(ConfigController.name);

	constructor(
		private readonly service: ConfigService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
	) {}

	@Get()
	@ApiOperation({ summary: 'Get all configuration', description: 'Retrieve the complete application configuration' })
	@ApiSuccessResponse(AppConfigModel, 'Configuration retrieved successfully')
	@ApiInternalServerErrorResponse()
	getAllConfig(): AppConfigModel {
		this.logger.debug('[LOOKUP ALL] Fetching application configuration');

		const config = this.service.getConfig();

		this.logger.debug(`[LOOKUP ALL] Retrieved application configuration`);

		return config;
	}

	@Get(':section')
	@ApiOperation({
		summary: 'Get configuration section',
		description: 'Retrieve a specific configuration section',
	})
	@ApiParam({
		name: 'section',
		description: 'Configuration section identifier',
		enum: Object.values(SectionType),
		example: SectionType.AUDIO,
	})
	@ApiSuccessUnionResponse(
		[
			AudioConfigModel,
			DisplayConfigModel,
			LanguageConfigModel,
			WeatherLatLonConfigModel,
			WeatherCityNameConfigModel,
			WeatherCityIdConfigModel,
			WeatherZipCodeConfigModel,
			SystemConfigModel,
		],
		'Section configuration retrieved successfully',
	)
	@ApiBadRequestResponse('Invalid section identifier')
	@ApiInternalServerErrorResponse()
	getConfigSection(@Param('section') section: keyof AppConfigModel): BaseConfigModel {
		this.logger.debug(`[LOOKUP] Fetching configuration section=${section}`);

		let config: BaseConfigModel;

		switch (section) {
			case SectionType.AUDIO:
				config = this.service.getConfigSection<AudioConfigModel>(section, AudioConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case SectionType.DISPLAY:
				config = this.service.getConfigSection<DisplayConfigModel>(section, DisplayConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case SectionType.LANGUAGE:
				config = this.service.getConfigSection<LanguageConfigModel>(section, LanguageConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case SectionType.WEATHER:
				config = this.service.getConfigSection<
					WeatherLatLonConfigModel | WeatherCityNameConfigModel | WeatherCityIdConfigModel | WeatherZipCodeConfigModel
				>(section, [
					WeatherLatLonConfigModel,
					WeatherCityNameConfigModel,
					WeatherCityIdConfigModel,
					WeatherZipCodeConfigModel,
				]);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case SectionType.SYSTEM:
				config = this.service.getConfigSection<SystemConfigModel>(section, SystemConfigModel);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
		}

		throw new BadRequestException([
			JSON.stringify({ field: 'section', reason: `Requested configuration section: ${section as string} not found.` }),
		]);
	}

	@Patch(SectionType.AUDIO)
	@ApiOperation({ summary: 'Update audio configuration', description: 'Update the audio section configuration' })
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Audio configuration data' })
	@ApiSuccessResponse(AudioConfigModel, 'Audio configuration updated successfully')
	@ApiBadRequestResponse('Invalid audio configuration data')
	@ApiInternalServerErrorResponse()
	async updateAudioConfig(@Body() audioConfig: ReqUpdateSectionDto): Promise<AudioConfigModel> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.AUDIO}`);

		await this.service.setConfigSection(SectionType.AUDIO, audioConfig.data, UpdateAudioConfigDto);

		const config = this.service.getConfigSection<AudioConfigModel>(SectionType.AUDIO, AudioConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.AUDIO}`);

		return config;
	}

	@Patch(SectionType.DISPLAY)
	@ApiOperation({ summary: 'Update display configuration', description: 'Update the display section configuration' })
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Display configuration data' })
	@ApiSuccessResponse(DisplayConfigModel, 'Display configuration updated successfully')
	@ApiBadRequestResponse('Invalid display configuration data')
	@ApiInternalServerErrorResponse()
	async updateDisplayConfig(@Body() displayConfig: ReqUpdateSectionDto): Promise<DisplayConfigModel> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.DISPLAY}`);

		await this.service.setConfigSection(SectionType.DISPLAY, displayConfig.data, UpdateDisplayConfigDto);

		const config = this.service.getConfigSection<DisplayConfigModel>(SectionType.DISPLAY, DisplayConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.DISPLAY}`);

		return config;
	}

	@Patch(SectionType.LANGUAGE)
	@ApiOperation({ summary: 'Update language configuration', description: 'Update the language section configuration' })
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Language configuration data' })
	@ApiSuccessResponse(LanguageConfigModel, 'Language configuration updated successfully')
	@ApiBadRequestResponse('Invalid language configuration data')
	@ApiInternalServerErrorResponse()
	async updateLanguageConfig(@Body() languageConfig: ReqUpdateSectionDto): Promise<LanguageConfigModel> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.LANGUAGE}`);

		await this.service.setConfigSection(SectionType.LANGUAGE, languageConfig.data, UpdateLanguageConfigDto);

		const config = this.service.getConfigSection<LanguageConfigModel>(SectionType.LANGUAGE, LanguageConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.LANGUAGE}`);

		return config;
	}

	@Patch(SectionType.WEATHER)
	@ApiOperation({ summary: 'Update weather configuration', description: 'Update the weather section configuration' })
	@ApiBody({ type: ReqUpdateSectionDto, description: 'Weather configuration data' })
	@ApiSuccessUnionResponse(
		[WeatherLatLonConfigModel, WeatherCityNameConfigModel, WeatherCityIdConfigModel, WeatherZipCodeConfigModel],
		'Weather configuration updated successfully',
	)
	@ApiBadRequestResponse('Invalid weather configuration data')
	@ApiInternalServerErrorResponse()
	async updateWeatherConfig(
		@Body() weatherConfig: ReqUpdateSectionDto,
	): Promise<
		WeatherLatLonConfigModel | WeatherCityNameConfigModel | WeatherCityIdConfigModel | WeatherZipCodeConfigModel
	> {
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

		return config;
	}

	@Patch(SectionType.SYSTEM)
	@ApiOperation({ summary: 'Update system configuration', description: 'Update the system section configuration' })
	@ApiBody({ type: ReqUpdateSectionDto, description: 'System configuration data' })
	@ApiSuccessResponse(SystemConfigModel, 'System configuration updated successfully')
	@ApiBadRequestResponse('Invalid system configuration data')
	@ApiInternalServerErrorResponse()
	async updateSystemConfig(@Body() systemConfig: ReqUpdateSectionDto): Promise<SystemConfigModel> {
		this.logger.debug(`[UPDATE] Incoming update request for section=${SectionType.SYSTEM}`);

		await this.service.setConfigSection(SectionType.SYSTEM, systemConfig.data, UpdateSystemConfigDto);

		const config = this.service.getConfigSection<SystemConfigModel>(SectionType.SYSTEM, SystemConfigModel);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.SYSTEM}`);

		return config;
	}

	@Get('plugins')
	@ApiOperation({
		summary: 'Get all plugin configurations',
		description: 'Retrieve configuration for all registered plugins',
	})
	@ApiSuccessArrayResponse(PluginConfigModel, 'Plugin configurations retrieved successfully')
	@ApiInternalServerErrorResponse()
	getPluginsConfig(): PluginConfigModel[] {
		this.logger.debug('[LOOKUP] Fetching configuration for all plugins');

		const config: PluginConfigModel[] = this.service.getPluginsConfig();

		this.logger.debug('[LOOKUP] Found configuration for all plugins');

		return config;
	}

	@Get('plugin/:plugin')
	@ApiOperation({ summary: 'Get plugin configuration', description: 'Retrieve configuration for a specific plugin' })
	@ApiParam({ name: 'plugin', description: 'Plugin identifier', type: 'string', example: 'devices-shelly' })
	@ApiSuccessResponse(PluginConfigModel, 'Plugin configuration retrieved successfully')
	@ApiInternalServerErrorResponse()
	getPluginConfig(@Param('plugin') plugin: string): PluginConfigModel {
		this.logger.debug(`[LOOKUP] Fetching configuration plugin=${plugin}`);

		const config: PluginConfigModel = this.service.getPluginConfig(plugin);

		this.logger.debug(`[LOOKUP] Found configuration plugin=${plugin}`);

		return config;
	}

	@Patch('plugin/:plugin')
	@ApiOperation({ summary: 'Update plugin configuration', description: 'Update configuration for a specific plugin' })
	@ApiParam({ name: 'plugin', description: 'Plugin identifier', type: 'string', example: 'devices-shelly' })
	@ApiBody({
		description: 'Plugin configuration data',
		schema: { type: 'object', properties: { data: { type: 'object' } } },
	})
	@ApiSuccessResponse(PluginConfigModel, 'Plugin configuration updated successfully')
	@ApiBadRequestResponse('Invalid plugin configuration data or unsupported plugin type')
	@ApiInternalServerErrorResponse()
	async updatePluginConfig(
		@Param('plugin') plugin: string,
		@Body() pluginConfig: { data: object },
	): Promise<PluginConfigModel> {
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

		return config;
	}
}
