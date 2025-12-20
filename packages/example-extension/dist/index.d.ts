import { OnModuleInit } from '@nestjs/common';
export { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
export declare class ExampleExtensionModule implements OnModuleInit {
    private readonly logger;
    onModuleInit(): void;
}
