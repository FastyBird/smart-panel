import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { ExampleController } from './example.controller.js';
import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';

export { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';

/**
 * Example Extension Module
 *
 * This module demonstrates how to create a custom extension for Smart Panel.
 * It's intentionally minimal to avoid circular dependency issues.
 *
 * Note: Extension metadata registration is handled by the discovery service
 * based on package.json "fastybird" configuration.
 */
@Module({
	controllers: [ExampleController],
})
export class ExampleExtensionModule implements OnModuleInit {
	private readonly logger = new Logger(ExampleExtensionModule.name);

	onModuleInit() {
		this.logger.log(`[EXAMPLE EXTENSION] ${EXAMPLE_EXTENSION_PLUGIN_NAME} initialized`);
	}
}
