import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { SceneExecutionStatus } from '../scenes.constants';
import { SceneExecutorService } from '../services/scene-executor.service';

/**
 * WebSocket command event types for scenes module
 */
export const ScenesWsEventType = {
	TRIGGER_SCENE: 'ScenesModule.TriggerScene',
} as const;

/**
 * WebSocket command handler names for scenes module
 */
export const ScenesWsHandlerName = {
	TRIGGER_SCENE: 'ScenesModule.TriggerSceneHandler',
} as const;

@Injectable()
export class WebsocketExchangeListener implements OnModuleInit {
	private readonly logger = new Logger(WebsocketExchangeListener.name);

	constructor(
		private readonly commandEventRegistry: CommandEventRegistryService,
		private readonly sceneExecutorService: SceneExecutorService,
	) {}

	onModuleInit(): void {
		// Register command handler for triggering scenes
		this.commandEventRegistry.register(
			ScenesWsEventType.TRIGGER_SCENE,
			ScenesWsHandlerName.TRIGGER_SCENE,
			this.handleTriggerScene.bind(this),
		);

		this.logger.log('Scenes WebSocket exchange listener initialized');
	}

	/**
	 * Check if user is authorized to trigger scenes.
	 * Allows display clients and admin/owner users.
	 */
	private isAuthorized(user: ClientUserDto | undefined): boolean {
		if (!user) {
			return false;
		}

		// Allow display clients to trigger scenes via WebSocket
		const isDisplayClient = user.type === 'token' && user.ownerType === TokenOwnerType.DISPLAY;

		// Allow admin/owner users to trigger scenes via WebSocket
		const isAdminUser = user.type === 'user' && (user.role === UserRole.ADMIN || user.role === UserRole.OWNER);

		return isDisplayClient || isAdminUser;
	}

	private async handleTriggerScene(
		user: ClientUserDto | undefined,
		payload: { sceneId: string },
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const { sceneId } = payload;

			if (!sceneId) {
				return { success: false, reason: 'Scene ID is required' };
			}

			const triggeredBy = user?.id || 'websocket';

			const result = await this.sceneExecutorService.triggerScene(sceneId, triggeredBy);

			const success =
				result.status === SceneExecutionStatus.COMPLETED || result.status === SceneExecutionStatus.PARTIALLY_COMPLETED;

			return {
				success,
				data: {
					success,
					scene_id: result.sceneId,
					status: result.status,
					total_actions: result.totalActions,
					successful_actions: result.successfulActions,
					failed_actions: result.failedActions,
					triggered_at: result.triggeredAt,
					completed_at: result.completedAt,
				},
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to trigger scene: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
