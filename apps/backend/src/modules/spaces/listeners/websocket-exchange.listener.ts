import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { MediaIntentDto } from '../dto/media-intent.dto';
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
	MEDIA_INTENT: 'SpacesModule.MediaIntent',
	UNDO_INTENT: 'SpacesModule.UndoIntent',
} as const;

/**
 * WebSocket command handler names for spaces module
 */
export const SpacesWsHandlerName = {
	LIGHTING_INTENT: 'SpacesModule.LightingIntentHandler',
	CLIMATE_INTENT: 'SpacesModule.ClimateIntentHandler',
	COVERS_INTENT: 'SpacesModule.CoversIntentHandler',
	MEDIA_INTENT: 'SpacesModule.MediaIntentHandler',
	UNDO_INTENT: 'SpacesModule.UndoIntentHandler',
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

interface MediaIntentPayload extends SpaceIntentPayload {
	intent: MediaIntentDto;
}

type UndoIntentPayload = SpaceIntentPayload;

/**
 * WebSocket exchange listener for spaces module.
 * Handles space intent commands via WebSocket for real-time command processing.
 *
 * This provides an alternative to REST API for executing space intents,
 * allowing for faster response times and better real-time feedback.
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

		// Register command handler for media intents
		this.commandEventRegistry.register(
			SpacesWsEventType.MEDIA_INTENT,
			SpacesWsHandlerName.MEDIA_INTENT,
			this.handleMediaIntent.bind(this),
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
	 * Handle lighting intent command via WebSocket
	 */
	private async handleLightingIntent(
		user: ClientUserDto | undefined,
		payload: LightingIntentPayload,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			const { spaceId, intent } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			if (!intent || !intent.type) {
				return { success: false, reason: 'Intent with type is required' };
			}

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.spaceIntentService.executeLightingIntent(spaceId, intent);

			if (!result) {
				return { success: false, reason: 'Failed to execute lighting intent' };
			}

			return {
				success: true,
				data: {
					affectedDevices: result.affectedDevices,
					failedDevices: result.failedDevices,
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
			const { spaceId, intent } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			if (!intent || !intent.type) {
				return { success: false, reason: 'Intent with type is required' };
			}

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.spaceIntentService.executeClimateIntent(spaceId, intent);

			if (!result) {
				return { success: false, reason: 'Failed to execute climate intent' };
			}

			return {
				success: true,
				data: {
					affectedDevices: result.affectedDevices,
					failedDevices: result.failedDevices,
					heatingSetpoint: result.heatingSetpoint,
					coolingSetpoint: result.coolingSetpoint,
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
			const { spaceId, intent } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			if (!intent || !intent.type) {
				return { success: false, reason: 'Intent with type is required' };
			}

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.spaceIntentService.executeCoversIntent(spaceId, intent);

			if (!result) {
				return { success: false, reason: 'Failed to execute covers intent' };
			}

			return {
				success: true,
				data: {
					affectedDevices: result.affectedDevices,
					failedDevices: result.failedDevices,
					newPosition: result.newPosition,
				},
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(`[WS EXCHANGE] Failed to execute covers intent: ${err.message}`);
			return { success: false, reason: err.message };
		}
	}

	/**
	 * Handle media intent command via WebSocket
	 */
	private async handleMediaIntent(
		user: ClientUserDto | undefined,
		payload: MediaIntentPayload,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			const { spaceId, intent } = payload;

			if (!spaceId) {
				return { success: false, reason: 'Space ID is required' };
			}

			if (!intent || !intent.type) {
				return { success: false, reason: 'Intent with type is required' };
			}

			// Verify space exists
			const space = await this.spacesService.findOne(spaceId);
			if (!space) {
				return { success: false, reason: `Space with id=${spaceId} was not found` };
			}

			const result = await this.spaceIntentService.executeMediaIntent(spaceId, intent);

			if (!result) {
				return { success: false, reason: 'Failed to execute media intent' };
			}

			return {
				success: true,
				data: {
					affectedDevices: result.affectedDevices,
					failedDevices: result.failedDevices,
					newVolume: result.newVolume,
					isMuted: result.isMuted,
				},
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(`[WS EXCHANGE] Failed to execute media intent: ${err.message}`);
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
					restoredDevices: result.restoredDevices,
					failedDevices: result.failedDevices,
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
