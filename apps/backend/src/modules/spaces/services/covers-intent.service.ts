import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { CoversIntentDto } from '../dto/covers-intent.dto';
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
import { SpaceCoversRoleService } from './space-covers-role.service';
import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

/**
 * Represents a window covering device with its channel, properties, and role.
 */
export interface CoverDevice {
	device: DeviceEntity;
	coverChannel: ChannelEntity;
	positionProperty: ChannelPropertyEntity | null;
	commandProperty: ChannelPropertyEntity | null;
	tiltProperty: ChannelPropertyEntity | null;
	role: CoversRole | null;
}

/**
 * Result of role-based cover selection for a mode.
 */
export interface CoverModeSelection {
	cover: CoverDevice;
	rule: CoversRolePositionRule;
}

/**
 * State information for covers in a space.
 */
export interface CoversState {
	hasCovers: boolean;
	averagePosition: number | null;
	anyOpen: boolean;
	allClosed: boolean;
	devicesCount: number;
	coversByRole: Record<string, number>;
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
		private readonly coversRoleService: SpaceCoversRoleService,
		private readonly eventEmitter: EventEmitter2,
		@Inject(forwardRef(() => SpaceContextSnapshotService))
		private readonly contextSnapshotService: SpaceContextSnapshotService,
		@Inject(forwardRef(() => SpaceUndoHistoryService))
		private readonly undoHistoryService: SpaceUndoHistoryService,
	) {
		super();
	}

	/**
	 * Get the current covers state for a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async getCoversState(spaceId: string): Promise<CoversState | null> {
		const defaultState: CoversState = {
			hasCovers: false,
			averagePosition: null,
			anyOpen: false,
			allClosed: true,
			devicesCount: 0,
			coversByRole: {},
		};

		// Verify space exists - return null for controller to throw 404
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return null;
		}

		// Get all covers in the space
		const covers = await this.getCoversInSpace(spaceId);

		if (covers.length === 0) {
			this.logger.debug(`No covers found in space id=${spaceId}`);
			return defaultState;
		}

		// Aggregate position values
		const positions: number[] = [];
		let anyOpen = false;
		let allClosed = true;
		const coversByRole: Record<string, number> = {};

		for (const cover of covers) {
			const position = this.getPropertyNumericValue(cover.positionProperty);

			if (position !== null) {
				positions.push(position);

				if (position > 0) {
					anyOpen = true;
				}
				if (position > 0) {
					allClosed = false;
				}
			}

			// Count by role
			const roleKey = cover.role ?? 'unassigned';
			coversByRole[roleKey] = (coversByRole[roleKey] ?? 0) + 1;
		}

		const averagePosition = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null;

		return {
			hasCovers: true,
			averagePosition: averagePosition !== null ? Math.round(averagePosition) : null,
			anyOpen,
			allClosed,
			devicesCount: covers.length,
			coversByRole,
		};
	}

	/**
	 * Execute a covers intent for all covers in a space.
	 */
	async executeCoversIntent(spaceId: string, intent: CoversIntentDto): Promise<CoversIntentResult> {
		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);
			return { success: false, affectedDevices: 0, failedDevices: 0, newPosition: null };
		}

		// Get all covers in the space
		const covers = await this.getCoversInSpace(spaceId);

		if (covers.length === 0) {
			this.logger.debug(`No covers found in space id=${spaceId}`);
			return { success: true, affectedDevices: 0, failedDevices: 0, newPosition: null };
		}

		this.logger.debug(`Found ${covers.length} covers in space id=${spaceId}`);

		// Capture snapshot for undo BEFORE executing the intent
		await this.captureUndoSnapshot(spaceId, intent);

		let result: CoversIntentResult;

		switch (intent.type) {
			case CoversIntentType.OPEN:
				result = await this.executePositionIntent(covers, 100);
				break;

			case CoversIntentType.CLOSE:
				result = await this.executePositionIntent(covers, 0);
				break;

			case CoversIntentType.SET_POSITION:
				result = await this.executePositionIntent(covers, intent.position ?? 0);
				break;

			case CoversIntentType.POSITION_DELTA:
				result = await this.executePositionDeltaIntent(covers, intent.delta, intent.increase);
				break;

			case CoversIntentType.ROLE_POSITION:
				result = await this.executeRolePositionIntent(covers, intent.role, intent.position ?? 0);
				break;

			case CoversIntentType.SET_MODE:
				result = await this.executeModeIntent(covers, intent.mode);
				break;

			default:
				this.logger.warn(`Unknown covers intent type: ${String(intent.type)}`);
				return { success: false, affectedDevices: 0, failedDevices: 0, newPosition: null };
		}

		// Emit state change event for WebSocket clients (fire and forget)
		if (result.success) {
			void this.emitCoversStateChange(spaceId);
		}

		return result;
	}

	// =====================
	// Private Methods
	// =====================

	/**
	 * Find all window covering devices in a space with their channels, properties, and roles.
	 * Excludes covers with HIDDEN role as they should not be controlled by intents.
	 */
	private async getCoversInSpace(spaceId: string): Promise<CoverDevice[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const covers: CoverDevice[] = [];

		// Get role map for this space
		const roleMap = await this.coversRoleService.getRoleMap(spaceId);

		for (const device of devices) {
			// Check if device is a window covering device
			if (device.category !== DeviceCategory.WINDOW_COVERING) {
				continue;
			}

			// Find ALL window covering channels
			const coverChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.WINDOW_COVERING) ?? [];

			for (const coverChannel of coverChannels) {
				// Find position property (primary control)
				const positionProperty = coverChannel.properties?.find((p) => p.category === PropertyCategory.POSITION) ?? null;

				// Find command property (open/close/stop)
				const commandProperty = coverChannel.properties?.find((p) => p.category === PropertyCategory.COMMAND) ?? null;

				// Find tilt property (optional)
				const tiltProperty = coverChannel.properties?.find((p) => p.category === PropertyCategory.TILT) ?? null;

				// Must have position or command to be controllable
				if (!positionProperty && !commandProperty) {
					continue;
				}

				// Get role assignment for this cover (keyed by deviceId:channelId)
				const roleKey = `${device.id}:${coverChannel.id}`;
				const roleEntity = roleMap.get(roleKey);
				const role = roleEntity?.role ?? null;

				// Skip HIDDEN covers - they should not be controlled by intents
				if (role === CoversRole.HIDDEN) {
					this.logger.debug(`Skipping HIDDEN cover deviceId=${device.id} channelId=${coverChannel.id}`);
					continue;
				}

				covers.push({
					device,
					coverChannel,
					positionProperty,
					commandProperty,
					tiltProperty,
					role,
				});
			}
		}

		return covers;
	}

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
	 * Execute a mode-based covers intent using role-based orchestration.
	 */
	private async executeModeIntent(covers: CoverDevice[], mode: CoversMode | undefined): Promise<CoversIntentResult> {
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
			const state = await this.getCoversState(spaceId);

			if (state) {
				this.eventEmitter.emit(EventType.COVERS_STATE_CHANGED, {
					space_id: spaceId,
					state,
				});

				this.logger.debug(`Emitted covers state change event spaceId=${spaceId}`);
			}
		} catch (error) {
			this.logger.error(`Failed to emit covers state change event spaceId=${spaceId}: ${error}`);
		}
	}
}
