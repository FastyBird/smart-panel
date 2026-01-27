import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { SceneExecutionStatus } from '../scenes.constants';
import { SceneExecutorService } from '../services/scene-executor.service';

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
			'ScenesModule.TriggerScene',
			'ScenesModule.TriggerSceneHandler',
			this.handleTriggerScene.bind(this),
		);
	}

	private async handleTriggerScene(
		user: ClientUserDto | undefined,
		payload: { sceneId: string },
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			const { sceneId } = payload;

			if (!sceneId) {
				return { success: false, reason: 'Scene ID is required' };
			}

			const triggeredBy = user?.id || 'websocket';

			const result = await this.sceneExecutorService.triggerScene(sceneId, triggeredBy);

			return {
				success:
					result.status === SceneExecutionStatus.COMPLETED ||
					result.status === SceneExecutionStatus.PARTIALLY_COMPLETED,
				data: {
					sceneId: result.sceneId,
					status: result.status,
					totalActions: result.totalActions,
					successfulActions: result.successfulActions,
					failedActions: result.failedActions,
					triggeredAt: result.triggeredAt,
					completedAt: result.completedAt,
				},
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to trigger scene: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
