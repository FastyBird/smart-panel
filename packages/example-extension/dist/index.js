var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Module } from '@nestjs/common';
import { ConfigModule, ExtensionsModule, ExtensionsService, PluginsTypeMapperService, } from '@fastybird/smart-panel-backend';
import { ExampleExtensionUpdateConfigDto } from './dto/update-config.dto.js';
import { ExampleController } from './example.controller.js';
import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
import { ExampleExtensionConfigModel } from './models/config.model.js';
export { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
let ExampleExtensionModule = class ExampleExtensionModule {
    extensionsService;
    configMapper;
    constructor(extensionsService, configMapper) {
        this.extensionsService = extensionsService;
        this.configMapper = configMapper;
    }
    onModuleInit() {
        this.configMapper.registerMapping({
            type: EXAMPLE_EXTENSION_PLUGIN_NAME,
            class: ExampleExtensionConfigModel,
            configDto: ExampleExtensionUpdateConfigDto,
        });
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
};
ExampleExtensionModule = __decorate([
    Module({
        imports: [ExtensionsModule, ConfigModule],
        controllers: [ExampleController],
    }),
    __metadata("design:paramtypes", [ExtensionsService,
        PluginsTypeMapperService])
], ExampleExtensionModule);
export { ExampleExtensionModule };
//# sourceMappingURL=index.js.map