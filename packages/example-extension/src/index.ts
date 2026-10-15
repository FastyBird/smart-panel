import { ExtensionsService, PluginsTypeMapperService } from '@fastybird/smart-panel-backend';
import { ExampleExtensionConfigModel } from './models/config.model.js';
import { ExampleExtensionUpdateConfigDto } from './dto/update-config.dto.js';
import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ExampleController } from './example.controller.js';
import { ExampleService } from './example.service.js';
import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';

export { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
export { ExampleService } from './example.service.js';

/**
 * Example Extension Module
 *
 * This module demonstrates how to create a custom extension for Smart Panel.
 * It's intentionally minimal to avoid circular dependency issues.
 *
 * Discovery loads the Nest module; the module explicitly registers its config owner.
 */
@Module({
	controllers: [ExampleController],
	providers: [ExampleService],
})
export class ExampleExtensionModule implements OnModuleInit {
	constructor(private readonly configs: PluginsTypeMapperService, private readonly extensions: ExtensionsService) {}

	private readonly logger = new Logger(ExampleExtensionModule.name);

	onModuleInit() {
		this.configs.registerMapping({ type: EXAMPLE_EXTENSION_PLUGIN_NAME, class: ExampleExtensionConfigModel, configDto: ExampleExtensionUpdateConfigDto });
		this.extensions.registerPluginMetadata({ type: EXAMPLE_EXTENSION_PLUGIN_NAME, packageName: '@fastybird/smart-panel-extension-example', name: 'Example Extension', defaultEnabled: false });
		this.logger.log(`[EXAMPLE EXTENSION] ${EXAMPLE_EXTENSION_PLUGIN_NAME} initialized`);
	}
}

export { exampleNumericOperators } from './numeric-operators.js';

export { ExampleExtensionConfigModel } from './models/config.model.js';
export { ExampleExtensionUpdateConfigDto } from './dto/update-config.dto.js';
