import { join } from 'path';

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../extensions/services/managed-service-manager.service';
import { ScenesModule } from '../scenes/scenes.module';
import { SecurityModule } from '../security/security.module';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { SpacesModule } from '../spaces/spaces.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { ToolProviderRegistryService } from '../tools/services/tool-provider-registry.service';
import { ToolsModule } from '../tools/tools.module';
import { WebsocketModule } from '../websocket/websocket.module';

import {
	AUTOMATIONS_MODULE_API_TAG_DESCRIPTION,
	AUTOMATIONS_MODULE_API_TAG_NAME,
	AUTOMATIONS_MODULE_NAME,
} from './automations.constants';
import { AUTOMATIONS_SWAGGER_EXTRA_MODELS } from './automations.openapi';
import { AutomationsController } from './controllers/automations.controller';
import { AutomationNodeTypesController } from './controllers/node-types.controller';
import { AutomationRunsController } from './controllers/runs.controller';
import { AutomationTemplatesController } from './controllers/templates.controller';
import { UpdateAutomationsConfigDto } from './dto/update-config.dto';
import { AutomationRunEntity } from './entities/automation-runs.entity';
import { AutomationEntity } from './entities/automations.entity';
import { DisplayExchangeListener } from './listeners/display-exchange.listener';
import { ReferenceCleanupListener } from './listeners/reference-cleanup.listener';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { AutomationsConfigModel } from './models/config.model';
import { AutomationBuiltInNodeTypesService } from './nodes/built-in-node-types.service';
import { AutomationEngineService } from './services/automation-engine.service';
import { AutomationRunHistoryService } from './services/automation-run-history.service';
import { AutomationRunService } from './services/automation-run.service';
import { AutomationSafetyService } from './services/automation-safety.service';
import { AutomationToolService } from './services/automation-tool.service';
import { AutomationsSeederService } from './services/automations-seeder.service';
import { AutomationsService } from './services/automations.service';
import { AutomationEventSourceService } from './services/event-source.service';
import { AutomationsModuleResetService } from './services/module-reset.service';
import { AutomationNodeTypeRegistryService } from './services/node-type-registry.service';
import { AutomationStateTrackerService } from './services/state-tracker.service';
import { AutomationTimeSourceService } from './services/time-source.service';
import { AUTOMATION_TEMPLATES_LOCATIONS, AutomationTemplatesService } from './templates/automation-templates.service';

