import { Module, OnModuleInit } from '@nestjs/common';

import {
	ConfigModule,
	ExtensionsModule,
	ExtensionsService,
	PluginsTypeMapperService,
} from '@fastybird/smart-panel-backend';

import { ExampleExtensionUpdateConfigDto } from './dto/update-config.dto.js';
import { ExampleController } from './example.controller.js';
import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
import { ExampleExtensionConfigModel } from './models/config.model.js';

export { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';

@Module({
	imports: [ExtensionsModule, ConfigModule],
	controllers: [ExampleController],
})
export class ExampleExtensionModule implements OnModuleInit {
	constructor(
		private readonly extensionsService: ExtensionsService,
		private readonly configMapper: PluginsTypeMapperService,
	) {}

	onModuleInit() {
		// Register config mapping so the extension appears in the extensions list
		this.configMapper.registerMapping<ExampleExtensionConfigModel, ExampleExtensionUpdateConfigDto>({
			type: EXAMPLE_EXTENSION_PLUGIN_NAME,
			class: ExampleExtensionConfigModel,
			configDto: ExampleExtensionUpdateConfigDto,
		});

		// Register extension metadata for display in admin
		this.extensionsService.registerPluginMetadata({
			type: EXAMPLE_EXTENSION_PLUGIN_NAME,
			name: 'Example Extension',
			description: 'Shows how to build a minimal extension for Smart Panel',
			author: 'FastyBird',
			readme: `# Example Extension

This is an example extension that demonstrates how to create a custom plugin for Smart Panel.

## Features

- **Minimal Setup** - Shows the basic structure of an extension
- **Backend API** - Includes a simple status endpoint
- **Admin UI** - Optional admin panel integration

## Getting Started

Use this extension as a template to create your own:

1. Copy this package to your project
2. Rename the package and update \`package.json\`
3. Modify the module, controllers, and services
4. Register your extension metadata

## API Endpoints

- \`GET /example-extension/status\` - Returns extension status

## For Developers

This extension demonstrates:
- NestJS module structure
- Extension metadata registration
- Package.json configuration for Smart Panel`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
