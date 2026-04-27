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
			name: 'Clock Tile',
			description: 'Dashboard tiles for displaying time and date',
			author: 'FastyBird',
			readme: `# Clock Tile

> Plugin · by FastyBird · platform: dashboard tiles

Dashboard tile that displays the current time and date with live updates — the simplest way to turn a panel into a glanceable clock without dedicating a whole page to it.

## What you get

- A clean, always-correct clock on any dashboard page
- Per-tile timezone — drop two clock tiles on the same page to show home time and a remote office time at once
- Live updates without polling — the panel renders the next minute as soon as it ticks

## Features

- **Digital clock** — 12 or 24-hour format, optional seconds, optional AM / PM marker
- **Date display** — customisable date format (full, short, weekday-only, …)
- **Timezone aware** — render time for any IANA timezone independently of the host's clock
- **Auto-update** — re-renders without reloading the page; respects the panel's reduced-motion settings

Appearance and timezone are configured per tile when placed on a dashboard — there is no global plugin configuration.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
