import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import {
	ListServicesCommand,
	RestartServiceCommand,
	StartServiceCommand,
	StopServiceCommand,
} from './commands/services.command';
import { ActionsController } from './controllers/actions.controller';
import { DiscoveredExtensionsController } from './controllers/discovered-extensions.controller';
import { ExtensionsController } from './controllers/extensions.controller';
import { ServicesController } from './controllers/services.controller';
import { UpdateExtensionsConfigDto } from './dto/update-config.dto';
import {
	EXTENSIONS_MODULE_API_TAG_DESCRIPTION,
	EXTENSIONS_MODULE_API_TAG_NAME,
	EXTENSIONS_MODULE_NAME,
} from './extensions.constants';
import { EXTENSIONS_SWAGGER_EXTRA_MODELS } from './extensions.openapi';
import { ExtensionsConfigModel } from './models/config.model';
import { ExtensionsStatsProvider } from './providers/extensions-stats.provider';
import { ActionAuditService } from './services/action-audit.service';
import { ExtensionActionRegistryService } from './services/extension-action-registry.service';
import { ExtensionsService } from './services/extensions.service';
import { ModuleResetService } from './services/module-reset.service';
import { PluginServiceManagerService } from './services/plugin-service-manager.service';

@ApiTag({
	tagName: EXTENSIONS_MODULE_NAME,
	displayName: EXTENSIONS_MODULE_API_TAG_NAME,
	description: EXTENSIONS_MODULE_API_TAG_DESCRIPTION,
})
@Global()
@Module({
	imports: [NestConfigModule, StatsModule],
	controllers: [ExtensionsController, DiscoveredExtensionsController, ServicesController, ActionsController],
	providers: [
		ModuleResetService,
		PluginServiceManagerService,
		ExtensionActionRegistryService,
		ActionAuditService,
		ExtensionsStatsProvider,
		// CLI commands
		ListServicesCommand,
		StartServiceCommand,
		StopServiceCommand,
		RestartServiceCommand,
	],
	exports: [PluginServiceManagerService, ExtensionActionRegistryService, ActionAuditService],
})
export class ExtensionsModule implements OnModuleInit {
	constructor(
		private readonly extensionsService: ExtensionsService,
		private readonly moduleReset: ModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly extensionsStatsProvider: ExtensionsStatsProvider,
	) {}

	onModuleInit() {
		// Register configuration mapping
		this.modulesMapperService.registerMapping<ExtensionsConfigModel, UpdateExtensionsConfigDto>({
			type: EXTENSIONS_MODULE_NAME,
			class: ExtensionsConfigModel,
			configDto: UpdateExtensionsConfigDto,
		});

		// Register factory reset handler
		this.factoryResetRegistry.register(EXTENSIONS_MODULE_NAME, () => this.moduleReset.reset(), 50);

		// Register stats provider for Prometheus metrics
		this.statsRegistryService.register(EXTENSIONS_MODULE_NAME, this.extensionsStatsProvider);

		// Register Swagger models
		for (const model of EXTENSIONS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata for this module
		this.extensionsService.registerModuleMetadata({
			type: EXTENSIONS_MODULE_NAME,
			name: 'Extensions',
			description: 'Manage application modules and plugins',
			author: 'FastyBird',
			readme: `# Extensions

> Module · by FastyBird

Provides a unified interface for discovering, enabling, disabling and inspecting every module and plugin registered with the Smart Panel backend. This is what the admin UI's "Extensions" page is built on, and what the rest of the system uses to find out which optional features are actually available.

## What it gives you

- One catalogue of everything plugged into the backend, with consistent metadata (name, description, author, version, README, links)
- A safe enable / disable surface — toggling a plugin re-validates dependencies (e.g. don't disable the storage backend that's currently in use)
- A service control plane for plugins that run long-lived workers, so the admin can start / stop / restart them without restarting the whole backend
- An action audit log so you can see *who* enabled / disabled / restarted what, and when

## Features

- **Extension discovery** — enumerates all registered modules and plugins at runtime; the catalogue is built from in-process metadata so it is always exact
- **Rich metadata** — exposes name, description, author, version, type, default-enabled flag, capabilities, links and the rendered README to the admin UI
- **Enable / disable** — toggles plugins (and configurable modules) on or off via configuration; the relevant module is notified live so the change takes effect without a restart wherever possible
- **Dependency awareness** — refuses to disable a plugin that another active component currently depends on (e.g. the selected storage backend) and reports why
- **Service control** — start, stop and restart long-running plugin services; useful for plugins that connect to external systems where reconnect can fix transient issues
- **Action audit** — every enable / disable / service action is recorded with the actor and timestamp; available through the API and CLI
- **Capability registry** — plugins advertise capabilities (\`tts\`, \`stt\`, \`llm\`, \`messaging\`, …) so other modules can pick a provider by capability instead of hard-coded type

## API Endpoints

- \`GET /api/v1/modules/extensions\` — list all extensions
- \`GET /api/v1/modules/extensions/:type\` — get a single extension
- \`PATCH /api/v1/modules/extensions/:type\` — enable or disable an extension
- \`GET /api/v1/modules/extensions/services\` — list managed plugin services
- \`POST /api/v1/modules/extensions/services/:type/{start|stop|restart}\` — control a plugin service

## CLI Commands

- \`pnpm run cli services:list\` — list managed plugin services
- \`pnpm run cli services:start <type>\` — start a service
- \`pnpm run cli services:stop <type>\` — stop a service
- \`pnpm run cli services:restart <type>\` — restart a service`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
