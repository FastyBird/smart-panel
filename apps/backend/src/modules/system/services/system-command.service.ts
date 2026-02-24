import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { DeploymentMode } from '../../displays/displays.constants';
import { DisplaysService } from '../../displays/services/displays.service';
import { PermitJoinService } from '../../displays/services/permit-join.service';
import { PlatformNotSupportedException } from '../../platform/platform.exceptions';
import { PlatformService } from '../../platform/services/platform.service';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { EventType, SYSTEM_MODULE_NAME } from '../system.constants';

import { FactoryResetRegistryService } from './factory-reset-registry.service';

@Injectable()
export class SystemCommandService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'SystemCommandService');

	constructor(
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly platformService: PlatformService,
		private readonly displaysService: DisplaysService,
		private readonly tokensService: TokensService,
		private readonly permitJoinService: PermitJoinService,
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

			// In gateway modes (standalone/combined), notify all connected displays to factory reset
			const deploymentMode = this.permitJoinService.getDeploymentMode();

			if (deploymentMode !== DeploymentMode.ALL_IN_ONE) {
				await this.cascadeFactoryResetToDisplays(user);
			}

			// Sort seeders by priority (lower first)
			const handlers = this.factoryResetRegistry.get().sort((a, b) => a.priority - b.priority);

			for (const { name, handler } of handlers) {
				const result = await handler();

				if (!result?.success) {
					this.logger.error(`Reset handler "${name}" failed: ${result?.reason}`);

					return {
						success: false,
						reason: result?.reason ?? `Factory reset failed in handler: ${name}`,
					};
				}
			}

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

			this.eventEmitter.emit(EventType.SYSTEM_FACTORY_RESET, {
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

	private async cascadeFactoryResetToDisplays(user: ClientUserDto): Promise<void> {
		try {
			const displays = await this.displaysService.findAll();

			this.logger.log(`Cascading factory reset to ${displays.length} connected displays`);

			for (const display of displays) {
				// Notify each display to factory reset
				this.eventEmitter.emit(EventType.DISPLAY_FACTORY_RESET, {
					display_id: display.id,
					triggered_by: user.id,
					status: 'processing',
				});

				// Revoke display tokens
				await this.tokensService.revokeByOwnerId(display.id, TokenOwnerType.DISPLAY);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to cascade factory reset to displays: ${err.message}`);
		}
	}
}
