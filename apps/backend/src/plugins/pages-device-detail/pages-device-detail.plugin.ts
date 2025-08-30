import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { PageRelationsLoaderRegistryService } from '../../modules/dashboard/services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';

import { CreateDeviceDetailPageDto } from './dto/create-page.dto';
import { UpdateDeviceDetailPageDto } from './dto/update-page.dto';
import { DeviceDetailPageEntity } from './entities/pages-device-detail.entity';
import { PAGES_DEVICE_DETAIL_TYPE } from './pages-device-detail.constants';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [TypeOrmModule.forFeature([DeviceDetailPageEntity]), DashboardModule, DevicesModule],
	providers: [PageRelationsLoaderService],
})
export class PagesDeviceDetailPlugin {
	constructor(
		private readonly mapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<DeviceDetailPageEntity, CreateDeviceDetailPageDto, UpdateDeviceDetailPageDto>({
			type: PAGES_DEVICE_DETAIL_TYPE,
			class: DeviceDetailPageEntity,
			createDto: CreateDeviceDetailPageDto,
			updateDto: UpdateDeviceDetailPageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);
	}
}