@ApiTag({
	tagName: AUTOMATIONS_MODULE_NAME,
	displayName: AUTOMATIONS_MODULE_API_TAG_NAME,
	description: AUTOMATIONS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([AutomationEntity, AutomationRunEntity]),
		NestConfigModule,
		DevicesModule,
		SpacesModule,
		ScenesModule,
		SecurityModule,
		ToolsModule,
		WebsocketModule,
		SeedModule,
	],
	controllers: [
		AutomationsController,
		AutomationNodeTypesController,
		AutomationRunsController,
		AutomationTemplatesController,
	],
	providers: [
		// Core services
		AutomationsService,
		AutomationNodeTypeRegistryService,
		AutomationStateTrackerService,
		AutomationTimeSourceService,
		AutomationEventSourceService,
		AutomationRunHistoryService,
		AutomationRunService,
		AutomationSafetyService,
		AutomationEngineService,
		// Buddy / MCP tools
		AutomationToolService,
		// Built-in cards
		AutomationBuiltInNodeTypesService,
		// Templates
		{
			provide: AUTOMATION_TEMPLATES_LOCATIONS,
			useValue: {
				builtinDirectory: join(__dirname, 'templates/definitions'),
				schemaPath: join(__dirname, 'templates/schema/automation-templates.schema.json'),
			},
		},
		AutomationTemplatesService,
		// Listeners
		ReferenceCleanupListener,
		WebsocketExchangeListener,
		DisplayExchangeListener,
		// Reset service
		AutomationsModuleResetService,
		// Seeder
		AutomationsSeederService,
	],
	exports: [
		AutomationsService,
		AutomationNodeTypeRegistryService,
		AutomationStateTrackerService,
		AutomationTimeSourceService,
		AutomationEngineService,
		AutomationSafetyService,
		AutomationsModuleResetService,
	],
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
		private readonly nodeTypeRegistry: AutomationNodeTypeRegistryService,
		private readonly builtInNodeTypes: AutomationBuiltInNodeTypesService,
		private readonly managedServiceManager: ManagedServiceManagerService,
		private readonly engine: AutomationEngineService,
		private readonly safety: AutomationSafetyService,
		private readonly templates: AutomationTemplatesService,
		private readonly toolProviderRegistry: ToolProviderRegistryService,
		private readonly automationTool: AutomationToolService,
	) {}

	async onModuleInit(): Promise<void> {
		// Register the node types the module itself provides
		for (const nodeType of this.builtInNodeTypes.create()) {
			this.nodeTypeRegistry.register(nodeType);
		}

		// Templates are checked against the node types, so they are loaded once the module registered its own
		await this.templates.load();

		// No action of any run is executed before the safety policy let it through
		this.engine.setActionPolicy(this.safety.checkAction);

		// Register the engine with the central service manager
		this.managedServiceManager.register(this.engine);

		// Let Buddy and MCP clients list, run and switch automations on or off; no tool edits a graph
		this.toolProviderRegistry.register(this.automationTool);

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

The module stores, validates and runs automations. It provides the first set of blocks itself — device, time, sun, scene, notification, house mode, security and automation cards and the flow blocks; plugins register further ones.

## Features

- **Automation CRUD** — create, read, update and delete automations through the API
- **Graph as one document** — an automation keeps its whole canvas (nodes, their positions and configuration, and the edges wiring them) as one JSON document
- **Shape validation** — node and edge identifiers must be unique and every edge must connect two existing nodes
- **Node type registry** — modules and plugins register the node types ("cards") a graph can be built from; the catalogue is served to the editor
- **Graph validation** — every saved graph is checked against the registry: unknown node types and ports, edges into a trigger, cycles and duplicate edges are refused; an enabled automation also needs a trigger and a valid configuration on every node, while a disabled one can be kept as a draft
- **Safety** — an automation may lock, arm and close, but it can not unlock a lock, disarm the alarm or open a door, garage or gate: such a value is refused when the automation is saved and again before every write, and a scene that would do it is not run by an automation at all
- **Safe concurrent editing** — every save carries the revision it was based on; a save based on a stale revision is refused instead of overwriting somebody else's change
- **Engine** — a managed service that watches the triggers of every enabled automation and walks its graph when one fires: several edges from one output run in parallel, conditions continue on \`yes\` or \`no\`, actions on \`done\` or \`error\`, a Delay parks the run for up to one hour
- **Built-in blocks** — *When*: a device value changes (to / from / any, above / below a threshold, optionally only after it stayed there for a time), a button is pressed (any press or the chosen ones), a device goes offline or online, a time of day on chosen weekdays, sunrise or sunset, a scene was run, the house mode changes, the security state changes (armed state or alarm state), a manual start. *And*: a device value compares as asked, the time is inside a window (which may cross midnight), day or night, the house mode is, the alarm is armed. *Then*: set device values (values of one device are applied together), run a scene, send a notification, set the house mode, arm the alarm (never disarm it), enable, disable or run another automation
- **House time** — time blocks use the house timezone and share one minute tick; a time missed while the backend was down is not replayed, and nothing depending on the time runs before the system clock is set
- **Unknown is not true** — a condition on a value that is missing, invalid or belongs to an offline device continues on \`no\`, with the reason recorded
- **Run modes** — \`single\` ignores a trigger while a run is active, \`restart\` (default) cancels every active run and starts again, \`parallel\` lets up to 10 runs overlap
- **Overload guard** — an automation that starts more than 30 times a minute or 200 times an hour is suspended and a notification is raised; saving or enabling it again resumes it
- **Self-checking status** — an automation is marked \`invalid\` and stopped when a device, property, scene or space it refers to is removed, or when one of its block types is no longer available
- **Manual run** — an automation can be started by hand through the API or the \`AutomationsModule.TriggerAutomation\` websocket command
- **Buddy and MCP tools** — \`list_automations\`, \`run_automation\` and \`set_automation_enabled\` let Buddy and MCP clients (with the \`read\`, \`trigger\` and \`write\` capability) list automations, run one by hand and switch one on or off. No tool creates, edits or deletes an automation or exposes its graph
- **Run history** — every run leaves a record with its trace: what started it, the blocks it reached, the output each took, the value each condition saw and what each action answered. The last 50 runs of an automation are kept, for at most 30 days
- **Interrupted runs stay visible** — a run waiting on a Delay is stored as \`running\`; when the backend restarts or loses power before it ends, it is shown as \`interrupted\`, which tells why a delayed action never happened
- **Live runs** — \`AutomationsModule.Run.Started\` and \`AutomationsModule.Run.Completed\` are announced to owners and admins; the steps of a run (\`AutomationsModule.Run.Step\`) are sent only to the clients that watch that automation with the \`AutomationsModule.WatchAutomation\` websocket command
- **Templates** — the common automations (motion light, door open reminder, away heating setback, leak alarm) are created from a few questions instead of a blank canvas. Templates are YAML definition files; your own are YAML files named \`module.automations.*.yaml\` in the configuration directory (or every \`*.yaml\` file under \`FB_AUTOMATIONS_TEMPLATES_PATH\` when it is set), and a template with the same ID replaces the built-in one. A template generates an ordinary graph that keeps no link to the template
- **Space assignment** — an automation can be assigned to a room or zone for filtering
- **Owner and admin only** — automations can be read and changed only by owners and admins
- **Factory reset & seed hooks** — registers itself with the platform reset / seed pipeline

## API Endpoints

- \`GET /api/v1/modules/automations/automations\` — list automations (without their graphs)
- \`POST /api/v1/modules/automations/automations\` — create an automation
- \`POST /api/v1/modules/automations/automations/validate\` — validate a graph without saving it
- \`GET /api/v1/modules/automations/node-types\` — list the registered node types
- \`GET /api/v1/modules/automations/templates\` — list the automation templates
- \`POST /api/v1/modules/automations/templates/:id/generate\` — generate the draft of a new automation from a template and the answers to its questions, without storing anything
- \`GET /api/v1/modules/automations/automations/:id\` — read a single automation with its graph
- \`PATCH /api/v1/modules/automations/automations/:id\` — update an automation (requires the current revision)
- \`DELETE /api/v1/modules/automations/automations/:id\` — delete an automation
- \`POST /api/v1/modules/automations/automations/:id/trigger\` — run an automation by hand
- \`GET /api/v1/modules/automations/automations/:id/runtime\` — read what the engine holds for an automation
- \`GET /api/v1/modules/automations/automations/:id/runs\` — list the stored runs of an automation, newest first
- \`GET /api/v1/modules/automations/runs/:runId\` — read a single run with its trace`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
