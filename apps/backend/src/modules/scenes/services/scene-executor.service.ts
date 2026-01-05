import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DEFAULT_TTL_SCENE, IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentTarget, IntentTargetResult } from '../../intents/models/intent.model';
import { IntentsService } from '../../intents/services/intents.service';
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
		private readonly intentsService: IntentsService,
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

		// Extract intent targets with full details from scene actions
		const targets = this.extractIntentTargets(scene.actions || []);

		// Create the intent for scene execution
		const intent = this.intentsService.createIntent({
			type: IntentType.SCENE_RUN,
			scope: {
				spaceId: scene.primarySpaceId || undefined,
			},
			targets,
			value: { sceneId: scene.id, sceneName: scene.name },
			ttlMs: DEFAULT_TTL_SCENE,
		});

		this.logger.log(`[TRIGGER] Created intent ${intent.id} for scene ${sceneId} with ${targets.length} target(s)`);

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

			// Map action results to intent results
			const intentResults = this.mapActionResultsToIntentResults(actionResults, scene.actions || []);

			// Complete the intent
			this.intentsService.completeIntent(intent.id, intentResults);

			this.logger.log(`[TRIGGER] Completed intent ${intent.id} for scene ${sceneId}`);

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

			return result;
		} catch (error) {
			const err = error as Error;

			result.status = SceneExecutionStatus.FAILED;
			result.error = err.message;
			result.completedAt = new Date().toISOString();

			// Complete intent with failure - map targets to failed results
			const failedResults: IntentTargetResult[] = targets.map((target) => ({
				deviceId: target.deviceId,
				channelId: target.channelId,
				propertyId: target.propertyId,
				status: IntentTargetStatus.FAILED,
				error: err.message,
			}));

			this.intentsService.completeIntent(intent.id, failedResults);

			this.logger.error(`[TRIGGER] Scene execution failed: ${err.message}`);

			this.eventEmitter.emit(EventType.SCENE_EXECUTION_FAILED, result);

			throw new ScenesExecutionException(`Scene execution failed: ${err.message}`);
		}
	}

	/**
	 * Extract unique device IDs from scene actions
	 */
	private extractDeviceIds(actions: SceneActionEntity[]): string[] {
		const deviceIds = new Set<string>();

		for (const action of actions) {
			// Device ID is stored in configuration.device_id for scene actions
			const deviceId = action.configuration?.device_id;

			if (typeof deviceId === 'string') {
				deviceIds.add(deviceId);
			}
		}

		return Array.from(deviceIds);
	}

	/**
	 * Extract intent targets with full details from scene actions
	 */
	private extractIntentTargets(actions: SceneActionEntity[]): IntentTarget[] {
		const targets: IntentTarget[] = [];

		for (const action of actions) {
			const deviceId = action.configuration?.device_id;
			const channelId = action.configuration?.channel_id;
			const propertyId = action.configuration?.property_id;

			if (typeof deviceId === 'string') {
				targets.push({
					deviceId,
					channelId: typeof channelId === 'string' ? channelId : undefined,
					propertyId: typeof propertyId === 'string' ? propertyId : undefined,
				});
			}
		}

		return targets;
	}

	/**
	 * Map action execution results to intent target results
	 */
	private mapActionResultsToIntentResults(
		actionResults: ActionExecutionResultModel[],
		actions: SceneActionEntity[],
	): IntentTargetResult[] {
		const results: IntentTargetResult[] = [];

		for (const actionResult of actionResults) {
			// Find the corresponding action to get the target details
			const action = actions.find((a) => a.id === actionResult.actionId);

			// Extract IDs from configuration
			const deviceId = action?.configuration?.device_id;
			const channelId = action?.configuration?.channel_id;
			const propertyId = action?.configuration?.property_id;

			if (typeof deviceId === 'string') {
				results.push({
					deviceId,
					channelId: typeof channelId === 'string' ? channelId : undefined,
					propertyId: typeof propertyId === 'string' ? propertyId : undefined,
					status: actionResult.success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
					error: actionResult.error || undefined,
				});
			}
		}

		return results;
	}

	/**
	 * Execute scene actions in order
	 */
	private async executeActions(scene: SceneEntity): Promise<ActionExecutionResultModel[]> {
		const actions = (scene.actions || []).filter((a) => a.enabled).sort((a, b) => a.order - b.order);

		if (actions.length === 0) {
			return [];
		}

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
