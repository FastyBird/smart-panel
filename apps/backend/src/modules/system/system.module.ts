import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/services/config.service';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { PlatformModule } from '../platform/platform.module';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { ClientUserDto } from '../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../websocket/services/command-event-registry.service';
import { WebsocketModule } from '../websocket/websocket.module';

import { LogsController } from './controllers/logs.controller';
import { SystemController } from './controllers/system.controller';
import { UpdateSystemConfigDto } from './dto/update-config.dto';
import { SystemConfigModel } from './models/config.model';
import { SystemStatsProvider } from './providers/system-stats.provider';
import { FactoryResetRegistryService } from './services/factory-reset-registry.service';
import { SystemCommandService } from './services/system-command.service';
import { SystemLoggerService } from './services/system-logger.service';
import { SystemService } from './services/system.service';
import {
	EventHandlerName,
	EventType,
	LogEntryType,
	SYSTEM_MODULE_API_TAG_DESCRIPTION,
	SYSTEM_MODULE_API_TAG_NAME,
	SYSTEM_MODULE_NAME,
} from './system.constants';
import { SYSTEM_SWAGGER_EXTRA_MODELS } from './system.openapi';

@ApiTag({
	tagName: SYSTEM_MODULE_NAME,
	displayName: SYSTEM_MODULE_API_TAG_NAME,
	description: SYSTEM_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		NestConfigModule,
		PlatformModule,
		WebsocketModule,
		InfluxDbModule,
		StatsModule,
		forwardRef(() => ConfigModule),
		forwardRef(() => ExtensionsModule),
	],
	providers: [
		SystemService,
		SystemCommandService,
		FactoryResetRegistryService,
		SystemLoggerService,
		SystemStatsProvider,
	],
	controllers: [SystemController, LogsController],
	exports: [SystemService, FactoryResetRegistryService, SystemLoggerService],
})
export class SystemModule implements OnModuleInit {
	constructor(
		private readonly eventRegistry: CommandEventRegistryService,
		private readonly systemCommandService: SystemCommandService,
		private readonly systemLoggerService: SystemLoggerService,
		private readonly systemStatsProvider: SystemStatsProvider,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly configService: ConfigService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register system config model with ModulesTypeMapperService
		this.modulesMapperService.registerMapping<SystemConfigModel, UpdateSystemConfigDto>({
			type: SYSTEM_MODULE_NAME,
			class: SystemConfigModel,
			configDto: UpdateSystemConfigDto,
		});

		this.eventRegistry.register(
			EventType.SYSTEM_REBOOT_SET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.reboot(user),
		);

		this.eventRegistry.register(
			EventType.SYSTEM_POWER_OFF_SET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.powerOff(user),
		);

		this.eventRegistry.register(
			EventType.SYSTEM_FACTORY_RESET_SET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.factoryReset(user),
		);

		this.statsRegistryService.register(SYSTEM_MODULE_NAME, this.systemStatsProvider);

		// Get system config using module config endpoint
		const moduleConfig = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);

		this.systemLoggerService.setAllowedTypes(moduleConfig.logLevels as unknown as LogEntryType[]);

		for (const model of SYSTEM_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: SYSTEM_MODULE_NAME,
			name: 'System',
			description: 'System management, logs, and platform operations',
			author: 'FastyBird',
			readme: `# System Module

The System module provides core system management functionality for the Smart Panel.

## Features

- **System Information** - View system status, uptime, and resource usage
- **Logging** - Centralized application logging with configurable levels
- **System Commands** - Reboot, power off, and factory reset operations
- **Statistics** - System-wide statistics collection and reporting

## System Commands

### Reboot
Safely restarts the Smart Panel application and optionally the host system.

### Power Off
Performs a clean shutdown of the Smart Panel.

### Factory Reset
Resets all settings and data to initial state:
- Removes all configured devices
- Clears dashboard pages and tiles
- Resets user accounts (except owner)
- Restores default configuration

## Logging

Supports multiple log levels:
- **Error** - Critical errors requiring attention
- **Warning** - Potential issues
- **Info** - General operational messages
- **Debug** - Detailed debugging information

Logs are stored in memory and can be viewed through the admin interface.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
