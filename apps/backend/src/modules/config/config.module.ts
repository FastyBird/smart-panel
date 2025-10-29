import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { PlatformModule } from '../platform/platform.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { GenerateAdminExtensionsCommand } from './commands/generate-admin-extensions.command';
import { CONFIG_MODULE_NAME } from './config.constants';
import { ConfigController } from './controllers/config.controller';
import { ConfigService } from './services/config.service';
import { PluginsTypeMapperService } from './services/plugins-type-mapper.service';

@Module({
	imports: [NestConfigModule, PlatformModule, forwardRef(() => SystemModule)],
	providers: [ConfigService, PluginsTypeMapperService, GenerateAdminExtensionsCommand],
	controllers: [ConfigController],
	exports: [ConfigService, PluginsTypeMapperService],
})
export class ConfigModule {
	constructor(
		private readonly configService: ConfigService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
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
	}
}
