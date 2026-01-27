import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceUndoHistoryService } from '../services/space-undo-history.service';
import { SpacesService } from '../services/spaces.service';

/**
 * WebSocket command event types for spaces module intents
 */
export const SpacesWsEventType = {
	LIGHTING_INTENT: 'SpacesModule.LightingIntent',
	CLIMATE_INTENT: 'SpacesModule.ClimateIntent',
	COVERS_INTENT: 'SpacesModule.CoversIntent',
	UNDO_INTENT: 'SpacesModule.UndoIntent',
	// Note: Media domain uses routing-based architecture via SpaceMediaRoutingService
} as const;

/**
 * WebSocket command handler names for spaces module
 */
export const SpacesWsHandlerName = {
	LIGHTING_INTENT: 'SpacesModule.LightingIntentHandler',
	CLIMATE_INTENT: 'SpacesModule.ClimateIntentHandler',
	COVERS_INTENT: 'SpacesModule.CoversIntentHandler',
	UNDO_INTENT: 'SpacesModule.UndoIntentHandler',
	// Note: Media domain uses routing-based architecture via SpaceMediaRoutingService
} as const;

interface SpaceIntentPayload {
	spaceId: string;
}

interface LightingIntentPayload extends SpaceIntentPayload {
	intent: LightingIntentDto;
}

interface ClimateIntentPayload extends SpaceIntentPayload {
	intent: ClimateIntentDto;
}

interface CoversIntentPayload extends SpaceIntentPayload {
	intent: CoversIntentDto;
}

type UndoIntentPayload = SpaceIntentPayload;

/**
 * WebSocket exchange listener for spaces module.
 * Handles space intent commands via WebSocket for real-time command processing.
 *
 * This provides an alternative to REST API for executing space intents,
 * allowing for faster response times and better real-time feedback.
 *
 * Note: Media domain now uses routing-based architecture via SpaceMediaRoutingService
 * and is not included in the WebSocket intent handlers.
 */
@Injectable()
export class WebsocketExchangeListener implements OnModuleInit {
	private readonly logger = new Logger(WebsocketExchangeListener.name);

	constructor(
		private readonly commandEventRegistry: CommandEventRegistryService,
		private readonly spacesService: SpacesService,
		private readonly spaceIntentService: SpaceIntentService,
		private readonly undoHistoryService: SpaceUndoHistoryService,
	) {}

	onModuleInit(): void {
		// Register command handler for lighting intents
		this.commandEventRegistry.register(
			SpacesWsEventType.LIGHTING_INTENT,
			SpacesWsHandlerName.LIGHTING_INTENT,
			this.handleLightingIntent.bind(this),
		);

		// Register command handler for climate intents
		this.commandEventRegistry.register(
			SpacesWsEventType.CLIMATE_INTENT,
			SpacesWsHandlerName.CLIMATE_INTENT,
			this.handleClimateIntent.bind(this),
		);

		// Register command handler for covers intents
		this.commandEventRegistry.register(
			SpacesWsEventType.COVERS_INTENT,
			SpacesWsHandlerName.COVERS_INTENT,
			this.handleCoversIntent.bind(this),
		);

		// Register command handler for undo
		this.commandEventRegistry.register(
			SpacesWsEventType.UNDO_INTENT,
			SpacesWsHandlerName.UNDO_INTENT,
			this.handleUndoIntent.bind(this),
		);

		this.logger.log('Spaces WebSocket exchange listener initialized');
	}

	/**
	 * Check if user is authorized to execute space commands.
	 * Allows display clients and admin/owner users.
	 */
	private isAuthorized(user: ClientUserDto | undefined): boolean {
		if (!user) {
			return false;
		}

		// Allow display clients to control spaces via WebSocket
		const isDisplayClient = user.type === 'token' && user.ownerType === TokenOwnerType.DISPLAY;

		// Allow admin/owner users to control spaces via WebSocket
		const isAdminUser = user.type === 'user' && (user.role === UserRole.ADMIN || user.role === UserRole.OWNER);

		return isDisplayClient || isAdminUser;
	}

