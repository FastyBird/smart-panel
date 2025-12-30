import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { SceneExecutorService } from '../services/scene-executor.service';
import { ScenesService } from '../services/scenes.service';

@Injectable()
export class WebsocketExchangeListener implements OnModuleInit {
	private readonly logger = new Logger(WebsocketExchangeListener.name);

	constructor(
		private readonly commandEventRegistry: CommandEventRegistryService,
		private readonly scenesService: ScenesService,
		private readonly sceneExecutorService: SceneExecutorService,
	) {}

	onModuleInit(): void {
		this.logger.debug('[WS EXCHANGE LISTENER] Registering scenes module command handlers');

		// Register command handler for triggering scenes
		this.commandEventRegistry.register(
			'ScenesModule.TriggerScene',
			'ScenesModule.TriggerSceneHandler',
			this.handleTriggerScene.bind(this),
		);

		// Register command handler for getting all scenes
		this.commandEventRegistry.register(
			'ScenesModule.GetScenes',
			'ScenesModule.GetScenesHandler',
			this.handleGetScenes.bind(this),
		);

		// Register command handler for getting a single scene
		this.commandEventRegistry.register(
			'ScenesModule.GetScene',
			'ScenesModule.GetSceneHandler',
			this.handleGetScene.bind(this),
		);

		this.logger.debug('[WS EXCHANGE LISTENER] Scenes module command handlers registered');
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

			this.logger.debug(`[WS EXCHANGE LISTENER] Triggering scene id=${sceneId} by=${triggeredBy}`);

			const result = await this.sceneExecutorService.triggerScene(sceneId, triggeredBy);

			return {
				success: result.status === 'completed' || result.status === 'partially_completed',
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

	private async handleGetScenes(
		_user: ClientUserDto | undefined,
		_payload: Record<string, unknown>,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			this.logger.debug('[WS EXCHANGE LISTENER] Getting all scenes');

			const scenes = await this.scenesService.findAll();

			return {
				success: true,
				data: {
					scenes: scenes.map((scene) => ({
						id: scene.id,
						type: scene.type,
						category: scene.category,
						name: scene.name,
						description: scene.description,
						icon: scene.icon,
						enabled: scene.enabled,
						isTriggerable: scene.isTriggerable,
						isEditable: scene.isEditable,
						lastTriggeredAt: scene.lastTriggeredAt instanceof Date ? scene.lastTriggeredAt.toISOString() : scene.lastTriggeredAt || null,
					})),
				},
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to get scenes: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}

	private async handleGetScene(
		_user: ClientUserDto | undefined,
		payload: { sceneId: string },
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			const { sceneId } = payload;

			if (!sceneId) {
				return { success: false, reason: 'Scene ID is required' };
			}

			this.logger.debug(`[WS EXCHANGE LISTENER] Getting scene id=${sceneId}`);

			const scene = await this.scenesService.findOne(sceneId);

			if (!scene) {
				return { success: false, reason: `Scene with id=${sceneId} was not found` };
			}

			return {
				success: true,
				data: {
					scene: {
						id: scene.id,
						type: scene.type,
						category: scene.category,
						name: scene.name,
						description: scene.description,
						icon: scene.icon,
						enabled: scene.enabled,
						isTriggerable: scene.isTriggerable,
						isEditable: scene.isEditable,
						lastTriggeredAt: scene.lastTriggeredAt instanceof Date ? scene.lastTriggeredAt.toISOString() : scene.lastTriggeredAt || null,
						actionsCount: scene.actions?.length || 0,
						conditionsCount: scene.conditions?.length || 0,
						triggersCount: scene.triggers?.length || 0,
					},
				},
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to get scene: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
