import * as path from 'path';

import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../common/utils/config.utils';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { PlatformModule } from '../platform/platform.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { BackupContributionRegistry } from '../system/services/backup-contribution-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import { GenerateAdminExtensionsCommand } from './commands/generate-admin-extensions.command';
import { CONFIG_MODULE_API_TAG_DESCRIPTION, CONFIG_MODULE_API_TAG_NAME, CONFIG_MODULE_NAME } from './config.constants';
import { CONFIG_SWAGGER_EXTRA_MODELS } from './config.openapi';
import { ConfigController } from './controllers/config.controller';
import { UpdateConfigModuleConfigDto } from './dto/update-module-config.dto';
import { ConfigModuleConfigModel } from './models/module-config.model';
import { ConfigService } from './services/config.service';
import { ModulesTypeMapperService } from './services/modules-type-mapper.service';
import { PluginConfigValidatorService } from './services/plugin-config-validator.service';

@ApiTag({
	tagName: CONFIG_MODULE_NAME,
	displayName: CONFIG_MODULE_API_TAG_NAME,
	description: CONFIG_MODULE_API_TAG_DESCRIPTION,
})
@Global()
@Module({
	imports: [NestConfigModule, PlatformModule, SwaggerModule],
	providers: [ConfigService, PluginConfigValidatorService, GenerateAdminExtensionsCommand],
	controllers: [ConfigController],
	exports: [ConfigService, PluginConfigValidatorService],
})
export class ConfigModule implements OnModuleInit {
	constructor(
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly backupRegistry: BackupContributionRegistry,
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

		// Register backup contribution for config directory. Exclude the seed
		// subdirectory — those are factory JSONs shipped with the app, not user data;
		// backing them up would bloat the archive and restoring would clobber the
		// live seed set any new install depends on.
		this.backupRegistry.register({
			source: CONFIG_MODULE_NAME,
			label: 'Plugin & Module Configurations',
			type: 'directory',
			path: getEnvValue<string>(
				this.nestConfigService,
				'FB_CONFIG_PATH',
				path.resolve(__dirname, '../../../../../var/data'),
			),
			optional: false,
			exclude: ['seed'],
		});

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
			readme: `# Configuration

> Module · by FastyBird

Single source of truth for every setting in the Smart Panel. Modules and plugins register their own config DTOs at startup; this module accepts updates through one API, validates them, persists them to disk, and notifies the registered owner so live reconfiguration is possible without restarts.

## What it gives you

- A common config surface so the admin UI, CLI and Buddy don't need a custom flow per module
- Strong validation — every section is type-checked against its owning module's DTO at write time, so bad config never reaches the runtime
- Hot-reload semantics — owners are notified when their slice changes and can react (start polling, swap providers, …) without a backend restart
- Predictable persistence — settings are JSON files, easy to inspect, version-control, back up and restore

## Features

- **Central config store** — every module and plugin reads its settings through this module's typed accessors
- **Type registry** — modules and plugins register their config DTOs at startup; the registry knows the shape of every section
- **Validation** — incoming changes are validated against the registered DTOs and rejected with field-level errors when they don't pass
- **Watcher API** — modules subscribe to "my section changed" notifications and apply updates live
- **Atomic writes** — changes are written to a temporary file and renamed in place, so a crash mid-write can never corrupt config
- **Backups** — the config directory is automatically included in system backups; the seed subdir is excluded since those are factory defaults
- **Factory reset** — restores defaults from the seed directory, preserving the owner's existence
- **Schema versioning** — sections can declare a version number so future migrations can rewrite them safely

## Configuration Storage

Settings are stored as JSON files in \`FB_CONFIG_PATH\` (defaults to \`var/data\`).

## API Endpoints

- \`GET /api/v1/modules/config\` — read the global config (owner / admin only)
- \`GET /api/v1/modules/config/:section\` — read a single section
- \`PATCH /api/v1/modules/config\` — update one or more module / plugin sections in one transaction

## CLI Commands

- \`pnpm run cli config:generate-admin-extensions\` — regenerate the admin-side extensions import map (\`apps/admin/var/config/extensions.ts\`)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
