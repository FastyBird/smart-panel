import * as path from 'path';

import { Module, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';

import { getEnvValue } from '../../common/utils/config.utils';
import { AuthModule } from '../auth/auth.module';
import { ConfigService } from '../config/services/config.service';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { DisplaysModule } from '../displays/displays.module';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { PlatformModule } from '../platform/platform.module';
import { SpacesModule } from '../spaces/spaces.module';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { StorageModule } from '../storage/storage.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { UserRole } from '../users/users.constants';
import { UsersModule } from '../users/users.module';
import { ClientUserDto } from '../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../websocket/services/command-event-registry.service';
import { WebsocketModule } from '../websocket/websocket.module';

import { UpdateCheckCommand } from './commands/update-check.command';
import { UpdatePanelCommand } from './commands/update-panel.command';
import { UpdateServerCommand } from './commands/update-server.command';
import { BackupController } from './controllers/backup.controller';
import { LogsController } from './controllers/logs.controller';
import { SystemController } from './controllers/system.controller';
import { UpdateController } from './controllers/update.controller';
import { UpdateSystemConfigDto } from './dto/update-config.dto';
import { SystemConfigModel } from './models/config.model';
import { SystemStatsProvider } from './providers/system-stats.provider';
import { BackupContributionRegistry } from './services/backup-contribution-registry.service';
import { BackupService } from './services/backup.service';
import { DisplayCommandService } from './services/display-command.service';
import { HouseModeActionsService } from './services/house-mode-actions.service';
import { OnboardingService } from './services/onboarding.service';
import { SystemCommandService } from './services/system-command.service';
import { SystemLoggerService } from './services/system-logger.service';
import { SystemService } from './services/system.service';
import { UpdateExecutorService } from './services/update-executor.service';
import { UpdateService } from './services/update.service';
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
		AuthModule,
		StorageModule,
		StatsModule,
		SpacesModule,
		UsersModule,
		DevicesModule,
		DisplaysModule,
		ExtensionsModule,
	],
	providers: [
		SystemService,
		SystemCommandService,
		DisplayCommandService,
		SystemLoggerService,
		SystemStatsProvider,
		HouseModeActionsService,
		OnboardingService,
		UpdateService,
		UpdateExecutorService,
		UpdateCheckCommand,
		UpdateServerCommand,
		UpdatePanelCommand,
		BackupService,
	],
	controllers: [SystemController, LogsController, UpdateController, BackupController],
	exports: [SystemService, SystemLoggerService],
})
export class SystemModule implements OnModuleInit, OnApplicationBootstrap {
	constructor(
		private readonly eventRegistry: CommandEventRegistryService,
		private readonly systemCommandService: SystemCommandService,
		private readonly displayCommandService: DisplayCommandService,
		private readonly systemLoggerService: SystemLoggerService,
		private readonly systemStatsProvider: SystemStatsProvider,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
		private readonly backupContributionRegistry: BackupContributionRegistry,
	) {}

	onModuleInit() {
		// Register system config model with ModulesTypeMapperService
		this.modulesMapperService.registerMapping<SystemConfigModel, UpdateSystemConfigDto>({
			type: SYSTEM_MODULE_NAME,
			class: SystemConfigModel,
			configDto: UpdateSystemConfigDto,
		});

		const adminRoles = [UserRole.ADMIN, UserRole.OWNER];

		this.eventRegistry.register(
			EventType.SYSTEM_REBOOT_SET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.reboot(user),
			adminRoles,
		);

		this.eventRegistry.register(
			EventType.SYSTEM_POWER_OFF_SET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.powerOff(user),
			adminRoles,
		);

		this.eventRegistry.register(
			EventType.SYSTEM_SERVICE_RESTART_SET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.restartService(user),
			adminRoles,
		);

		this.eventRegistry.register(
			EventType.SYSTEM_FACTORY_RESET_SET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.factoryReset(user),
			adminRoles,
		);

		this.eventRegistry.register(
			EventType.DISPLAY_REBOOT_SET,
			EventHandlerName.INTERNAL_DISPLAY_ACTION,
			(user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				Promise.resolve(this.displayCommandService.displayReboot(user)),
		);

		this.eventRegistry.register(
			EventType.DISPLAY_POWER_OFF_SET,
			EventHandlerName.INTERNAL_DISPLAY_ACTION,
			(user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				Promise.resolve(this.displayCommandService.displayPowerOff(user)),
		);

		this.eventRegistry.register(
			EventType.DISPLAY_FACTORY_RESET_SET,
			EventHandlerName.INTERNAL_DISPLAY_ACTION,
			async (user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.displayCommandService.displayFactoryReset(user),
		);

		// Resolve FB_DATA_DIR through getEnvValue so whitespace-only values fall back to
		// the default; BackupService resolves the same variable the same way, and any
		// divergence would put .env at a different base than where backups are stored
		const dataDir = getEnvValue<string>(
			this.nestConfigService,
			'FB_DATA_DIR',
			path.resolve(__dirname, '../../../../../var/lib/smart-panel'),
		);
		const envFilePath = `${dataDir}/.env`;

		this.backupContributionRegistry.register({
			source: SYSTEM_MODULE_NAME,
			label: 'Environment configuration',
			type: 'file',
			path: envFilePath,
			optional: true,
		});

		this.statsRegistryService.register(SYSTEM_MODULE_NAME, this.systemStatsProvider);

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

	onApplicationBootstrap() {
		// Access config after all modules have registered their mappings
		const moduleConfig = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);

		this.systemLoggerService.setAllowedTypes(moduleConfig.logLevels as unknown as LogEntryType[]);
	}
}
