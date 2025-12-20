import { Global, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { PlatformModule } from '../platform/platform.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { GenerateAdminExtensionsCommand } from './commands/generate-admin-extensions.command';
import { CONFIG_MODULE_API_TAG_DESCRIPTION, CONFIG_MODULE_API_TAG_NAME, CONFIG_MODULE_NAME } from './config.constants';
import { CONFIG_SWAGGER_EXTRA_MODELS } from './config.openapi';
import { ConfigController } from './controllers/config.controller';
import { UpdateConfigModuleConfigDto } from './dto/update-module-config.dto';
import { ConfigModuleConfigModel } from './models/module-config.model';
import { ConfigService } from './services/config.service';
import { ModulesTypeMapperService } from './services/modules-type-mapper.service';
import { PluginsTypeMapperService } from './services/plugins-type-mapper.service';

@ApiTag({
	tagName: CONFIG_MODULE_NAME,
	displayName: CONFIG_MODULE_API_TAG_NAME,
	description: CONFIG_MODULE_API_TAG_DESCRIPTION,
})
@Global()
@Module({
	imports: [
		NestConfigModule,
		PlatformModule,
		forwardRef(() => SystemModule),
		forwardRef(() => ExtensionsModule),
		SwaggerModule,
	],
	providers: [ConfigService, PluginsTypeMapperService, ModulesTypeMapperService, GenerateAdminExtensionsCommand],
	controllers: [ConfigController],
	exports: [ConfigService, PluginsTypeMapperService, ModulesTypeMapperService],
})
export class ConfigModule implements OnModuleInit {
	constructor(
		private readonly configService: ConfigService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.factoryResetRegistry.register(
			CONFIG_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				await this.configService.resetConfig();

				return {
					success: true,
				};
			},
			500,
		);

		for (const model of CONFIG_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register module config mapping
		this.modulesMapperService.registerMapping<ConfigModuleConfigModel, UpdateConfigModuleConfigDto>({
			type: CONFIG_MODULE_NAME,
			class: ConfigModuleConfigModel,
			configDto: UpdateConfigModuleConfigDto,
		});

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: CONFIG_MODULE_NAME,
			name: 'Configuration',
			description: 'Application and module configuration management',
			author: 'FastyBird',
			readme: `# Configuration Module

The Configuration module manages application settings and module configurations for the Smart Panel.

## Features

- **Centralized Configuration** - Single source of truth for all settings
- **Module Configuration** - Per-module settings management
- **Plugin Configuration** - Per-plugin settings management
- **Factory Reset** - Ability to reset configuration to defaults

## How It Works

The Configuration module provides a unified API for accessing and modifying settings:
- Application-level settings (language, display, etc.)
- Module-specific configurations
- Plugin-specific configurations

## Configuration Storage

Settings are stored in a JSON configuration file on the device filesystem.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
