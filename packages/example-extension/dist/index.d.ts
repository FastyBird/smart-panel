import { OnModuleInit } from '@nestjs/common';
import { ExtensionsService, PluginsTypeMapperService } from '@fastybird/smart-panel-backend';
export { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
export declare class ExampleExtensionModule implements OnModuleInit {
    private readonly extensionsService;
    private readonly configMapper;
    constructor(extensionsService: ExtensionsService, configMapper: PluginsTypeMapperService);
    onModuleInit(): void;
}
