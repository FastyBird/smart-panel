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
			name: 'Device Preview Tile',
			description: 'Dashboard tiles for displaying device status preview',
			author: 'FastyBird',
			readme: `# Device Preview Tile

> Plugin · by FastyBird · platform: dashboard tiles

Compact dashboard tile that surfaces the live status of a device with optional one-tap control — the workhorse tile of any dashboard, suitable for everything from a single switch to a temperature sensor.

## What you get

- A standardised, glanceable view of any device's most relevant value with the panel's optimistic-UI guarantees baked in
- Per-tile choice of *primary* property so the tile shows what matters for that device (a switch's on / off, a sensor's temperature, a power meter's current draw)
- Optional *secondary* properties so a single tile can convey "is the AC running, what's the room temperature, what's the set-point" at one glance
- One-tap control on writable primary properties without dropping the user into a detail page

## Features

- **Live status** — real-time updates of the selected primary property over WebSocket
- **Quick control** — toggle controllable devices directly from the tile; the optimistic UI means feedback is instant
- **Status icon** — connection / state indicator turns the tile into a connectivity dashboard at a glance
- **Multi-property** — render additional secondary properties under the primary value
- **Unit-aware** — values are rendered with the unit declared by the device's property
- **Tap-through** — tapping the tile body opens the device detail page when present, the property dialog otherwise

Each tile selects its target device and primary property when placed on a dashboard — there is no global plugin configuration.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
