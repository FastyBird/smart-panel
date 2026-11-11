import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { SpacesModule } from '../spaces/spaces.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import {
	AUTOMATIONS_MODULE_API_TAG_DESCRIPTION,
	AUTOMATIONS_MODULE_API_TAG_NAME,
	AUTOMATIONS_MODULE_NAME,
} from './automations.constants';
import { AUTOMATIONS_SWAGGER_EXTRA_MODELS } from './automations.openapi';
import { AutomationsController } from './controllers/automations.controller';
import { AutomationNodeTypesController } from './controllers/node-types.controller';
import { UpdateAutomationsConfigDto } from './dto/update-config.dto';
import { AutomationEntity } from './entities/automations.entity';
import { AutomationsConfigModel } from './models/config.model';
import { AutomationsSeederService } from './services/automations-seeder.service';
import { AutomationsService } from './services/automations.service';
import { AutomationsModuleResetService } from './services/module-reset.service';
import { AutomationNodeTypeRegistryService } from './services/node-type-registry.service';

@ApiTag({
	tagName: AUTOMATIONS_MODULE_NAME,
	displayName: AUTOMATIONS_MODULE_API_TAG_NAME,
	description: AUTOMATIONS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([AutomationEntity]), SpacesModule, SeedModule],
	controllers: [AutomationsController, AutomationNodeTypesController],
	providers: [
		// Core services
		AutomationsService,
		AutomationNodeTypeRegistryService,
		// Reset service
		AutomationsModuleResetService,
		// Seeder
		AutomationsSeederService,
	],
	exports: [AutomationsService, AutomationNodeTypeRegistryService, AutomationsModuleResetService],
})
export class AutomationsModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: AutomationsModuleResetService,
		private readonly moduleSeeder: AutomationsSeederService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit(): void {
		// Register seeder (priority 160 - right after scenes, which automations may refer to)
		this.seedRegistry.register(
			AUTOMATIONS_MODULE_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			160,
		);

		// Register module configuration mapping
		this.modulesMapperService.registerMapping<AutomationsConfigModel, UpdateAutomationsConfigDto>({
			type: AUTOMATIONS_MODULE_NAME,
			class: AutomationsConfigModel,
			configDto: UpdateAutomationsConfigDto,
		});

		// Register factory reset handler
		this.factoryResetRegistry.register(
			AUTOMATIONS_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			190, // Priority - automations refer to devices, spaces and scenes, so they are reset before them
		);

		// Register Swagger extra models
		for (const model of AUTOMATIONS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register module metadata for extensions discovery
		this.extensionsService.registerModuleMetadata({
			type: AUTOMATIONS_MODULE_NAME,
			name: 'Automations',
			description: 'Automations that make the home react on its own',
			author: 'FastyBird',
			readme: `# Automations

> Module · by FastyBird

Stores automations: graphs of *When / And / Then* blocks drawn on a canvas, which let the home react on its own to presence, light, time, temperature and alarms.

This module currently stores, validates and serves automations. Running them is not part of it yet.

## Features

- **Automation CRUD** — create, read, update and delete automations through the API
- **Graph as one document** — an automation keeps its whole canvas (nodes, their positions and configuration, and the edges wiring them) as one JSON document
- **Shape validation** — node and edge identifiers must be unique and every edge must connect two existing nodes
- **Node type registry** — modules and plugins register the node types ("cards") a graph can be built from; the catalogue is served to the editor
- **Graph validation** — every saved graph is checked against the registry: unknown node types and ports, edges into a trigger, cycles and duplicate edges are refused; an enabled automation also needs a trigger and a valid configuration on every node, while a disabled one can be kept as a draft
- **Safe concurrent editing** — every save carries the revision it was based on; a save based on a stale revision is refused instead of overwriting somebody else's change
- **Run modes** — \`single\`, \`restart\` (default) or \`parallel\`
- **Space assignment** — an automation can be assigned to a room or zone for filtering
- **Owner and admin only** — automations can be read and changed only by owners and admins
- **Factory reset & seed hooks** — registers itself with the platform reset / seed pipeline

## API Endpoints

- \`GET /api/v1/modules/automations/automations\` — list automations (without their graphs)
- \`POST /api/v1/modules/automations/automations\` — create an automation
- \`POST /api/v1/modules/automations/automations/validate\` — validate a graph without saving it
- \`GET /api/v1/modules/automations/node-types\` — list the registered node types
- \`GET /api/v1/modules/automations/automations/:id\` — read a single automation with its graph
- \`PATCH /api/v1/modules/automations/automations/:id\` — update an automation (requires the current revision)
- \`DELETE /api/v1/modules/automations/automations/:id\` — delete an automation`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
