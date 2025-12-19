var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ExampleExtensionModule_1;
import { Logger, Module } from '@nestjs/common';
import { ExampleController } from './example.controller.js';
import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
export { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';
let ExampleExtensionModule = ExampleExtensionModule_1 = class ExampleExtensionModule {
    logger = new Logger(ExampleExtensionModule_1.name);
    onModuleInit() {
        this.logger.log(`[EXAMPLE EXTENSION] ${EXAMPLE_EXTENSION_PLUGIN_NAME} initialized`);
    }
};
ExampleExtensionModule = ExampleExtensionModule_1 = __decorate([
    Module({
        controllers: [ExampleController],
    })
], ExampleExtensionModule);
export { ExampleExtensionModule };
//# sourceMappingURL=index.js.map