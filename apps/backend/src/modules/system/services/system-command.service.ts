import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PlatformNotSupportedException } from '../../platform/platform.exceptions';
import { PlatformService } from '../../platform/services/platform.service';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { EventType } from '../system.constants';

import { FactoryResetRegistryService } from './factory-reset-registry.service';

@Injectable()
export class SystemCommandService {
	private readonly logger = new Logger(SystemCommandService.name);

	constructor(
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly platformService: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reboot(user: ClientUserDto): Promise<{ success: boolean; reason?: string }> {
		try {
			this.eventEmitter.emit(EventType.SYSTEM_REBOOT, {
				triggered_by: user.id,
				status: 'processing',
			});

			await this.platformService.reboot();

			this.eventEmitter.emit(EventType.SYSTEM_REBOOT, {
				triggered_by: user.id,
				status: 'ok',
			});

			return {
				success: true,
			};
		} catch (error) {
			if (error instanceof PlatformNotSupportedException) {
				this.eventEmitter.emit(EventType.SYSTEM_REBOOT, {
					triggered_by: user.id,
					status: 'err',
					reason: 'no supported',
				});

				return {
					success: false,
					reason: 'This action is not supported by this platform',
				};
			}

			this.eventEmitter.emit(EventType.SYSTEM_REBOOT, {
				triggered_by: user.id,
				status: 'err',
				reason: 'unknown',
			});

			return {
				success: false,
				reason: 'Unknown error',
			};
		}
	}

	async powerOff(user: ClientUserDto): Promise<{ success: boolean; reason?: string }> {
		try {
			this.eventEmitter.emit(EventType.SYSTEM_POWER_OFF, {
				triggered_by: user.id,
				status: 'processing',
			});

			await this.platformService.powerOff();

			this.eventEmitter.emit(EventType.SYSTEM_POWER_OFF, {
				triggered_by: user.id,
				status: 'ok',
			});

			return {
				success: true,
			};
		} catch (error) {
			if (error instanceof PlatformNotSupportedException) {
				this.eventEmitter.emit(EventType.SYSTEM_POWER_OFF, {
					triggered_by: user.id,
					status: 'err',
					reason: 'no supported',
				});

				return {
					success: false,
					reason: 'This action is not supported by this platform',
				};
			}

			this.eventEmitter.emit(EventType.SYSTEM_POWER_OFF, {
				triggered_by: user.id,
				status: 'err',
				reason: 'unknown',
			});

			return {
				success: false,
				reason: 'Unknown error',
			};
		}
	}

	async factoryReset(user: ClientUserDto): Promise<{ success: boolean; reason?: string }> {
		try {
			this.eventEmitter.emit(EventType.SYSTEM_FACTORY_RESET, {
				triggered_by: user.id,
				status: 'processing',
			});

			// Sort seeders by priority (lower first)
			const handlers = this.factoryResetRegistry.get().sort((a, b) => a.priority - b.priority);

			for (const { name, handler } of handlers) {
				const result = await handler();

				if (!result?.success) {
					this.logger.error(`[FACTORY RESET] Reset handler "${name}" failed: ${result?.reason}`);

					return {
						success: false,
						reason: result?.reason ?? `Factory reset failed in handler: ${name}`,
					};
				}

				this.logger.debug(`[FACTORY RESET] Handler "${name}" completed successfully`);
			}

			this.logger.debug('[FACTORY RESET] Factory reset was successful');

			await this.platformService.reboot();

			this.eventEmitter.emit(EventType.SYSTEM_FACTORY_RESET, {
				triggered_by: user.id,
				status: 'ok',
			});

			return {
				success: true,
			};
		} catch (error) {
			if (error instanceof PlatformNotSupportedException) {
				this.eventEmitter.emit(EventType.SYSTEM_FACTORY_RESET, {
					triggered_by: user.id,
					status: 'err',
					reason: 'no supported',
				});

				return {
					success: false,
					reason: 'This action is not supported by this platform',
				};
			}

			this.eventEmitter.emit(EventType.SYSTEM_POWER_OFF, {
				triggered_by: user.id,
				status: 'err',
				reason: 'unknown',
			});

			return {
				success: false,
				reason: 'Unknown error',
			};
		}
	}
}
