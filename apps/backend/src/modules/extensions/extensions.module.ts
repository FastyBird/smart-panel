import { Global, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import {
	ListServicesCommand,
	RestartServiceCommand,
	StartServiceCommand,
	StopServiceCommand,
} from './commands/services.command';
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
import { ExtensionsBundledService } from './services/extensions-bundled.service';
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
	imports: [NestConfigModule, forwardRef(() => ConfigModule), forwardRef(() => SystemModule)],
	controllers: [ExtensionsController, DiscoveredExtensionsController, ServicesController],
	providers: [
		ExtensionsBundledService,
		ExtensionsService,
		ModuleResetService,
		PluginServiceManagerService,
		// CLI commands
		ListServicesCommand,
		StartServiceCommand,
		StopServiceCommand,
		RestartServiceCommand,
	],
	exports: [ExtensionsBundledService, ExtensionsService, PluginServiceManagerService],
})
export class ExtensionsModule implements OnModuleInit {
	constructor(
		private readonly extensionsService: ExtensionsService,
		private readonly moduleReset: ModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
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
			readme: `# Extensions Module

The Extensions module provides a unified interface for discovering and managing all modules and plugins in the Smart Panel application.

## Features

- **Extension Discovery** - Automatically discovers all registered modules and plugins
- **Metadata Management** - Stores extension information like name, description, author
- **Enable/Disable** - Toggle plugin functionality on and off
- **Configuration** - Access extension-specific configuration options

## Extension Types

### Modules
Core functionality providers that cannot be uninstalled:
- Devices, Dashboard, Users, Weather, Auth, etc.

### Plugins
Optional add-ons that extend functionality:
- Device integrations (Shelly, Home Assistant)
- Dashboard tiles (time, weather)
- Data sources for tiles
- Weather providers

## For Developers

Extensions register their metadata during module initialization using the \`ExtensionsService\`:

\`\`\`typescript
this.extensionsService.registerModuleMetadata({
  type: 'my-module',
  name: 'My Module',
  description: 'Module description',
  author: 'Author Name',
});
\`\`\``,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