	/**
	 * Handle lighting intent command via WebSocket
	 */
	private async handleLightingIntent(
		user: ClientUserDto | undefined,
		payload: LightingIntentPayload,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const { spaceId, intent } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			if (!intent || !intent.type) {
				return { success: false, reason: 'Intent with type is required' };
			}

			// Transform intent payload to handle snake_case to camelCase conversion
			const transformedIntent = toInstance(LightingIntentDto, intent);

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.spaceIntentService.executeLightingIntent(spaceId, transformedIntent);

			if (!result) {
				return { success: false, reason: 'Failed to execute lighting intent' };
			}

			return {
				success: true,
				data: {
					success: result.success,
					affected_devices: result.affectedDevices,
					failed_devices: result.failedDevices,
					skipped_offline_devices: result.skippedOfflineDevices,
					offline_device_ids: result.offlineDeviceIds,
					failed_targets: result.failedTargets,
				},
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(`[WS EXCHANGE] Failed to execute lighting intent: ${err.message}`);
			return { success: false, reason: err.message };
		}
	}

	/**
	 * Handle climate intent command via WebSocket
	 */
	private async handleClimateIntent(
		user: ClientUserDto | undefined,
		payload: ClimateIntentPayload,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const { spaceId, intent } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			if (!intent || !intent.type) {
				return { success: false, reason: 'Intent with type is required' };
			}

			// Transform intent payload to handle snake_case to camelCase conversion
			const transformedIntent = toInstance(ClimateIntentDto, intent);

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.spaceIntentService.executeClimateIntent(spaceId, transformedIntent);

			if (!result) {
				return { success: false, reason: 'Failed to execute climate intent' };
			}

			return {
				success: true,
				data: {
					success: result.success,
					affected_devices: result.affectedDevices,
					failed_devices: result.failedDevices,
					skipped_offline_devices: result.skippedOfflineDevices,
					offline_device_ids: result.offlineDeviceIds,
					failed_targets: result.failedTargets,
					heating_setpoint: result.heatingSetpoint,
					cooling_setpoint: result.coolingSetpoint,
					mode: result.mode,
				},
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(`[WS EXCHANGE] Failed to execute climate intent: ${err.message}`);
			return { success: false, reason: err.message };
		}
	}

	/**
	 * Handle covers intent command via WebSocket
	 */
	private async handleCoversIntent(
		user: ClientUserDto | undefined,
		payload: CoversIntentPayload,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const { spaceId, intent } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			if (!intent || !intent.type) {
				return { success: false, reason: 'Intent with type is required' };
			}

			// Transform intent payload to handle snake_case to camelCase conversion
			const transformedIntent = toInstance(CoversIntentDto, intent);

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.spaceIntentService.executeCoversIntent(spaceId, transformedIntent);

			if (!result) {
				return { success: false, reason: 'Failed to execute covers intent' };
			}

			return {
				success: true,
				data: {
					success: result.success,
					affected_devices: result.affectedDevices,
					failed_devices: result.failedDevices,
					skipped_offline_devices: result.skippedOfflineDevices,
					offline_device_ids: result.offlineDeviceIds,
					failed_targets: result.failedTargets,
					new_position: result.newPosition,
				},
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(`[WS EXCHANGE] Failed to execute covers intent: ${err.message}`);
			return { success: false, reason: err.message };
		}
	}

	/**
	 * Handle undo intent command via WebSocket
	 */
	private async handleUndoIntent(
		user: ClientUserDto | undefined,
		payload: UndoIntentPayload,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const { spaceId } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.undoHistoryService.executeUndo(spaceId);

			if (!result) {
				return { success: false, reason: 'No undo available or undo failed' };
			}

			return {
				success: true,
				data: {
					success: result.success,
					restored_devices: result.restoredDevices,
					failed_devices: result.failedDevices,
					message: result.message,
				},
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(`[WS EXCHANGE] Failed to execute undo: ${err.message}`);
			return { success: false, reason: err.message };
		}
	}
}
