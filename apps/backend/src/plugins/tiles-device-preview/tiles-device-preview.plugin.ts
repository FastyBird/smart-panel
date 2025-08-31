import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { TileRelationsLoaderRegistryService } from '../../modules/dashboard/services/tile-relations-loader-registry.service';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';

import { CreateDevicePreviewTileDto } from './dto/create-tile.dto';
import { DevicePreviewUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateDevicePreviewTileDto } from './dto/update-tile.dto';
import { DevicePreviewTileEntity } from './entities/tiles-device-preview.entity';
import { DevicePreviewConfigModel } from './models/config.model';
import { TileRelationsLoaderService } from './services/tile-relations-loader.service';
import { TILES_DEVICE_PREVIEW_PLUGIN_NAME, TILES_DEVICE_PREVIEW_TYPE } from './tiles-device-preview.constants';

@Module({
	imports: [TypeOrmModule.forFeature([DevicePreviewTileEntity]), DashboardModule, DevicesModule, ConfigModule],
	providers: [TileRelationsLoaderService],
})
export class TilesDevicePreviewPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly tilesMapper: TilesTypeMapperService,
		private readonly tileRelationsLoaderRegistryService: TileRelationsLoaderRegistryService,
		private readonly tileRelationsLoaderService: TileRelationsLoaderService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<DevicePreviewConfigModel, DevicePreviewUpdatePluginConfigDto>({
			type: TILES_DEVICE_PREVIEW_PLUGIN_NAME,
			class: DevicePreviewConfigModel,
			configDto: DevicePreviewUpdatePluginConfigDto,
		});

		this.tilesMapper.registerMapping<DevicePreviewTileEntity, CreateDevicePreviewTileDto, UpdateDevicePreviewTileDto>({
			type: TILES_DEVICE_PREVIEW_TYPE,
			class: DevicePreviewTileEntity,
			createDto: CreateDevicePreviewTileDto,
			updateDto: UpdateDevicePreviewTileDto,
		});

		this.tileRelationsLoaderRegistryService.register(this.tileRelationsLoaderService);
	}
}
