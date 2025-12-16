import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/services/config.service';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { PlatformModule } from '../platform/platform.module';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { ClientUserDto } from '../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../websocket/services/command-event-registry.service';
import { WebsocketModule } from '../websocket/websocket.module';

import { ExtensionsController } from './controllers/extensions.controller';
import { LogsController } from './controllers/logs.controller';
import { SystemController } from './controllers/system.controller';
import { UpdateSystemConfigDto } from './dto/update-config.dto';
import { SystemConfigModel } from './models/config.model';
import { SystemStatsProvider } from './providers/system-stats.provider';
import { FactoryResetRegistryService } from './services/factory-reset-registry.service';
import { PluginServiceManagerService } from './services/plugin-service-manager.service';
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
	imports: [NestConfigModule, PlatformModule, WebsocketModule, InfluxDbModule, StatsModule, ConfigModule],
	providers: [
		SystemService,
		SystemCommandService,
		FactoryResetRegistryService,
		SystemLoggerService,
		SystemStatsProvider,
		PluginServiceManagerService,
	],
	controllers: [SystemController, LogsController, ExtensionsController],
	exports: [SystemService, FactoryResetRegistryService, SystemLoggerService, PluginServiceManagerService],
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
	}
}
