import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreateTileDto } from '../../modules/dashboard/dto/create-tile.dto';
import { UpdateTileDto } from '../../modules/dashboard/dto/update-tile.dto';
import { TileEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateTimeTileDto } from './dto/create-tile.dto';
import { TimeUpdateConfigDto } from './dto/update-config.dto';
import { UpdateTimeTileDto } from './dto/update-tile.dto';
import { TimeTileEntity } from './entities/tiles-time.entity';
import { TimeConfigModel } from './models/config.model';
import { TILES_TIME_PLUGIN_NAME, TILES_TIME_TYPE } from './tiles-time.constants';
import { TILES_TIME_PLUGIN_SWAGGER_EXTRA_MODELS } from './tiles-time.openapi';

@Module({
	imports: [TypeOrmModule.forFeature([TimeTileEntity]), DashboardModule, ConfigModule, ExtensionsModule, SwaggerModule],
})
export class TilesTimePlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly tilesMapper: TilesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<TimeConfigModel, TimeUpdateConfigDto>({
			type: TILES_TIME_PLUGIN_NAME,
			class: TimeConfigModel,
			configDto: TimeUpdateConfigDto,
		});

		this.tilesMapper.registerMapping<TimeTileEntity, CreateTimeTileDto, UpdateTimeTileDto>({
			type: TILES_TIME_TYPE,
			class: TimeTileEntity,
			createDto: CreateTimeTileDto,
			updateDto: UpdateTimeTileDto,
		});

		for (const model of TILES_TIME_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: TileEntity,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_TIME_TYPE,
			modelClass: TimeTileEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_TIME_TYPE,
			modelClass: CreateTimeTileDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_TIME_TYPE,
			modelClass: UpdateTimeTileDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: TILES_TIME_PLUGIN_NAME,
			name: 'Time Tiles',
			description: 'Dashboard tiles for displaying time and date',
			author: 'FastyBird',
			readme: `# Time Tiles Plugin

Dashboard tiles for displaying current time and date.

## Features

- **Digital Clock** - Display current time in various formats
- **Date Display** - Show current date with customizable formatting
- **Timezone Support** - Display time for different timezones
- **Auto-Update** - Real-time clock updates

## Tile Types

### Time Tile
Displays the current time with configurable:
- 12/24 hour format
- Show/hide seconds
- Custom time format strings

## Usage

Add a time tile to any dashboard page to display the current time. The tile updates automatically without requiring page refresh.

## Styling

The time display adapts to the tile size and supports both light and dark themes.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
