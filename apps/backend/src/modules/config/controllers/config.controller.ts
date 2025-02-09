import { BadRequestException, Body, Controller, Get, Logger, Param, Patch } from '@nestjs/common';

import {
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
			case 'audio':
				config = this.service.getConfigSection<AudioConfigEntity>(section, AudioConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case 'display':
				config = this.service.getConfigSection<DisplayConfigEntity>(section, DisplayConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case 'language':
				config = this.service.getConfigSection<LanguageConfigEntity>(section, LanguageConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
			case 'weather':
				config = this.service.getConfigSection<WeatherConfigEntity>(section, WeatherConfigEntity);

				this.logger.debug(`[LOOKUP] Found configuration section=${section}`);

				return config;
		}

		throw new BadRequestException([
			JSON.stringify({ field: 'section', reason: `Requested configuration section: ${section as string} not found.` }),
		]);
	}

	@Patch('audio')
	async updateAudioConfig(@Body() audioConfig: UpdateAudioConfigDto): Promise<AudioConfigEntity> {
		this.logger.debug('[UPDATE] Incoming update request for page section=audio');

		await this.service.setConfigSection('audio', audioConfig, UpdateAudioConfigDto);

		const config = this.service.getConfigSection<AudioConfigEntity>('audio', AudioConfigEntity);

		this.logger.debug('[UPDATE] Successfully updated configuration section=audio');

		return config;
	}

	@Patch('display')
	async updateDisplayConfig(@Body() displayConfig: UpdateDisplayConfigDto): Promise<DisplayConfigEntity> {
		this.logger.debug('[UPDATE] Incoming update request for page section=display');

		await this.service.setConfigSection('display', displayConfig, UpdateDisplayConfigDto);

		const config = this.service.getConfigSection<DisplayConfigEntity>('display', DisplayConfigEntity);

		this.logger.debug('[UPDATE] Successfully updated configuration section=display');

		return config;
	}

	@Patch('language')
	async updateLanguageConfig(@Body() languageConfig: UpdateLanguageConfigDto): Promise<LanguageConfigEntity> {
		this.logger.debug('[UPDATE] Incoming update request for page section=language');

		await this.service.setConfigSection('language', languageConfig, UpdateLanguageConfigDto);

		const config = this.service.getConfigSection<LanguageConfigEntity>('language', LanguageConfigEntity);

		this.logger.debug('[UPDATE] Successfully updated configuration section=language');

		return config;
	}

	@Patch('weather')
	async updateWeatherConfig(@Body() weatherConfig: UpdateWeatherConfigDto): Promise<WeatherConfigEntity> {
		this.logger.debug('[UPDATE] Incoming update request for page section=weather');

		await this.service.setConfigSection('weather', weatherConfig, UpdateWeatherConfigDto);

		const config = this.service.getConfigSection<WeatherConfigEntity>('weather', WeatherConfigEntity);

		this.logger.debug('[UPDATE] Successfully updated configuration section=weather');

		return config;
	}
}
