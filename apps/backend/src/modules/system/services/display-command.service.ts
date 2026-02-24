import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { DisplaysService } from '../../displays/services/displays.service';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { EventType, SYSTEM_MODULE_NAME } from '../system.constants';

@Injectable()
export class DisplayCommandService implements OnModuleInit {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'DisplayCommandService');

	private displaysService!: DisplaysService;

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly tokensService: TokensService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit() {
		this.displaysService = this.moduleRef.get(DisplaysService, { strict: false });
	}

	displayReboot(user: ClientUserDto): { success: boolean; reason?: string } {
		const displayId = this.getDisplayId(user);

		if (!displayId) {
			return {
				success: false,
				reason: 'This action is only available for display clients',
			};
		}

		try {
			this.logger.log(`Display reboot requested for display=${displayId}`);

			this.eventEmitter.emit(EventType.DISPLAY_REBOOT, {
				display_id: displayId,
				triggered_by: user.id,
				status: 'processing',
			});

			return {
				success: true,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Display reboot failed for display=${displayId}: ${err.message}`);

			this.eventEmitter.emit(EventType.DISPLAY_REBOOT, {
				display_id: displayId,
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

	displayPowerOff(user: ClientUserDto): { success: boolean; reason?: string } {
		const displayId = this.getDisplayId(user);

		if (!displayId) {
			return {
				success: false,
				reason: 'This action is only available for display clients',
			};
		}

		try {
			this.logger.log(`Display power off requested for display=${displayId}`);

			this.eventEmitter.emit(EventType.DISPLAY_POWER_OFF, {
				display_id: displayId,
				triggered_by: user.id,
				status: 'processing',
			});

			return {
				success: true,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Display power off failed for display=${displayId}: ${err.message}`);

			this.eventEmitter.emit(EventType.DISPLAY_POWER_OFF, {
				display_id: displayId,
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

	async displayFactoryReset(user: ClientUserDto): Promise<{ success: boolean; reason?: string }> {
		const displayId = this.getDisplayId(user);

		if (!displayId) {
			return {
				success: false,
				reason: 'This action is only available for display clients',
			};
		}

		try {
			this.logger.log(`Display factory reset requested for display=${displayId}`);

			this.eventEmitter.emit(EventType.DISPLAY_FACTORY_RESET, {
				display_id: displayId,
				triggered_by: user.id,
				status: 'processing',
			});

			// Revoke all tokens for this display
			await this.tokensService.revokeByOwnerId(displayId, TokenOwnerType.DISPLAY);

			// Remove the display from the system
			await this.displaysService.remove(displayId);

			this.logger.log(`Display ${displayId} successfully removed from the system`);

			this.eventEmitter.emit(EventType.DISPLAY_FACTORY_RESET, {
				display_id: displayId,
				triggered_by: user.id,
				status: 'ok',
			});

			return {
				success: true,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Display factory reset failed for display=${displayId}: ${err.message}`);

			this.eventEmitter.emit(EventType.DISPLAY_FACTORY_RESET, {
				display_id: displayId,
				triggered_by: user.id,
				status: 'err',
				reason: err.message,
			});

			return {
				success: false,
				reason: 'Failed to factory reset display',
			};
		}
	}

	private getDisplayId(user: ClientUserDto): string | null {
		if (user.type === 'token' && user.ownerType === TokenOwnerType.DISPLAY && user.id) {
			return user.id;
		}

		return null;
	}
}
