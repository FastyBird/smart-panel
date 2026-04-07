import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { AppInstanceHolder } from '../../../common/services/app-instance-holder.service';
import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { DeploymentMode } from '../../displays/displays.constants';
import { DisplaysService } from '../../displays/services/displays.service';
import { PermitJoinService } from '../../displays/services/permit-join.service';
import { PluginServiceManagerService } from '../../extensions/services/plugin-service-manager.service';
import { PlatformNotSupportedException } from '../../platform/platform.exceptions';
import { PlatformService } from '../../platform/services/platform.service';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { EventType, SYSTEM_MODULE_NAME } from '../system.constants';

import { FactoryResetRegistryService } from './factory-reset-registry.service';

@Injectable()
export class SystemCommandService implements OnModuleInit {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'SystemCommandService');

	private displaysService!: DisplaysService;
	private permitJoinService!: PermitJoinService;

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly pluginServiceManager: PluginServiceManagerService,
		private readonly platformService: PlatformService,
		private readonly tokensService: TokensService,
		private readonly eventEmitter: EventEmitter2,
		private readonly appInstanceHolder: AppInstanceHolder,
	) {}

	onModuleInit() {
		this.displaysService = this.moduleRef.get(DisplaysService, { strict: false });
		this.permitJoinService = this.moduleRef.get(PermitJoinService, { strict: false });
	}

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

	async restartService(user: ClientUserDto): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[SYSTEM] Service restart requested — performing graceful shutdown');

		try {
			this.eventEmitter.emit(EventType.SYSTEM_SERVICE_RESTART, {
				triggered_by: user.id,
				status: 'processing',
			});

			// Give the WebSocket event time to propagate before shutting down
			await new Promise((resolve) => setTimeout(resolve, 500));

			const app = this.appInstanceHolder.getApp();

			await app.close();
		} catch (error) {
			this.logger.warn(`Error during graceful shutdown: ${(error as Error).message}`);
		}

		// Exit with code 1 so systemd (Restart=on-failure) restarts the process.
		// Code 0 would be treated as a clean exit and systemd would NOT restart.
		process.exit(1);
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

			// Stop all plugin services before wiping data
			await this.pluginServiceManager.stopAllServices();

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

			this.eventEmitter.emit(EventType.SYSTEM_FACTORY_RESET, {
				triggered_by: user.id,
				status: 'ok',
			});

			// Reboot is best-effort — the reset already succeeded at this point
			try {
				await this.platformService.reboot();
			} catch (rebootError) {
				if (rebootError instanceof PlatformNotSupportedException) {
					this.logger.warn('Reboot not supported on this platform after factory reset');
				} else {
					this.logger.warn(`Failed to reboot after factory reset: ${(rebootError as Error).message}`);
				}
			}

			return {
				success: true,
			};
		} catch (error) {
			this.eventEmitter.emit(EventType.SYSTEM_FACTORY_RESET, {
				triggered_by: user.id,
				status: 'err',
				reason: 'unknown',
			});

			return {
				success: false,
				reason: error instanceof Error ? error.message : 'Unknown error',
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
