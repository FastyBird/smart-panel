import { Module } from '@nestjs/common';

import { DevicesModule } from '../../modules/devices/devices.module';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { CreateSceneActionDto } from '../../modules/scenes/dto/create-scene-action.dto';
import { CreateSceneDto } from '../../modules/scenes/dto/create-scene.dto';
import { UpdateSceneActionDto } from '../../modules/scenes/dto/update-scene-action.dto';
import { UpdateSceneDto } from '../../modules/scenes/dto/update-scene.dto';
import { SceneActionEntity, SceneEntity } from '../../modules/scenes/entities/scenes.entity';
import { ScenesModule } from '../../modules/scenes/scenes.module';
import { SceneActionsTypeMapperService } from '../../modules/scenes/services/scene-actions-type-mapper.service';
import { SceneExecutorService } from '../../modules/scenes/services/scene-executor.service';
import { ScenesTypeMapperService } from '../../modules/scenes/services/scenes-type-mapper.service';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateLocalSceneActionDto } from './dto/create-local-scene-action.dto';
import { UpdateLocalSceneActionDto } from './dto/update-local-scene-action.dto';
import { LocalSceneActionEntity } from './entities/scenes-local.entity';
import { LocalScenePlatform } from './platforms/local-scene.platform';
import { SCENES_LOCAL_PLUGIN_NAME, SCENES_LOCAL_TYPE } from './scenes-local.constants';

@Module({
	imports: [ScenesModule, DevicesModule, SpacesModule, SwaggerModule, ExtensionsModule],
	providers: [LocalScenePlatform],
	exports: [LocalScenePlatform],
})
export class ScenesLocalPlugin {
	constructor(
		private readonly scenesMapper: ScenesTypeMapperService,
		private readonly sceneActionsMapper: SceneActionsTypeMapperService,
		private readonly sceneExecutor: SceneExecutorService,
		private readonly localScenePlatform: LocalScenePlatform,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register scene type mapping for local scenes
		this.scenesMapper.registerMapping<SceneEntity, CreateSceneDto, UpdateSceneDto>({
			type: SCENES_LOCAL_TYPE,
			class: SceneEntity,
			createDto: CreateSceneDto,
			updateDto: UpdateSceneDto,
		});

		// Register scene action type mapping for local actions
		this.sceneActionsMapper.registerMapping<
			LocalSceneActionEntity,
			CreateLocalSceneActionDto,
			UpdateLocalSceneActionDto
		>({
			type: SCENES_LOCAL_TYPE,
			class: LocalSceneActionEntity,
			createDto: CreateLocalSceneActionDto,
			updateDto: UpdateLocalSceneActionDto,
		});

		// Register the local scenes platform with the executor
		this.sceneExecutor.registerPlatform(this.localScenePlatform);

		// Register discriminator mappings for OpenAPI
		this.discriminatorRegistry.register({
			parentClass: SceneEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SCENES_LOCAL_TYPE,
			modelClass: SceneEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateSceneDto,
			discriminatorProperty: 'type',
			discriminatorValue: SCENES_LOCAL_TYPE,
			modelClass: CreateSceneDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateSceneDto,
			discriminatorProperty: 'type',
			discriminatorValue: SCENES_LOCAL_TYPE,
			modelClass: UpdateSceneDto,
		});

		this.discriminatorRegistry.register({
			parentClass: SceneActionEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SCENES_LOCAL_TYPE,
			modelClass: LocalSceneActionEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateSceneActionDto,
			discriminatorProperty: 'type',
			discriminatorValue: SCENES_LOCAL_TYPE,
			modelClass: CreateLocalSceneActionDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateSceneActionDto,
			discriminatorProperty: 'type',
			discriminatorValue: SCENES_LOCAL_TYPE,
			modelClass: UpdateLocalSceneActionDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: SCENES_LOCAL_PLUGIN_NAME,
			name: 'Local Scenes',
			description: 'Execute scenes locally by controlling device properties',
			author: 'FastyBird',
			readme: `# Local Scenes Plugin

Plugin for executing scenes that control local device properties.

## Features

- **Device Control** - Set device property values when scene triggers
- **Action Validation** - Validates device, channel, and property exist
- **Permission Checking** - Ensures properties are writable before execution
- **Value Type Validation** - Checks value matches property data type

## How It Works

When a local scene is triggered:
1. Each action is validated for device/channel/property availability
2. Property write permissions are verified
3. Value type compatibility is checked
4. Commands are sent to devices through their platform handlers

## Action Structure

Each local scene action specifies:
- **deviceId** - Target device identifier
- **channelId** - Optional channel (auto-detected if omitted)
- **propertyId** - Property to modify
- **value** - New value (boolean, number, or string)

## Supported Value Types

- Boolean (bool, boolean)
- Numbers (int, uint, float, short, ushort, char, uchar)
- Strings
- Enums (validated against allowed format values)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
