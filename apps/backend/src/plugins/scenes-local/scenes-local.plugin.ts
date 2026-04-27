import { Module, OnModuleInit } from '@nestjs/common';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { CreateSceneActionDto } from '../../modules/scenes/dto/create-scene-action.dto';
import { UpdateSceneActionDto } from '../../modules/scenes/dto/update-scene-action.dto';
import { SceneActionEntity } from '../../modules/scenes/entities/scenes.entity';
import { ScenesModule } from '../../modules/scenes/scenes.module';
import { SceneActionsTypeMapperService } from '../../modules/scenes/services/scene-actions-type-mapper.service';
import { SceneExecutorService } from '../../modules/scenes/services/scene-executor.service';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateLocalSceneActionDto } from './dto/create-local-scene-action.dto';
import { ScenesLocalUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateLocalSceneActionDto } from './dto/update-local-scene-action.dto';
import { LocalSceneActionEntity } from './entities/scenes-local.entity';
import { ScenesLocalConfigModel } from './models/config.model';
import { LocalScenePlatform } from './platforms/local-scene.platform';
import { SCENES_LOCAL_PLUGIN_NAME, SCENES_LOCAL_TYPE } from './scenes-local.constants';
import { SCENES_LOCAL_PLUGIN_SWAGGER_EXTRA_MODELS } from './scenes-local.openapi';

@Module({
	imports: [ScenesModule, DevicesModule, SpacesModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [LocalScenePlatform],
	exports: [LocalScenePlatform],
})
export class ScenesLocalPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly sceneActionsMapper: SceneActionsTypeMapperService,
		private readonly sceneExecutor: SceneExecutorService,
		private readonly localScenePlatform: LocalScenePlatform,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register plugin configuration mapping
		this.configMapper.registerMapping<ScenesLocalConfigModel, ScenesLocalUpdatePluginConfigDto>({
			type: SCENES_LOCAL_PLUGIN_NAME,
			class: ScenesLocalConfigModel,
			configDto: ScenesLocalUpdatePluginConfigDto,
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

		// Register Swagger extra models
		for (const model of SCENES_LOCAL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminator mappings for OpenAPI
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
			readme: `# Local Scenes

> Plugin · by FastyBird · platform: scenes

Scene-action provider that drives local device properties — when a scene is triggered, each action sets a property on a target device managed by this Smart Panel installation. Validates device / channel / property existence, write permissions and value-type compatibility before issuing any commands.

## What you get

- A first-class way to bundle multiple local device changes into one scene with full validation — the scene either references real, writable things or it never gets saved
- Predictable execution: every action returns its own success / failure result so partial failures are visible to the caller (panel, admin UI or Buddy)
- Type safety: a scene that tries to push a string into a numeric switch is rejected at create / update time, not at run time
- Channel auto-detection so you don't need to memorise channel IDs when a device only has one matching channel

## Action Structure

Each local scene action specifies:

- \`device_id\` — target device
- \`channel_id\` — optional channel (auto-detected when the device has a single matching channel)
- \`property_id\` — property to modify
- \`value\` — new value (boolean, number, string or enum)

## Behaviour

- **Validation up front** — the action is checked at scene save time, not at trigger time, so broken scenes are caught early
- **Permission-aware** — read-only properties are rejected with a clear error
- **Sequential execution** — actions run in declared order; later actions still run even if an earlier one fails, but the overall scene reports a partial-failure status
- **Optimistic feedback** — uses the standard intent layer so panel UIs reflect the change instantly

## Supported Value Types

Boolean (\`bool\`, \`boolean\`), numbers (\`int\`, \`uint\`, \`float\`, \`short\`, \`ushort\`, \`char\`, \`uchar\`), strings, and enums (validated against allowed format values).`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
