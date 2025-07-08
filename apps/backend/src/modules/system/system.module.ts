import { Module } from '@nestjs/common';

import { PlatformModule } from '../platform/platform.module';
import { ClientUserDto } from '../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../websocket/services/command-event-registry.service';
import { WebsocketModule } from '../websocket/websocket.module';

import { SystemController } from './controllers/system.controller';
import { SystemCommandService } from './services/system-command.service';
import { SystemService } from './services/system.service';
import { EventHandlerName, EventType } from './system.constants';

@Module({
	imports: [PlatformModule, WebsocketModule],
	providers: [SystemService, SystemCommandService],
	controllers: [SystemController],
	exports: [SystemService],
})
export class SystemModule {
	constructor(
		private readonly eventRegistry: CommandEventRegistryService,
		private readonly systemCommandService: SystemCommandService,
	) {}

	onModuleInit() {
		this.eventRegistry.register(
			EventType.SYSTEM_REBOOT,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (_user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.reboot(),
		);

		this.eventRegistry.register(
			EventType.SYSTEM_POWER_OFF,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (_user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.powerOff(),
		);

		this.eventRegistry.register(
			EventType.SYSTEM_FACTORY_RESET,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
			async (_user: ClientUserDto, _payload?: object): Promise<{ success: boolean; reason?: string }> =>
				this.systemCommandService.factoryReset(),
		);
	}
}
