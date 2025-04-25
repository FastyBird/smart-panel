import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { TileRelationsLoaderRegistryService } from '../../modules/dashboard/services/tile-relations-loader-registry.service';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';

import { CreateDevicePreviewTileDto } from './dto/create-tile.dto';
import { UpdateDevicePreviewTileDto } from './dto/update-tile.dto';
import { DevicePreviewTileEntity } from './entities/tiles-device-preview.entity';
import { TileRelationsLoaderService } from './services/tile-relations-loader.service';

@Module({
	imports: [TypeOrmModule.forFeature([DevicePreviewTileEntity]), DashboardModule, DevicesModule],
	providers: [TileRelationsLoaderService],
})
export class TilesDevicePreviewPlugin {
	constructor(
		private readonly mapper: TilesTypeMapperService,
		private readonly tileRelationsLoaderRegistryService: TileRelationsLoaderRegistryService,
		private readonly tileRelationsLoaderService: TileRelationsLoaderService,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<DevicePreviewTileEntity, CreateDevicePreviewTileDto, UpdateDevicePreviewTileDto>({
			type: 'device-preview',
			class: DevicePreviewTileEntity,
			createDto: CreateDevicePreviewTileDto,
			updateDto: UpdateDevicePreviewTileDto,
		});

		this.tileRelationsLoaderRegistryService.register(this.tileRelationsLoaderService);
	}
}
