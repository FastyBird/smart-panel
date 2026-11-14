import {
	AutomationNodeTypeRegistryService,
	AutomationsModule,
	ExtensionsService,
	PluginsTypeMapperService,
} from '@fastybird/smart-panel-backend';
import { ExampleExtensionConfigModel } from './models/config.model.js';
import { ExampleExtensionUpdateConfigDto } from './dto/update-config.dto.js';
import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ExampleSignals, createExampleAutomationNodeTypes } from './automation-cards.js';
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
 *
 * It also adds three automation cards (`automation-cards.ts`). `AutomationsModule` is imported for its
 * node type registry, which - unlike the extensions, config and notifications services - is not global.
 */
@Module({
	imports: [AutomationsModule],
	controllers: [ExampleController],
	providers: [ExampleService, { provide: ExampleSignals, useValue: new ExampleSignals() }],
	exports: [ExampleSignals],
})
export class ExampleExtensionModule implements OnModuleInit {
	constructor(
		private readonly configs: PluginsTypeMapperService,
		private readonly extensions: ExtensionsService,
		private readonly automationNodeTypes: AutomationNodeTypeRegistryService,
		private readonly signals: ExampleSignals,
	) {}

	private readonly logger = new Logger(ExampleExtensionModule.name);

	onModuleInit() {
		this.configs.registerMapping({ type: EXAMPLE_EXTENSION_PLUGIN_NAME, class: ExampleExtensionConfigModel, configDto: ExampleExtensionUpdateConfigDto });
		this.extensions.registerPluginMetadata({ type: EXAMPLE_EXTENSION_PLUGIN_NAME, packageName: '@fastybird/smart-panel-extension-example', name: 'Example Extension', defaultEnabled: false });

		// The cards stay registered while the plugin is disabled; the backend just does not offer or run them
		const cards = createExampleAutomationNodeTypes(this.signals);

		this.automationNodeTypes.register(cards.trigger);
		this.automationNodeTypes.register(cards.condition);
		this.automationNodeTypes.register(cards.action);

		this.logger.log(`[EXAMPLE EXTENSION] ${EXAMPLE_EXTENSION_PLUGIN_NAME} initialized`);
	}
}

export { exampleNumericOperators } from './numeric-operators.js';
export {
	EXAMPLE_AUTOMATION_OWNER,
	EXAMPLE_SIGNAL_RECEIVED_NODE_TYPE,
	EXAMPLE_SIGNAL_RECENT_NODE_TYPE,
	EXAMPLE_SIGNAL_SEND_NODE_TYPE,
	ExampleSignals,
	createExampleAutomationNodeTypes,
} from './automation-cards.js';

export { ExampleExtensionConfigModel } from './models/config.model.js';
export { ExampleExtensionUpdateConfigDto } from './dto/update-config.dto.js';
