import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { DataSourceRelationsLoaderRegistryService } from '../../modules/dashboard/services/data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from '../../modules/dashboard/services/data-source-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';

import { DATA_SOURCES_DEVICE_TYPE } from './data-sources-device-channel.constants';
import { CreateDeviceChannelDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDeviceChannelDataSourceDto } from './dto/update-data-source.dto';
import { DeviceChannelDataSourceEntity } from './entities/data-sources-device-channel.entity';
import { DataSourceRelationsLoaderService } from './services/data-source-relations-loader.service';
import { ChannelPropertyExistsConstraintValidator } from './validators/channel-property-exists-constraint.validator';
import { DeviceChannelExistsConstraintValidator } from './validators/device-channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from './validators/device-exists-constraint.validator';

@Module({
	imports: [TypeOrmModule.forFeature([DeviceChannelDataSourceEntity]), DashboardModule, DevicesModule],
	providers: [
		DeviceExistsConstraintValidator,
		DeviceChannelExistsConstraintValidator,
		ChannelPropertyExistsConstraintValidator,
		DataSourceRelationsLoaderService,
	],
})
export class DataSourcesDeviceChannelPlugin {
	constructor(
		private readonly mapper: DataSourcesTypeMapperService,
		private readonly dataSourceRelationsLoaderRegistryService: DataSourceRelationsLoaderRegistryService,
		private readonly dataSourceRelationsLoaderService: DataSourceRelationsLoaderService,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<
			DeviceChannelDataSourceEntity,
			CreateDeviceChannelDataSourceDto,
			UpdateDeviceChannelDataSourceDto
		>({
			type: DATA_SOURCES_DEVICE_TYPE,
			class: DeviceChannelDataSourceEntity,
			createDto: CreateDeviceChannelDataSourceDto,
			updateDto: UpdateDeviceChannelDataSourceDto,
		});

		this.dataSourceRelationsLoaderRegistryService.register(this.dataSourceRelationsLoaderService);
	}
}
