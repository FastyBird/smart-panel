import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SpacesModule } from '../spaces/spaces.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';
import { WebsocketModule } from '../websocket/websocket.module';

import { SceneActionsController } from './controllers/scene-actions.controller';
import { ScenesController } from './controllers/scenes.controller';
import { UpdateScenesConfigDto } from './dto/update-config.dto';
import { SceneActionEntity, SceneEntity } from './entities/scenes.entity';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { ScenesConfigModel } from './models/config.model';
import { SCENES_MODULE_API_TAG_DESCRIPTION, SCENES_MODULE_API_TAG_NAME, SCENES_MODULE_NAME } from './scenes.constants';
import { SCENES_SWAGGER_EXTRA_MODELS } from './scenes.openapi';
import { ScenesModuleResetService } from './services/module-reset.service';
import { SceneActionsTypeMapperService } from './services/scene-actions-type-mapper.service';
import { SceneActionsService } from './services/scene-actions.service';
import { SceneExecutorService } from './services/scene-executor.service';
import { ScenesService } from './services/scenes.service';

@ApiTag({
	tagName: SCENES_MODULE_NAME,
	displayName: SCENES_MODULE_API_TAG_NAME,
	description: SCENES_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([SceneEntity, SceneActionEntity]),
		ConfigModule,
		ExtensionsModule,
		forwardRef(() => SystemModule),
		forwardRef(() => DevicesModule),
		forwardRef(() => SpacesModule),
		WebsocketModule,
	],
	controllers: [ScenesController, SceneActionsController],
	providers: [
		// Core services
		ScenesService,
		SceneActionsService,
		// Type mapper for plugin system (actions only)
		SceneActionsTypeMapperService,
		// Execution service
		SceneExecutorService,
		// Reset service
		ScenesModuleResetService,
		// WebSocket listener
		WebsocketExchangeListener,
	],
	exports: [
		ScenesService,
		SceneActionsService,
		SceneActionsTypeMapperService,
		SceneExecutorService,
		ScenesModuleResetService,
	],
})
export class ScenesModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: ScenesModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit(): void {
		// Register module configuration mapping
		this.modulesMapperService.registerMapping<ScenesConfigModel, UpdateScenesConfigDto>({
			type: SCENES_MODULE_NAME,
			class: ScenesConfigModel,
			configDto: UpdateScenesConfigDto,
		});

		// Register factory reset handler
		this.factoryResetRegistry.register(
			SCENES_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			300, // Priority - scenes should be reset after devices but before system data
		);

		// Register Swagger extra models
		for (const model of SCENES_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register module metadata for extensions discovery
		this.extensionsService.registerModuleMetadata({
			type: SCENES_MODULE_NAME,
			name: 'Scenes',
			description: 'Automation scenes for controlling multiple devices with a single trigger',
			author: 'FastyBird',
			readme: `# Scenes Module

The Scenes module provides automation capabilities for the Smart Panel, allowing you to control multiple devices with a single action.

## Features

- **Scene Management** - Create, edit, and delete automation scenes
- **Action Sequencing** - Define ordered sequences of device commands
- **Space Assignment** - Associate scenes with rooms or zones
- **Category Organization** - Categorize scenes (morning, evening, movie, etc.)
- **Trigger Support** - Execute scenes manually or via triggers
- **Plugin System** - Extensible action types through plugins

## How It Works

Scenes consist of one or more actions that are executed in sequence when the scene is triggered. Each action is handled by a registered plugin (e.g., local device control, third-party integrations).

## API Endpoints

- \`GET /v1/modules/scenes/scenes\` - List all scenes
- \`POST /v1/modules/scenes/scenes\` - Create a new scene
- \`GET /v1/modules/scenes/scenes/{id}\` - Get scene details
- \`PATCH /v1/modules/scenes/scenes/{id}\` - Update a scene
- \`DELETE /v1/modules/scenes/scenes/{id}\` - Delete a scene
- \`POST /v1/modules/scenes/scenes/{id}/trigger\` - Trigger scene execution`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
