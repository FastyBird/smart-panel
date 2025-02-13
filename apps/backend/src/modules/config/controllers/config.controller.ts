import { BadRequestException, Body, Controller, Get, Logger, Param, Patch } from '@nestjs/common';

import { SectionType } from '../config.constants';
import {
	ReqUpdateSectionDto,
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdateWeatherConfigDto,
} from '../dto/config.dto';
import {
	AppConfigEntity,
	AudioConfigEntity,
	BaseConfigEntity,
	DisplayConfigEntity,
	LanguageConfigEntity,
	WeatherConfigEntity,
} from '../entities/config.entity';
import { ConfigService } from '../services/config.service';

@Controller('config')
export class ConfigController {
	private readonly logger = new Logger(ConfigController.name);

	constructor(private readonly service: ConfigService) {}

	@Get()
	getAllConfig(): AppConfigEntity {
		this.logger.debug('[LOOKUP ALL] Fetching application configuration');

		const config = this.service.getConfig();

		this.logger.debug(`[LOOKUP ALL] Retrieved application configuration`);

		return config;
	}

	@Get(':section')
	getConfigSection(@Param('section') section: keyof AppConfigEntity): BaseConfigEntity {
		this.logger.debug(`[LOOKUP] Fetching configuration section=${section}`);

		let config: BaseConfigEntity;

		switch (section) {
			case SectionType.AUDIO:
				config = this.service.getConfigSection<AudioConfigEntity>(section, AudioConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case SectionType.DISPLAY:
				config = this.service.getConfigSection<DisplayConfigEntity>(section, DisplayConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case SectionType.LANGUAGE:
				config = this.service.getConfigSection<LanguageConfigEntity>(section, LanguageConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case SectionType.WEATHER:
				config = this.service.getConfigSection<WeatherConfigEntity>(section, WeatherConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
		}

		throw new BadRequestException([
			JSON.stringify({ field: 'section', reason: `Requested configuration section: ${section as string} not found.` }),
		]);
	}

	@Patch(SectionType.AUDIO)
	async updateAudioConfig(@Body() audioConfig: ReqUpdateSectionDto): Promise<AudioConfigEntity> {
		console.log('PATCH');
		this.logger.debug(`[UPDATE] Incoming update request for page section=${SectionType.AUDIO}`);

		await this.service.setConfigSection(SectionType.AUDIO, audioConfig.data, UpdateAudioConfigDto);

		const config = this.service.getConfigSection<AudioConfigEntity>(SectionType.AUDIO, AudioConfigEntity);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.AUDIO}`);

		return config;
	}

	@Patch(SectionType.DISPLAY)
	async updateDisplayConfig(@Body() displayConfig: ReqUpdateSectionDto): Promise<DisplayConfigEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page section=${SectionType.DISPLAY}`);

		await this.service.setConfigSection(SectionType.DISPLAY, displayConfig.data, UpdateDisplayConfigDto);

		const config = this.service.getConfigSection<DisplayConfigEntity>(SectionType.DISPLAY, DisplayConfigEntity);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.DISPLAY}`);

		return config;
	}

	@Patch(SectionType.LANGUAGE)
	async updateLanguageConfig(@Body() languageConfig: ReqUpdateSectionDto): Promise<LanguageConfigEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page section=${SectionType.LANGUAGE}`);

		await this.service.setConfigSection(SectionType.LANGUAGE, languageConfig.data, UpdateLanguageConfigDto);

		const config = this.service.getConfigSection<LanguageConfigEntity>(SectionType.LANGUAGE, LanguageConfigEntity);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.LANGUAGE}`);

		return config;
	}

	@Patch(SectionType.WEATHER)
	async updateWeatherConfig(@Body() weatherConfig: ReqUpdateSectionDto): Promise<WeatherConfigEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page section=${SectionType.WEATHER}`);

		await this.service.setConfigSection(SectionType.WEATHER, weatherConfig.data, UpdateWeatherConfigDto);

		const config = this.service.getConfigSection<WeatherConfigEntity>(SectionType.WEATHER, WeatherConfigEntity);

		this.logger.debug(`[UPDATE] Successfully updated configuration section=${SectionType.WEATHER}`);

		return config;
	}
}
