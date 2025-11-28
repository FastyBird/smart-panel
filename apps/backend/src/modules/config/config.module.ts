import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ApiExtraModels } from '@nestjs/swagger';

import { ApiTag } from '../api/decorators/api-tag.decorator';
import { PlatformModule } from '../platform/platform.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { GenerateAdminExtensionsCommand } from './commands/generate-admin-extensions.command';
import { CONFIG_MODULE_API_TAG_DESCRIPTION, CONFIG_MODULE_API_TAG_NAME, CONFIG_MODULE_NAME } from './config.constants';
import { ConfigController } from './controllers/config.controller';
import {
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdateSystemConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherZipCodeConfigDto,
} from './dto/config.dto';
import {
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
} from './models/config-response.model';
import { ConfigService } from './services/config.service';
import { PluginsTypeMapperService } from './services/plugins-type-mapper.service';

@ApiTag({
	tagName: CONFIG_MODULE_NAME,
	displayName: CONFIG_MODULE_API_TAG_NAME,
	description: CONFIG_MODULE_API_TAG_DESCRIPTION,
})
@ApiExtraModels(
	// Response models
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
	// DTOs for oneOf references
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherZipCodeConfigDto,
	UpdateSystemConfigDto,
)
@Module({
	imports: [NestConfigModule, PlatformModule, forwardRef(() => SystemModule)],
	providers: [ConfigService, PluginsTypeMapperService, GenerateAdminExtensionsCommand],
	controllers: [ConfigController],
	exports: [ConfigService, PluginsTypeMapperService],
})
export class ConfigModule {
	constructor(
		private readonly configService: ConfigService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
		this.factoryResetRegistry.register(
			CONFIG_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				await this.configService.resetConfig();

				return {
					success: true,
				};
			},
			500,
		);
	}
}
