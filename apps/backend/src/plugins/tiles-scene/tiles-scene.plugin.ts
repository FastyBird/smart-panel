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
			name: 'Scene Tiles',
			description: 'Dashboard tiles for displaying scene status and triggering scenes',
			author: 'FastyBird',
			readme: `# Scene Tiles Plugin

Dashboard tiles for displaying scene status and quick triggering.

## Features

- **Scene Status** - Show scene information on dashboard
- **Quick Trigger** - Trigger scenes directly from the tile
- **Status Icons** - Visual indicators for scene category
- **Last Triggered** - Show when the scene was last executed

## Tile Types

### Scene Tile
Compact scene display:
- Scene icon and name
- Category indicator
- Quick trigger button for triggerable scenes
- Last triggered timestamp

## Usage

Add scene tiles to dashboard pages for quick access to your most used scenes. Tap tiles to trigger the scene execution.

## Configuration

- Select the scene to display
- Choose a custom icon (optional)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
