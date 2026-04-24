import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { IntentsModule } from '../intents/intents.module';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { SpacesModule } from '../spaces/spaces.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { ToolProviderRegistryService } from '../tools/services/tool-provider-registry.service';
import { ToolsModule } from '../tools/tools.module';
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
import { SceneToolService } from './services/scene-tool.service';
import { ScenesSeederService } from './services/scenes-seeder.service';
import { ScenesService } from './services/scenes.service';
import { SceneExistsConstraintValidator } from './validators/scene-exists-constraint.validator';

@ApiTag({
	tagName: SCENES_MODULE_NAME,
	displayName: SCENES_MODULE_API_TAG_NAME,
	description: SCENES_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([SceneEntity, SceneActionEntity]),
		DevicesModule,
		SpacesModule,
		IntentsModule,
		ToolsModule,
		WebsocketModule,
		SeedModule,
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
		// Validators
		SceneExistsConstraintValidator,
		// Seeder
		ScenesSeederService,
		// Tool provider
		SceneToolService,
	],
	exports: [
		ScenesService,
		SceneActionsService,
		SceneActionsTypeMapperService,
		SceneExecutorService,
		ScenesModuleResetService,
		SceneExistsConstraintValidator,
	],
})
export class ScenesModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: ScenesModuleResetService,
		private readonly moduleSeeder: ScenesSeederService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
		private readonly toolProviderRegistry: ToolProviderRegistryService,
		private readonly sceneTool: SceneToolService,
	) {}

	onModuleInit(): void {
		// Register scene tool provider
		this.toolProviderRegistry.register(this.sceneTool);
		// Register seeder (priority 150 - after spaces, before dashboard)
		this.seedRegistry.register(
			SCENES_MODULE_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			150,
		);

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
			description: 'Scenes for controlling multiple devices with a single action',
			author: 'FastyBird',
			readme: `# Scenes

> Module · by FastyBird

Lets you control many devices at once with a single action — the building block for shortcuts like *Movie Mode*, *Good Night*, *Away* or *Wake-up*. A scene bundles an ordered list of actions; triggering the scene runs every action in sequence and reports per-action status back to the caller.

## Features

- **Scene CRUD** — create, edit, reorder and delete scenes through the API or the admin UI
- **Ordered action lists** — actions execute in declared order; each action returns its own success / failure result so partial failures are visible
- **Space assignment** — bind a scene to a specific room or zone so the panel can surface it where it's relevant
- **Categorization & icons** — pick a category (morning, evening, movie, …) and an icon so scenes group nicely on the panel home screen
- **Multi-trigger** — execute scenes manually from the admin UI, from a panel tile, via REST, from a Buddy chat, or as a step inside another automation
- **Plugin-based actions** — action *types* are pluggable; the module ships a registry that lets plugins add new action kinds (for example controlling local devices, calling an external service, sending a notification, …)
- **Validation** — every action references existing devices / channels / properties; the API rejects scenes that point at things that don't exist
- **Factory reset & seed hooks** — registers itself with the platform reset / seed pipeline so demo scenes and full wipes behave consistently

## API Endpoints

- \`GET /api/v1/modules/scenes/scenes\` — list scenes (with their actions)
- \`POST /api/v1/modules/scenes/scenes\` — create a scene
- \`GET /api/v1/modules/scenes/scenes/:id\` — read a single scene
- \`PATCH /api/v1/modules/scenes/scenes/:id\` — update a scene (metadata or actions)
- \`DELETE /api/v1/modules/scenes/scenes/:id\` — delete a scene
- \`POST /api/v1/modules/scenes/scenes/:id/trigger\` — execute a scene and receive per-action results`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
