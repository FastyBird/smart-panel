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
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ScenesModule } from '../../modules/scenes/scenes.module';
import { SceneExistsConstraintValidator } from '../../modules/scenes/validators/scene-exists-constraint.validator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateSceneTileDto } from './dto/create-tile.dto';
import { SceneUpdateConfigDto } from './dto/update-config.dto';
import { UpdateSceneTileDto } from './dto/update-tile.dto';
import { SceneTileEntity } from './entities/tiles-scene.entity';
import { SceneConfigModel } from './models/config.model';
import { TileRelationsLoaderService } from './services/tile-relations-loader.service';
import { TILES_SCENE_PLUGIN_NAME, TILES_SCENE_TYPE } from './tiles-scene.constants';
import { TILES_SCENE_PLUGIN_SWAGGER_EXTRA_MODELS } from './tiles-scene.openapi';

@Module({
	imports: [
		TypeOrmModule.forFeature([SceneTileEntity]),
		DashboardModule,
		ScenesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [TileRelationsLoaderService, SceneExistsConstraintValidator],
})
export class TilesScenePlugin {
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
		this.configMapper.registerMapping<SceneConfigModel, SceneUpdateConfigDto>({
			type: TILES_SCENE_PLUGIN_NAME,
			class: SceneConfigModel,
			configDto: SceneUpdateConfigDto,
		});

		this.tilesMapper.registerMapping<SceneTileEntity, CreateSceneTileDto, UpdateSceneTileDto>({
			type: TILES_SCENE_TYPE,
			class: SceneTileEntity,
			createDto: CreateSceneTileDto,
			updateDto: UpdateSceneTileDto,
		});

		this.tileRelationsLoaderRegistryService.register(this.tileRelationsLoaderService);

		for (const model of TILES_SCENE_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: TileEntity,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_SCENE_TYPE,
			modelClass: SceneTileEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_SCENE_TYPE,
			modelClass: CreateSceneTileDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateTileDto,
			discriminatorProperty: 'type',
			discriminatorValue: TILES_SCENE_TYPE,
			modelClass: UpdateSceneTileDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: TILES_SCENE_PLUGIN_NAME,
			name: 'Scene Tile',
			description: 'Dashboard tiles for displaying scene status and triggering scenes',
			author: 'FastyBird',
			readme: `# Scene Tile

> Plugin · by FastyBird · platform: dashboard tiles

Dashboard tile that surfaces a scene — shows its status and category and lets the user trigger it with a single tap. The fastest way to put your most-used routines (Movie, Goodnight, Away) one finger-press away.

## What you get

- One-tap access to any scene right from the dashboard, no menu diving
- Optimistic feedback — the tile shows the press happening immediately and updates with the real result the moment the backend confirms
- Visual grouping by category (morning, evening, …) so a single page can host a coherent "scenes" layout
- Last-run timestamp so it's clear when something actually fired

## Features

- **Scene status** — name, icon and category indicator
- **Quick trigger** — execute the bound scene directly from the tile, with progress / success / failure feedback
- **Custom icon** — override the scene's default icon per-tile when placed on a dashboard
- **Last triggered** — timestamp of the last execution, refreshed in real time
- **Per-action result** — when a scene's action partially fails, the tile surfaces a warning so the user knows to look

Each tile selects the scene to display and (optionally) a custom icon when placed on a dashboard — there is no global plugin configuration.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
