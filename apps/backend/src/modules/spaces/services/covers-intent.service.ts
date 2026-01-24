import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { DEFAULT_TTL_SPACE_COMMAND, IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentTarget, IntentTargetResult } from '../../intents/models/intent.model';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { IntentsService } from '../../intents/services/intents.service';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { CoversStateDataModel } from '../models/spaces-response.model';
import {
	COVERS_MODE_ORCHESTRATION,
	CoversIntentType,
	CoversMode,
	CoversRole,
	CoversRolePositionRule,
	EventType,
	POSITION_DELTA_STEPS,
	PositionDelta,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { CoverDevice, CoversState, SpaceCoversStateService } from './space-covers-state.service';
import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

// Re-export types for backwards compatibility
export { CoverDevice, CoversState } from './space-covers-state.service';

/**
 * Result of role-based cover selection for a mode.
 */
export interface CoverModeSelection {
	cover: CoverDevice;
	rule: CoversRolePositionRule;
}

/**
 * Result of a covers intent execution.
 */
export interface CoversIntentResult extends IntentExecutionResult {
	newPosition: number | null;
}

/**
 * Pure function to select covers based on their roles for a given covers mode.
 * This function is deterministic and handles:
 * - Full role configuration: Apply mode-specific rules per role
 * - No role configuration: Apply MVP behavior (all covers to same position)
 *
 * @param covers - All covers in the space with their role assignments
 * @param mode - The covers mode to apply
 * @returns Array of cover selections with rules to apply
 */
export function selectCoversForMode(covers: CoverDevice[], mode: CoversMode): CoverModeSelection[] {
	const selections: CoverModeSelection[] = [];
	const modeConfig = COVERS_MODE_ORCHESTRATION[mode];

	// Check if any covers have roles configured
	const hasAnyRoles = covers.some((cover) => cover.role !== null);

	if (!hasAnyRoles) {
		// MVP fallback: no roles configured, apply same position to all covers
		// Use the PRIMARY role's position as the default
		const defaultRule = modeConfig[CoversRole.PRIMARY] ?? { position: mode === CoversMode.OPEN ? 100 : 0 };

		for (const cover of covers) {
			selections.push({
				cover,
				rule: defaultRule,
			});
		}

		return selections;
	}

	// Apply role-based rules
	for (const cover of covers) {
		let rule: CoversRolePositionRule;

		if (cover.role === null) {
			// Cover has no role assigned - treat as PRIMARY
			const primaryRule = modeConfig[CoversRole.PRIMARY];
			rule = primaryRule ?? { position: mode === CoversMode.OPEN ? 100 : 0 };
		} else {
			// Apply the rule for this role
			const roleRule = modeConfig[cover.role];
			rule = roleRule ?? { position: mode === CoversMode.OPEN ? 100 : 0 };
		}

		selections.push({ cover, rule });
	}

	return selections;
}

/**
 * Service handling all covers-related intent operations.
 * Manages cover state, mode-based orchestration, and position control.
 */
@Injectable()
export class CoversIntentService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'CoversIntentService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly platformRegistryService: PlatformRegistryService,
		@Inject(forwardRef(() => SpaceCoversStateService))
		private readonly coversStateService: SpaceCoversStateService,
		private readonly eventEmitter: EventEmitter2,
		@Inject(forwardRef(() => SpaceContextSnapshotService))
		private readonly contextSnapshotService: SpaceContextSnapshotService,
		@Inject(forwardRef(() => SpaceUndoHistoryService))
		private readonly undoHistoryService: SpaceUndoHistoryService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
		@Inject(forwardRef(() => IntentsService))
		private readonly intentsService: IntentsService,
	) {
		super();
	}

	/**
	 * Get the current covers state for a space.
	 * Delegates to SpaceCoversStateService.
	 */
	async getCoversState(spaceId: string): Promise<CoversState | null> {
		return this.coversStateService.getCoversState(spaceId);
	}

	/**
	 * Execute a covers intent for all covers in a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async executeCoversIntent(spaceId: string, intent: CoversIntentDto): Promise<CoversIntentResult | null> {
		// Verify space exists - return null for controller to throw 404
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);
			return null;
		}

		// Get all covers in the space
		const covers = await this.coversStateService.getCoversInSpace(spaceId);

		if (covers.length === 0) {
			this.logger.debug(`No covers found in space id=${spaceId}`);
			return { success: true, affectedDevices: 0, failedDevices: 0, newPosition: null };
		}

		this.logger.debug(`Found ${covers.length} covers in space id=${spaceId}`);

		// Build targets for intent (all covers that will be affected)
		const targets = this.buildCoversTargets(covers, intent);

		// Create intent before executing (emits Intent.Created event)
		const intentRecord = this.intentsService.createIntent({
			type: this.mapCoversIntentType(intent.type),
			context: {
				origin: 'panel.spaces',
				spaceId,
				roleKey: intent.role ?? undefined,
			},
			targets,
			value: this.buildCoversIntentValue(intent),
			ttlMs: DEFAULT_TTL_SPACE_COMMAND,
		});

		// Capture snapshot for undo BEFORE executing the intent
		await this.captureUndoSnapshot(spaceId, intent);

		let result: CoversIntentResult;
		const targetResults: IntentTargetResult[] = [];

		switch (intent.type) {
			case CoversIntentType.OPEN:
				result = await this.executePositionIntentWithResults(covers, 100, targetResults);
				break;

			case CoversIntentType.CLOSE:
				result = await this.executePositionIntentWithResults(covers, 0, targetResults);
				break;

			case CoversIntentType.STOP:
				result = await this.executeStopIntentWithResults(covers, targetResults);
				break;

			case CoversIntentType.SET_POSITION:
				result = await this.executePositionIntentWithResults(covers, intent.position ?? 0, targetResults);
				break;

			case CoversIntentType.POSITION_DELTA:
				result = await this.executePositionDeltaIntentWithResults(covers, intent.delta, intent.increase, targetResults);
				break;

			case CoversIntentType.ROLE_POSITION:
				result = await this.executeRolePositionIntentWithResults(
					covers,
					intent.role,
					intent.position ?? 0,
					targetResults,
				);
				break;

			case CoversIntentType.SET_MODE:
				result = await this.executeModeIntentWithResults(spaceId, covers, intent.mode, targetResults);
				break;

			default:
				this.logger.warn(`Unknown covers intent type: ${String(intent.type)}`);
				this.intentsService.completeIntent(intentRecord.id, []);
				return { success: false, affectedDevices: 0, failedDevices: 0, newPosition: null };
		}

		// Complete intent with results (emits Intent.Completed event)
		this.intentsService.completeIntent(intentRecord.id, targetResults);

		// Emit state change event for WebSocket clients (fire and forget)
		if (result.success) {
			void this.emitCoversStateChange(spaceId);
		}

		return result;
	}

	/**
	 * Build intent targets from covers.
	 */
	private buildCoversTargets(covers: CoverDevice[], intent: CoversIntentDto): IntentTarget[] {
		// For role-specific intents, filter by role
		if (intent.type === CoversIntentType.ROLE_POSITION && intent.role) {
			const roleCovers = covers.filter((cover) => cover.role === intent.role);

			return roleCovers.map((cover) => ({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
			}));
		}

		return covers.map((cover) => ({
			deviceId: cover.device.id,
			channelId: cover.coverChannel.id,
		}));
	}

	/**
	 * Map CoversIntentType to IntentType.
	 */
	private mapCoversIntentType(type: CoversIntentType): IntentType {
		switch (type) {
			case CoversIntentType.OPEN:
				return IntentType.SPACE_COVERS_OPEN;
			case CoversIntentType.CLOSE:
				return IntentType.SPACE_COVERS_CLOSE;
			case CoversIntentType.STOP:
				return IntentType.SPACE_COVERS_STOP;
			case CoversIntentType.SET_POSITION:
				return IntentType.SPACE_COVERS_SET_POSITION;
			case CoversIntentType.POSITION_DELTA:
				return IntentType.SPACE_COVERS_POSITION_DELTA;
			case CoversIntentType.ROLE_POSITION:
				return IntentType.SPACE_COVERS_ROLE_POSITION;
			case CoversIntentType.SET_MODE:
				return IntentType.SPACE_COVERS_SET_MODE;
			default:
				return IntentType.SPACE_COVERS_SET_POSITION;
		}
	}

	/**
	 * Build intent value from CoversIntentDto.
	 */
	private buildCoversIntentValue(intent: CoversIntentDto): unknown {
		const value: Record<string, unknown> = {};

		if (intent.position !== undefined) value.position = intent.position;
		if (intent.delta !== undefined) value.delta = intent.delta;
		if (intent.increase !== undefined) value.increase = intent.increase;
		if (intent.role !== undefined) value.role = intent.role;
		if (intent.mode !== undefined) value.mode = intent.mode;

		return Object.keys(value).length > 0 ? value : null;
	}

	// =====================
	// Private Methods
	// =====================

	/**
	 * Execute a position intent for all covers.
	 */
	private async executePositionIntent(covers: CoverDevice[], position: number): Promise<CoversIntentResult> {
		let affectedDevices = 0;
		let failedDevices = 0;

		for (const cover of covers) {
			const success = await this.setCoverPosition(cover, position);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Position intent completed position=${position} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: position };
	}

	/**
	 * Execute a position intent with per-target results tracking.
	 */
	private async executePositionIntentWithResults(
		covers: CoverDevice[],
		position: number,
		targetResults: IntentTargetResult[],
	): Promise<CoversIntentResult> {
		let affectedDevices = 0;
		let failedDevices = 0;

		for (const cover of covers) {
			const success = await this.setCoverPosition(cover, position);

			targetResults.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
			});

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Position intent completed position=${position} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: position };
	}

	/**
	 * Execute a position delta intent.
	 */
	private async executePositionDeltaIntent(
		covers: CoverDevice[],
		delta: PositionDelta | undefined,
		increase: boolean | undefined,
	): Promise<CoversIntentResult> {
		const deltaValue = POSITION_DELTA_STEPS[delta ?? PositionDelta.MEDIUM] ?? 25;
		const shouldIncrease = increase ?? true;
		let affectedDevices = 0;
		let failedDevices = 0;
		let totalNewPosition = 0;
		let positionCount = 0;

		for (const cover of covers) {
			// Get current position
			const currentPosition = this.getPropertyNumericValue(cover.positionProperty) ?? 50;

			// Calculate new position
			let newPosition = shouldIncrease ? currentPosition + deltaValue : currentPosition - deltaValue;
			newPosition = this.clampValue(newPosition, 0, 100);

			const success = await this.setCoverPosition(cover, newPosition);

			if (success) {
				affectedDevices++;
				totalNewPosition += newPosition;
				positionCount++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;
		const averagePosition = positionCount > 0 ? Math.round(totalNewPosition / positionCount) : null;

		this.logger.debug(
			`Position delta intent completed delta=${String(delta)} increase=${String(shouldIncrease)} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: averagePosition };
	}

	/**
	 * Execute a position delta intent with per-target results tracking.
	 */
	private async executePositionDeltaIntentWithResults(
		covers: CoverDevice[],
		delta: PositionDelta | undefined,
		increase: boolean | undefined,
		targetResults: IntentTargetResult[],
	): Promise<CoversIntentResult> {
		const deltaValue = POSITION_DELTA_STEPS[delta ?? PositionDelta.MEDIUM] ?? 25;
		const shouldIncrease = increase ?? true;
		let affectedDevices = 0;
		let failedDevices = 0;
		let totalNewPosition = 0;
		let positionCount = 0;

		for (const cover of covers) {
			const currentPosition = this.getPropertyNumericValue(cover.positionProperty) ?? 50;
			let newPosition = shouldIncrease ? currentPosition + deltaValue : currentPosition - deltaValue;
			newPosition = this.clampValue(newPosition, 0, 100);

			const success = await this.setCoverPosition(cover, newPosition);

			targetResults.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
			});

			if (success) {
				affectedDevices++;
				totalNewPosition += newPosition;
				positionCount++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;
		const averagePosition = positionCount > 0 ? Math.round(totalNewPosition / positionCount) : null;

		this.logger.debug(
			`Position delta intent completed delta=${String(delta)} increase=${String(shouldIncrease)} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: averagePosition };
	}

	/**
	 * Execute a role-specific position intent.
	 */
	private async executeRolePositionIntent(
		allCovers: CoverDevice[],
		role: CoversRole | undefined,
		position: number,
	): Promise<CoversIntentResult> {
		const targetRole = role ?? CoversRole.PRIMARY;

		// Filter covers to only those with the specified role
		const roleCovers = allCovers.filter((cover) => cover.role === targetRole);

		if (roleCovers.length === 0) {
			this.logger.debug(`No covers found with role=${String(targetRole)}`);
			return { success: true, affectedDevices: 0, failedDevices: 0, newPosition: position };
		}

		let affectedDevices = 0;
		let failedDevices = 0;

		for (const cover of roleCovers) {
			const success = await this.setCoverPosition(cover, position);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Role position intent completed role=${role} position=${position} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: position };
	}

	/**
	 * Execute a role-specific position intent with per-target results tracking.
	 */
	private async executeRolePositionIntentWithResults(
		allCovers: CoverDevice[],
		role: CoversRole | undefined,
		position: number,
		targetResults: IntentTargetResult[],
	): Promise<CoversIntentResult> {
		const targetRole = role ?? CoversRole.PRIMARY;
		const roleCovers = allCovers.filter((cover) => cover.role === targetRole);

		if (roleCovers.length === 0) {
			this.logger.debug(`No covers found with role=${String(targetRole)}`);
			return { success: true, affectedDevices: 0, failedDevices: 0, newPosition: position };
		}

		let affectedDevices = 0;
		let failedDevices = 0;

		for (const cover of roleCovers) {
			const success = await this.setCoverPosition(cover, position);

			targetResults.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
			});

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Role position intent completed role=${role} position=${position} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: position };
	}

	/**
	 * Execute a stop intent with per-target results tracking.
	 */
	private async executeStopIntentWithResults(
		covers: CoverDevice[],
		targetResults: IntentTargetResult[],
	): Promise<CoversIntentResult> {
		let affectedDevices = 0;
		let failedDevices = 0;

		for (const cover of covers) {
			const success = await this.stopCover(cover);

			targetResults.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
			});

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(`Stop intent completed affected=${affectedDevices} failed=${failedDevices}`);

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: null };
	}

	/**
	 * Execute a mode-based covers intent using role-based orchestration.
	 */
	private async executeModeIntent(
		spaceId: string,
		covers: CoverDevice[],
		mode: CoversMode | undefined,
	): Promise<CoversIntentResult> {
		const targetMode = mode ?? CoversMode.OPEN;

		// Use the pure function to determine what to do with each cover
		const selections = selectCoversForMode(covers, targetMode);

		// Log telemetry for role-based selection
		const hasRoles = covers.some((c) => c.role !== null);

		this.logger.log(`Mode intent mode=${targetMode} totalCovers=${covers.length} hasRoles=${hasRoles}`);

		let affectedDevices = 0;
		let failedDevices = 0;
		let totalPosition = 0;
		let positionCount = 0;

		// Execute commands for each cover based on its selection
		for (const selection of selections) {
			const success = await this.setCoverPosition(selection.cover, selection.rule.position);

			if (success) {
				affectedDevices++;
				totalPosition += selection.rule.position;
				positionCount++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;
		const averagePosition = positionCount > 0 ? Math.round(totalPosition / positionCount) : null;

		this.logger.debug(`Mode intent completed mode=${mode} affected=${affectedDevices} failed=${failedDevices}`);

		// Store mode change to InfluxDB for historical tracking (fire and forget)
		if (overallSuccess) {
			void this.intentTimeseriesService.storeCoversPositionChange(
				spaceId,
				targetMode,
				selections.length,
				affectedDevices,
				failedDevices,
			);
			// Mark mode as valid (set by intent, not manual adjustment)
			void this.intentTimeseriesService.storeModeValidity(spaceId, 'covers', true);
		}

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: averagePosition };
	}

	/**
	 * Execute a mode-based covers intent with per-target results tracking.
	 */
	private async executeModeIntentWithResults(
		spaceId: string,
		covers: CoverDevice[],
		mode: CoversMode | undefined,
		targetResults: IntentTargetResult[],
	): Promise<CoversIntentResult> {
		const targetMode = mode ?? CoversMode.OPEN;
		const selections = selectCoversForMode(covers, targetMode);
		const hasRoles = covers.some((c) => c.role !== null);

		this.logger.log(`Mode intent mode=${targetMode} totalCovers=${covers.length} hasRoles=${hasRoles}`);

		let affectedDevices = 0;
		let failedDevices = 0;
		let totalPosition = 0;
		let positionCount = 0;

		for (const selection of selections) {
			const success = await this.setCoverPosition(selection.cover, selection.rule.position);

			targetResults.push({
				deviceId: selection.cover.device.id,
				channelId: selection.cover.coverChannel.id,
				status: success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
			});

			if (success) {
				affectedDevices++;
				totalPosition += selection.rule.position;
				positionCount++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;
		const averagePosition = positionCount > 0 ? Math.round(totalPosition / positionCount) : null;

		this.logger.debug(`Mode intent completed mode=${mode} affected=${affectedDevices} failed=${failedDevices}`);

		if (overallSuccess) {
			void this.intentTimeseriesService.storeCoversPositionChange(
				spaceId,
				targetMode,
				selections.length,
				affectedDevices,
				failedDevices,
			);
			// Mark mode as valid (set by intent, not manual adjustment)
			void this.intentTimeseriesService.storeModeValidity(spaceId, 'covers', true);
		}

		return { success: overallSuccess, affectedDevices, failedDevices, newPosition: averagePosition };
	}

	/**
	 * Set position on a single cover device.
	 */
	private async setCoverPosition(cover: CoverDevice, position: number): Promise<boolean> {
		const platform = this.platformRegistryService.get(cover.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${cover.device.id} type=${cover.device.type}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		// Set position if supported
		if (cover.positionProperty) {
			// Clamp to property's min/max range
			const { min, max } = this.getPropertyMinMax(cover.positionProperty, 0, 100);
			const clampedPosition = this.clampValue(position, min, max);

			commands.push({
				device: cover.device,
				channel: cover.coverChannel,
				property: cover.positionProperty,
				value: clampedPosition,
			});
		} else if (cover.commandProperty) {
			// Fall back to open/close command if no position property
			// 0 = close, 100 = open, anything in between = open
			const command = position === 0 ? 'close' : 'open';

			commands.push({
				device: cover.device,
				channel: cover.coverChannel,
				property: cover.commandProperty,
				value: command,
			});
		}

		if (commands.length === 0) {
			this.logger.debug(`No position commands for device id=${cover.device.id}`);
			return true;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Command execution failed for device id=${cover.device.id}`);
				return false;
			}

			this.logger.debug(`Successfully set position=${position} on device id=${cover.device.id}`);
			return true;
		} catch (error) {
			this.logger.error(`Error executing command for device id=${cover.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Stop movement on a single cover device.
	 */
	private async stopCover(cover: CoverDevice): Promise<boolean> {
		const platform = this.platformRegistryService.get(cover.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${cover.device.id} type=${cover.device.type}`);
			return false;
		}

		// Stop command requires the command property
		if (!cover.commandProperty) {
			this.logger.debug(`No command property for device id=${cover.device.id}, cannot stop`);
			return true; // Consider success if device doesn't support stop
		}

		const commands: IDevicePropertyData[] = [
			{
				device: cover.device,
				channel: cover.coverChannel,
				property: cover.commandProperty,
				value: 'stop',
			},
		];

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Stop command execution failed for device id=${cover.device.id}`);
				return false;
			}

			this.logger.debug(`Successfully stopped device id=${cover.device.id}`);
			return true;
		} catch (error) {
			this.logger.error(`Error executing stop command for device id=${cover.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Capture a snapshot for undo before executing a covers intent.
	 */
	private async captureUndoSnapshot(spaceId: string, intent: CoversIntentDto): Promise<void> {
		try {
			const snapshot = await this.contextSnapshotService.captureSnapshot(spaceId);

			if (!snapshot) {
				this.logger.debug(`Could not capture snapshot for undo spaceId=${spaceId}`);
				return;
			}

			const actionDescription = this.buildIntentDescription(intent);

			this.undoHistoryService.pushSnapshot(snapshot, actionDescription, 'covers');

			this.logger.debug(`Undo snapshot captured spaceId=${spaceId} action="${actionDescription}"`);
		} catch (error) {
			this.logger.error(`Error capturing undo snapshot spaceId=${spaceId}: ${error}`);
		}
	}

	/**
	 * Build a human-readable description of a covers intent.
	 */
	private buildIntentDescription(intent: CoversIntentDto): string {
		switch (intent.type) {
			case CoversIntentType.OPEN:
				return 'Open all covers';
			case CoversIntentType.CLOSE:
				return 'Close all covers';
			case CoversIntentType.STOP:
				return 'Stop all covers';
			case CoversIntentType.SET_POSITION:
				return `Set covers to ${intent.position ?? 0}%`;
			case CoversIntentType.POSITION_DELTA:
				return intent.increase ? 'Open covers more' : 'Close covers more';
			case CoversIntentType.ROLE_POSITION:
				return `Set ${intent.role ?? 'role'} covers to ${intent.position ?? 0}%`;
			case CoversIntentType.SET_MODE:
				return `Set covers mode to ${intent.mode ?? 'unknown'}`;
			default:
				return 'Covers intent';
		}
	}

	/**
	 * Emit a covers state change event for WebSocket clients.
	 * Fetches the current aggregated state and broadcasts it.
	 */
	private async emitCoversStateChange(spaceId: string): Promise<void> {
		try {
			// Skip mode validity synchronization - we're just broadcasting current state
			const state = await this.coversStateService.getCoversState(spaceId, {
				synchronizeModeValidity: false,
			});

			if (state) {
				// Convert to CoversStateDataModel for proper snake_case serialization via WebSocket
				const stateModel = CoversStateDataModel.fromState(state);

				this.eventEmitter.emit(EventType.COVERS_STATE_CHANGED, {
					space_id: spaceId,
					state: stateModel,
				});

				this.logger.debug(`Emitted covers state change event spaceId=${spaceId}`);
			}
		} catch (error) {
			this.logger.error(`Failed to emit covers state change event spaceId=${spaceId}: ${error}`);
		}
	}
}
