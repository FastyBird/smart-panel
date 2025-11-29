import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { PageRelationsLoaderRegistryService } from '../../modules/dashboard/services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { CreateDeviceDetailPageDto } from './dto/create-page.dto';
import { DeviceDetailUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateDeviceDetailPageDto } from './dto/update-page.dto';
import { DeviceDetailPageEntity } from './entities/pages-device-detail.entity';
import { DeviceDetailConfigModel } from './models/config.model';
import { PAGES_DEVICE_DETAIL_PLUGIN_NAME, PAGES_DEVICE_DETAIL_TYPE } from './pages-device-detail.constants';
import { PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-device-detail.openapi';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [TypeOrmModule.forFeature([DeviceDetailPageEntity]), DashboardModule, DevicesModule, ConfigModule],
	providers: [PageRelationsLoaderService],
})
export class PagesDeviceDetailPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
	) {
		this.swaggerRegistry.register(PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS);
	}

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
	}
}
