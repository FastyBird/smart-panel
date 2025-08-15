import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformModule } from '../platform/platform.module';
import { ClientUserDto } from '../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../websocket/services/command-event-registry.service';
import { WebsocketModule } from '../websocket/websocket.module';

import { DisplaysProfilesController } from './controllers/displays-profiles.controller';
import { SystemController } from './controllers/system.controller';
import { DisplayProfileEntity } from './entities/system.entity';
import { DisplaysProfilesService } from './services/displays-profiles.service';
import { FactoryResetRegistryService } from './services/factory-reset-registry.service';
import { ModuleResetService } from './services/module-reset.service';
import { SystemCommandService } from './services/system-command.service';
import { SystemService } from './services/system.service';
import { EventHandlerName, EventType, SYSTEM_MODULE_NAME } from './system.constants';
import { DisplayProfileExistsConstraintValidator } from './validators/display-profile-exists-constraint.validator';

@Module({
	imports: [TypeOrmModule.forFeature([DisplayProfileEntity]), NestConfigModule, PlatformModule, WebsocketModule],
	providers: [
		SystemService,
		SystemCommandService,
		FactoryResetRegistryService,
		ModuleResetService,
		DisplaysProfilesService,
		DisplayProfileExistsConstraintValidator,
	],
	controllers: [SystemController, DisplaysProfilesController],
	exports: [SystemService, DisplaysProfilesService, FactoryResetRegistryService],
})
export class SystemModule {
	constructor(
		private readonly eventRegistry: CommandEventRegistryService,
		private readonly systemCommandService: SystemCommandService,
		private readonly moduleReset: ModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
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

		this.factoryResetRegistry.register(
			SYSTEM_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			400,
		);
	}
}
