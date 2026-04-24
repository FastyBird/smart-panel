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
			path.resolve(__dirname, '../../../../../var'),
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
			readme: `# System

> Module · by FastyBird

Core platform management for the Smart Panel. Owns everything that is *about the box itself* rather than the things plugged into it: status reporting, structured logging, software updates, backups, statistics aggregation and the dangerous platform-level commands (reboot, power off, factory reset).

## What it gives you

- A single place to see how the appliance is doing (CPU, memory, disk, network, uptime, version) — surfaced both in the admin UI and on the panel
- A pluggable update channel that can pull a new backend, a new panel build, or both, and roll them out together
- A backup pipeline that collects contributions from every module and plugin into one archive, and can restore the whole appliance from it
- A central reset / seed coordinator so a "factory reset" actually wipes everything in the right order
- A structured logs API so the admin UI can show recent log entries, filter by level or module, and trigger downloads

## Features

- **System info** — uptime, CPU, memory, storage, network, version and platform stats refreshed in the background
- **Centralised structured logs** — every module emits through the same logger; entries are persisted with module / level / context and exposed through the API
- **Power actions** — reboot, power off and full factory reset, all owner-only and audited
- **Display actions** — remotely reboot, power off or factory-reset a connected panel display
- **Backups** — orchestrates a backup registry: every module / plugin contributes the files and rows it owns into one downloadable archive; restore replays them in the same order
- **Updates** — check for available backend / panel updates, install them, and report progress; updates are pluggable so different deployment targets (Docker, embedded, dev) can each register their own runner
- **Statistics aggregator** — runs the stats registry: every module exposes its own metrics provider, the system module merges them into one snapshot for the admin UI and the API
- **Factory-reset registry** — orchestrated, prioritised wipe across all modules / plugins; safe order, error reporting per step
- **Settings & ownership** — owns the system-level config (locale, time-zone, log levels, update channel, …)

## API Endpoints

- \`GET /api/v1/modules/system/status\` — system status and stats
- \`GET /api/v1/modules/system/logs\` — recent log entries (filterable by module / level)
- \`POST /api/v1/modules/system/power/{reboot|shutdown|factory-reset}\` — power actions
- \`POST /api/v1/modules/system/backup\` / \`/restore\` — create or restore a backup archive
- \`POST /api/v1/modules/system/update/{check|install}\` — update operations

## CLI Commands

- \`pnpm run cli system:update:check\` — check for available updates
- \`pnpm run cli system:update:server\` — update the backend
- \`pnpm run cli system:update:panel\` — update the panel display

## Logging Levels

\`error\` · \`warn\` · \`info\` · \`debug\` — configurable via the \`logLevels\` setting.`,
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
