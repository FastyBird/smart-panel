import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { PropertyCommandService } from '../services/property-command.service';

/**
 * WebSocket command event types for devices module
 */
export const DevicesWsEventType = {
	SET_PROPERTY: 'DevicesModule.SetProperty',
} as const;

/**
 * WebSocket command handler names for devices module
 */
export const DevicesWsHandlerName = {
	SET_PROPERTY: 'DevicesModule.SetPropertyHandler',
} as const;

@Injectable()
export class WebsocketExchangeListener implements OnModuleInit {
	private readonly logger = new Logger(WebsocketExchangeListener.name);

	constructor(
		private readonly commandEventRegistry: CommandEventRegistryService,
		private readonly propertyCommandService: PropertyCommandService,
	) {}

	onModuleInit(): void {
		// Register command handler for setting device properties
		this.commandEventRegistry.register(
			DevicesWsEventType.SET_PROPERTY,
			DevicesWsHandlerName.SET_PROPERTY,
			this.handleSetProperty.bind(this),
		);

		this.logger.log('Devices WebSocket exchange listener initialized');
	}

	/**
	 * Check if user is authorized to execute device commands.
	 * Allows display clients and admin/owner users.
	 */
	private isAuthorized(user: ClientUserDto | undefined): boolean {
		if (!user) {
			return false;
		}

		// Allow display clients to control devices via WebSocket
		const isDisplayClient = user.type === 'token' && user.ownerType === TokenOwnerType.DISPLAY;

		// Allow admin/owner users to control devices via WebSocket
		const isAdminUser = user.type === 'user' && (user.role === UserRole.ADMIN || user.role === UserRole.OWNER);

		return isDisplayClient || isAdminUser;
	}

	/**
	 * Handle set property command via WebSocket
	 */
	private async handleSetProperty(
		user: ClientUserDto | undefined,
		payload: object | undefined,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const result = await this.propertyCommandService.handleInternal(user, payload);

			return {
				success: result.success,
				reason: typeof result.results === 'string' ? result.results : undefined,
				data:
					typeof result.results !== 'string'
						? {
								results: result.results,
							}
						: undefined,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to set property: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
