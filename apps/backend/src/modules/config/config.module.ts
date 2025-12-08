import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { PlatformModule } from '../platform/platform.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { GenerateAdminExtensionsCommand } from './commands/generate-admin-extensions.command';
import {
	CONFIG_MODULE_API_TAG_DESCRIPTION,
	CONFIG_MODULE_API_TAG_NAME,
	CONFIG_MODULE_NAME,
	WeatherLocationType,
} from './config.constants';
import { CONFIG_SWAGGER_EXTRA_MODELS } from './config.openapi';
import { ConfigController } from './controllers/config.controller';
import {
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherZipCodeConfigDto,
} from './dto/config.dto';
import {
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
	WeatherConfigModel,
	WeatherLatLonConfigModel,
	WeatherZipCodeConfigModel,
} from './models/config.model';
import { ConfigService } from './services/config.service';
import { ModulesTypeMapperService } from './services/modules-type-mapper.service';
import { PluginsTypeMapperService } from './services/plugins-type-mapper.service';

@ApiTag({
	tagName: CONFIG_MODULE_NAME,
	displayName: CONFIG_MODULE_API_TAG_NAME,
	description: CONFIG_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [NestConfigModule, PlatformModule, forwardRef(() => SystemModule), SwaggerModule],
	providers: [ConfigService, PluginsTypeMapperService, ModulesTypeMapperService, GenerateAdminExtensionsCommand],
	controllers: [ConfigController],
	exports: [ConfigService, PluginsTypeMapperService, ModulesTypeMapperService],
})
export class ConfigModule {
	constructor(
		private readonly configService: ConfigService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
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

		for (const model of CONFIG_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: WeatherConfigModel,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.LAT_LON,
			modelClass: WeatherLatLonConfigModel,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateWeatherConfigDto,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.LAT_LON,
			modelClass: UpdateWeatherLatLonConfigDto,
		});

		this.discriminatorRegistry.register({
			parentClass: WeatherConfigModel,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.CITY_NAME,
			modelClass: WeatherCityNameConfigModel,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateWeatherConfigDto,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.CITY_NAME,
			modelClass: UpdateWeatherCityNameConfigDto,
		});

		this.discriminatorRegistry.register({
			parentClass: WeatherConfigModel,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.CITY_ID,
			modelClass: WeatherCityIdConfigModel,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateWeatherConfigDto,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.CITY_ID,
			modelClass: UpdateWeatherCityIdConfigDto,
		});

		this.discriminatorRegistry.register({
			parentClass: WeatherConfigModel,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.ZIP_CODE,
			modelClass: WeatherZipCodeConfigModel,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateWeatherConfigDto,
			discriminatorProperty: 'location_type',
			discriminatorValue: WeatherLocationType.ZIP_CODE,
			modelClass: UpdateWeatherZipCodeConfigDto,
		});
	}
}
