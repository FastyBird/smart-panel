import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SceneActionEntity, SceneEntity } from '../entities/scenes.entity';
import { ActionExecutionResultModel, SceneExecutionResultModel } from '../models/scenes.model';
import { EventType, SceneExecutionStatus } from '../scenes.constants';
import { ScenesExecutionException, ScenesNotTriggerableException } from '../scenes.exceptions';

import { ScenesService } from './scenes.service';

/**
 * Interface for scene execution platforms.
 * Plugins implement this interface to provide custom scene execution logic.
 */
export interface IScenePlatform {
	/**
	 * Get the type identifier for this platform
	 */
	getType(): string;

	/**
	 * Execute scene actions
	 */
	execute(scene: SceneEntity, actions: SceneActionEntity[]): Promise<ActionExecutionResultModel[]>;

	/**
	 * Validate if an action can be executed
	 */
	validateAction(action: SceneActionEntity): Promise<boolean>;
}

@Injectable()
export class SceneExecutorService {
	private readonly logger = new Logger(SceneExecutorService.name);
	private readonly platforms = new Map<string, IScenePlatform>();

	constructor(
		private readonly scenesService: ScenesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Register a scene execution platform
	 */
	registerPlatform(platform: IScenePlatform): void {
		const type = platform.getType().toLowerCase();

		if (this.platforms.has(type)) {
			this.logger.warn(`[REGISTER] Overwriting existing platform for type: ${type}`);
		}

		this.platforms.set(type, platform);

		this.logger.log(`[REGISTER] Registered scene platform: ${type}`);
	}

	/**
	 * Get a registered platform by type
	 */
	getPlatform(type: string): IScenePlatform | undefined {
		return this.platforms.get(type.toLowerCase());
	}

	/**
	 * Check if a platform is registered for a type
	 */
	hasPlatform(type: string): boolean {
		return this.platforms.has(type.toLowerCase());
	}

	/**
	 * Trigger a scene execution
	 */
	async triggerScene(sceneId: string, triggeredBy?: string): Promise<SceneExecutionResultModel> {
		this.logger.debug(`[TRIGGER] Triggering scene with id=${sceneId}`);

		const scene = await this.scenesService.getOneOrThrow(sceneId);

		// Check if scene is triggerable
		if (!scene.triggerable) {
			this.logger.error(`[TRIGGER] Scene with id=${sceneId} is not triggerable`);
			throw new ScenesNotTriggerableException(`Scene with id=${sceneId} cannot be triggered.`);
		}

		// Check if scene is enabled
		if (!scene.enabled) {
			this.logger.warn(`[TRIGGER] Scene with id=${sceneId} is disabled`);
			throw new ScenesNotTriggerableException(`Scene with id=${sceneId} is disabled.`);
		}

		const triggeredAt = new Date();

		// Emit execution started event
		this.eventEmitter.emit(EventType.SCENE_EXECUTION_STARTED, {
			sceneId,
			triggeredAt: triggeredAt.toISOString(),
			triggeredBy,
		});

		const result: SceneExecutionResultModel = {
			sceneId,
			status: SceneExecutionStatus.RUNNING,
			triggeredAt: triggeredAt.toISOString(),
			completedAt: null,
			triggeredBy: triggeredBy || null,
			totalActions: scene.actions?.length || 0,
			successfulActions: 0,
			failedActions: 0,
			actionResults: [],
			error: null,
		};

		try {
			// Evaluate conditions (if any)
			const conditionsMet = this.evaluateConditions(scene);

			if (!conditionsMet) {
				result.status = SceneExecutionStatus.FAILED;
				result.error = 'Scene conditions not met';
				result.completedAt = new Date().toISOString();

				this.eventEmitter.emit(EventType.SCENE_EXECUTION_FAILED, result);

				return result;
			}

			// Execute actions
			const actionResults = await this.executeActions(scene);

			result.actionResults = actionResults;
			result.successfulActions = actionResults.filter((r) => r.success).length;
			result.failedActions = actionResults.filter((r) => !r.success).length;

			// Determine final status
			if (result.failedActions === 0) {
				result.status = SceneExecutionStatus.COMPLETED;
			} else if (result.successfulActions > 0) {
				result.status = SceneExecutionStatus.PARTIALLY_COMPLETED;
			} else {
				result.status = SceneExecutionStatus.FAILED;
				result.error = 'All actions failed';
			}

			result.completedAt = new Date().toISOString();

			// Update last triggered timestamp (non-critical, don't let it affect execution result)
			try {
				await this.scenesService.updateLastTriggered(sceneId);
			} catch (updateError) {
				this.logger.warn(
					`[TRIGGER] Failed to update lastTriggeredAt for scene id=${sceneId}: ${(updateError as Error).message}`,
				);
			}

			// Emit appropriate event
			if (result.status === SceneExecutionStatus.COMPLETED) {
				this.eventEmitter.emit(EventType.SCENE_EXECUTION_COMPLETED, result);
			} else {
				this.eventEmitter.emit(EventType.SCENE_EXECUTION_FAILED, result);
			}

			this.eventEmitter.emit(EventType.SCENE_TRIGGERED, {
				id: sceneId,
				result,
			});

			this.logger.debug(`[TRIGGER] Scene execution completed with status=${result.status}`);

			return result;
		} catch (error) {
			const err = error as Error;

			result.status = SceneExecutionStatus.FAILED;
			result.error = err.message;
			result.completedAt = new Date().toISOString();

			this.logger.error(`[TRIGGER] Scene execution failed: ${err.message}`);

			this.eventEmitter.emit(EventType.SCENE_EXECUTION_FAILED, result);

			throw new ScenesExecutionException(`Scene execution failed: ${err.message}`);
		}
	}

	/**
	 * Evaluate scene conditions
	 * Note: Conditions are not supported in the current implementation.
	 * This method always returns true.
	 */
	private evaluateConditions(_scene: SceneEntity): boolean {
		// Conditions are not implemented - always execute
		return true;
	}

	/**
	 * Execute scene actions in order
	 */
	private async executeActions(scene: SceneEntity): Promise<ActionExecutionResultModel[]> {
		const actions = (scene.actions || []).filter((a) => a.enabled).sort((a, b) => a.order - b.order);

		if (actions.length === 0) {
			this.logger.debug(`[EXECUTE] No enabled actions to execute for scene id=${scene.id}`);
			return [];
		}

		this.logger.debug(`[EXECUTE] Executing ${actions.length} actions for scene id=${scene.id}`);

		const results: ActionExecutionResultModel[] = [];

		for (const action of actions) {
			const startTime = Date.now();

			try {
				const platform = this.getPlatform(action.type);

				if (!platform) {
					throw new Error(`No platform registered for action type: ${action.type}`);
				}

				// Execute single action through platform
				const actionResults = await platform.execute(scene, [action]);

				if (actionResults.length > 0) {
					results.push(actionResults[0]);
				} else {
					results.push({
						actionId: action.id,
						success: true,
						error: null,
						executionTimeMs: Date.now() - startTime,
					});
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[EXECUTE] Action ${action.id} failed: ${err.message}`);

				results.push({
					actionId: action.id,
					success: false,
					error: err.message,
					executionTimeMs: Date.now() - startTime,
				});
			}
		}

		return results;
	}
}
