import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreateTileDto } from '../../modules/dashboard/dto/create-tile.dto';
import { UpdateTileDto } from '../../modules/dashboard/dto/update-tile.dto';
import { TileEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { TileRelationsLoaderRegistryService } from '../../modules/dashboard/services/tile-relations-loader-registry.service';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateDevicePreviewTileDto } from './dto/create-tile.dto';
import { DevicePreviewUpdateConfigDto } from './dto/update-config.dto';
import { UpdateDevicePreviewTileDto } from './dto/update-tile.dto';
import { DevicePreviewTileEntity } from './entities/tiles-device-preview.entity';
import { DevicePreviewConfigModel } from './models/config.model';
import { TileRelationsLoaderService } from './services/tile-relations-loader.service';
import { TILES_DEVICE_PREVIEW_PLUGIN_NAME, TILES_DEVICE_PREVIEW_TYPE } from './tiles-device-preview.constants';
import { TILES_DEVICE_PREVIEW_PLUGIN_SWAGGER_EXTRA_MODELS } from './tiles-device-preview.openapi';

@Module({
	imports: [
		TypeOrmModule.forFeature([DevicePreviewTileEntity]),
		DashboardModule,
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [TileRelationsLoaderService],
})
export class TilesDevicePreviewPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly tilesMapper: TilesTypeMapperService,
		private readonly tileRelationsLoaderRegistryService: TileRelationsLoaderRegistryService,
		private readonly tileRelationsLoaderService: TileRelationsLoaderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<DevicePreviewConfigModel, DevicePreviewUpdateConfigDto>({
			type: TILES_DEVICE_PREVIEW_PLUGIN_NAME,
			class: DevicePreviewConfigModel,
			configDto: DevicePreviewUpdateConfigDto,
		});

		this.tilesMapper.registerMapping<DevicePreviewTileEntity, CreateDevicePreviewTileDto, UpdateDevicePreviewTileDto>({
			type: TILES_DEVICE_PREVIEW_TYPE,
			class: DevicePreviewTileEntity,
			createDto: CreateDevicePreviewTileDto,
			updateDto: UpdateDevicePreviewTileDto,
		});

		this.tileRelationsLoaderRegistryService.register(this.tileRelationsLoaderService);

		for (const model of TILES_DEVICE_PREVIEW_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: TileEntity,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_DEVICE_PREVIEW_TYPE,
			modelClass: DevicePreviewTileEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_DEVICE_PREVIEW_TYPE,
			modelClass: CreateDevicePreviewTileDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_DEVICE_PREVIEW_TYPE,
			modelClass: UpdateDevicePreviewTileDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: TILES_DEVICE_PREVIEW_PLUGIN_NAME,
			name: 'Device Preview Tiles',
			description: 'Dashboard tiles for displaying device status preview',
			author: 'FastyBird',
			readme: `# Device Preview Tiles Plugin

Dashboard tiles for displaying device status and quick controls.

## Features

- **Device Status** - Show real-time device status on dashboard
- **Quick Controls** - Toggle devices directly from the tile
- **Status Icons** - Visual indicators for device state
- **Multi-Property Display** - Show multiple device properties

## Tile Types

### Device Preview Tile
Compact device status display:
- Device icon and name
- Primary property value (e.g., on/off state)
- Quick action button for controllable devices
- Connection status indicator

## Usage

Add device preview tiles to dashboard pages for at-a-glance monitoring of your most important devices. Tap tiles to toggle state or view details.

## Configuration

- Select the device to display
- Choose which property to show as primary
- Enable/disable quick control button`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
