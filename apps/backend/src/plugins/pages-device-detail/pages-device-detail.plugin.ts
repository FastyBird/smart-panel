import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreatePageDto } from '../../modules/dashboard/dto/create-page.dto';
import { UpdatePageDto } from '../../modules/dashboard/dto/update-page.dto';
import { PageEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { PageRelationsLoaderRegistryService } from '../../modules/dashboard/services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateDeviceDetailPageDto } from './dto/create-page.dto';
import { DeviceDetailUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateDeviceDetailPageDto } from './dto/update-page.dto';
import { DeviceDetailPageEntity } from './entities/pages-device-detail.entity';
import { DeviceDetailConfigModel } from './models/config.model';
import { PAGES_DEVICE_DETAIL_PLUGIN_NAME, PAGES_DEVICE_DETAIL_TYPE } from './pages-device-detail.constants';
import { PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-device-detail.openapi';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([DeviceDetailPageEntity]),
		DashboardModule,
		DevicesModule,
		ConfigModule,
		SwaggerModule,
	],
	providers: [PageRelationsLoaderService],
})
export class PagesDeviceDetailPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<DeviceDetailConfigModel, DeviceDetailUpdatePluginConfigDto>({
			type: PAGES_DEVICE_DETAIL_PLUGIN_NAME,
			class: DeviceDetailConfigModel,
			configDto: DeviceDetailUpdatePluginConfigDto,
		});

		this.pagesMapper.registerMapping<DeviceDetailPageEntity, CreateDeviceDetailPageDto, UpdateDeviceDetailPageDto>({
			type: PAGES_DEVICE_DETAIL_TYPE,
			class: DeviceDetailPageEntity,
			createDto: CreateDeviceDetailPageDto,
			updateDto: UpdateDeviceDetailPageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);

		for (const model of PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: PageEntity,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_DEVICE_DETAIL_TYPE,
			modelClass: DeviceDetailPageEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_DEVICE_DETAIL_TYPE,
			modelClass: CreateDeviceDetailPageDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_DEVICE_DETAIL_TYPE,
			modelClass: UpdateDeviceDetailPageDto,
		});
	}
}
