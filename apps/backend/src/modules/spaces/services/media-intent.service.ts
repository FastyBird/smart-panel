import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, ConnectionState, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { DEFAULT_TTL_SPACE_COMMAND, IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentTarget, IntentTargetResult } from '../../intents/models/intent.model';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { IntentsService } from '../../intents/services/intents.service';
import { MediaIntentDto } from '../dto/media-intent.dto';
import {
	EventType,
	MEDIA_CHANNEL_CATEGORIES,
	MEDIA_DEVICE_CATEGORIES,
	MEDIA_MODE_ORCHESTRATION,
	MediaIntentType,
	MediaMode,
	MediaRole,
	MediaRoleOrchestrationRule,
	SPACES_MODULE_NAME,
	VOLUME_DELTA_STEPS,
	VolumeDelta,
} from '../spaces.constants';

import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceMediaRoleService } from './space-media-role.service';
import { SpaceMediaState, SpaceMediaStateService } from './space-media-state.service';
import { SpacesService } from './spaces.service';

/**
 * Represents a media device with its channel, properties, and role.
 */
export interface MediaDevice {
	device: DeviceEntity;
	mediaChannel: ChannelEntity;
	onProperty: ChannelPropertyEntity | null;
	volumeProperty: ChannelPropertyEntity | null;
	muteProperty: ChannelPropertyEntity | null;
	role: MediaRole | null;
}

/**
 * Result of role-based media selection for a mode.
 * Contains the rule to apply and whether it's from fallback.
 */
export interface MediaModeSelection {
	media: MediaDevice;
	rule: MediaRoleOrchestrationRule;
	isFallback: boolean;
}

/**
 * Pure function to select media devices based on their roles for a given media mode.
 * This function is deterministic and handles:
 * - Full role configuration: Apply mode-specific rules per role
 * - Partial role configuration: Apply rules to configured devices, treat unconfigured as fallback
 * - No role configuration: Apply MVP behavior (all devices at mode volume)
 *
 * @param devices - All media devices in the space with their role assignments
 * @param mode - The media mode to apply
 * @returns Array of media selections with rules to apply
 */
export function selectMediaForMode(devices: MediaDevice[], mode: MediaMode): MediaModeSelection[] {
	const selections: MediaModeSelection[] = [];
	const modeConfig = MEDIA_MODE_ORCHESTRATION[mode];

	// Check if any devices have roles configured
	const hasAnyRoles = devices.some((d) => d.role !== null);

	if (!hasAnyRoles) {
		// MVP fallback: no roles configured, apply mode settings to all devices
		// For OFF mode, turn all off; otherwise use PRIMARY role defaults
		const fallbackRule = modeConfig[MediaRole.PRIMARY] ?? { power: false };

		for (const media of devices) {
			selections.push({
				media,
				rule: fallbackRule,
				isFallback: true,
			});
		}

		return selections;
	}

	// Apply role-based rules
	for (const media of devices) {
		let rule: MediaRoleOrchestrationRule;
		let isFallback = false;

		if (media.role === null) {
			// Device has no role assigned - apply same rule as SECONDARY or turn off
			const secondaryRule = modeConfig[MediaRole.SECONDARY];
			rule = secondaryRule ?? { power: false };
			isFallback = true; // Treat unconfigured devices as fallback
		} else if (media.role === MediaRole.HIDDEN) {
			// Hidden devices are never controlled
			continue;
		} else {
			// Apply the rule for this role
			const roleRule = modeConfig[media.role];
			rule = roleRule ?? { power: false };
		}

		selections.push({ media, rule, isFallback });
	}

	return selections;
}

/**
 * Extended result interface for media intent execution.
 */
export interface MediaIntentResult extends IntentExecutionResult {
	newVolume?: number;
	isMuted?: boolean;
	skippedDevices?: number;
	failedTargets?: string[];
}

export type MediaState = SpaceMediaState;
type CommandOutcome = IntentTargetStatus.SUCCESS | IntentTargetStatus.FAILED | IntentTargetStatus.SKIPPED;

/**
 * Service handling all media-related intent operations.
 * Manages media state, mode-based orchestration, and volume control.
 */
@Injectable()
export class MediaIntentService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'MediaIntentService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly mediaRoleService: SpaceMediaRoleService,
		private readonly eventEmitter: EventEmitter2,
		@Inject(forwardRef(() => SpaceMediaStateService))
		private readonly mediaStateService: SpaceMediaStateService,
		@Inject(forwardRef(() => IntentsService))
		private readonly intentsService: IntentsService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
	) {
		super();
	}

	/**
	 * Get the current media state for a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async getMediaState(spaceId: string): Promise<MediaState | null> {
		return this.mediaStateService.getMediaState(spaceId);
	}

	/**
	 * Execute a media intent for all media devices in a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async executeMediaIntent(spaceId: string, intent: MediaIntentDto): Promise<MediaIntentResult | null> {
		// Verify space exists - return null for controller to throw 404
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);
			return null;
		}

		// Get all media devices in the space
		const allDevices = await this.getMediaDevicesInSpace(spaceId);

		if (allDevices.length === 0) {
			this.logger.debug(`No media devices found in space id=${spaceId}`);
			return { success: true, affectedDevices: 0, failedDevices: 0, skippedOfflineDevices: 0 };
		}

		// Filter out offline devices
		const { online: devices, offlineIds } = this.filterOfflineMediaDevices(allDevices);

		if (offlineIds.length > 0) {
			this.logger.debug(`Skipping ${offlineIds.length} offline media device(s) in space id=${spaceId}`);
		}

		// Filter offline IDs by role for role-specific intents (applied early for all-offline check)
		const targetedOfflineIds = this.filterOfflineIdsByRole(allDevices, offlineIds, intent);

		// For role-specific intents, check if there are any online devices with the target role
		const hasOnlineTargetedDevices =
			this.isRoleSpecificIntent(intent.type) && intent.role
				? devices.some((d) => d.role === intent.role)
				: devices.length > 0;

		// If all targeted devices are offline, return early with appropriate result
		if (!hasOnlineTargetedDevices && targetedOfflineIds.length > 0) {
			this.logger.warn(`All ${targetedOfflineIds.length} targeted media device(s) are offline in space id=${spaceId}`);

			return {
				success: false,
				affectedDevices: 0,
				failedDevices: 0,
				skippedOfflineDevices: targetedOfflineIds.length,
				offlineDeviceIds: targetedOfflineIds,
			};
		}

		this.logger.debug(`Found ${devices.length} online media devices in space id=${spaceId}`);

		const targets = this.buildMediaTargets(allDevices);
		const targetResults: IntentTargetResult[] = [];

		// Add SKIPPED results for offline devices that were actually targeted
		// Use filter() to get all channels of multi-channel devices, matching how targets are built
		for (const deviceId of targetedOfflineIds) {
			const offlineDevices = allDevices.filter((d) => d.device.id === deviceId);

			for (const offlineDevice of offlineDevices) {
				targetResults.push({
					deviceId: offlineDevice.device.id,
					channelId: offlineDevice.mediaChannel.id,
					status: IntentTargetStatus.SKIPPED,
					error: 'Device offline',
				});
			}
		}

		const intentRecord = this.intentsService.createIntent({
			type: this.mapMediaIntentType(intent.type),
			context: {
				origin: 'panel.spaces',
				spaceId,
			},
			targets,
			value: this.buildMediaIntentValue(intent),
			ttlMs: DEFAULT_TTL_SPACE_COMMAND,
		});

		let result: MediaIntentResult;

		// For SET_MODE, use role-based orchestration
		if (intent.type === MediaIntentType.SET_MODE && intent.mode) {
			result = await this.executeModeIntent(spaceId, devices, intent.mode, targetResults);
		} else if (this.isRoleSpecificIntent(intent.type)) {
			// For role-specific intents, only affect devices with the specified role
			result = await this.executeRoleIntent(spaceId, devices, intent, targetResults);
		} else {
			// For other intents (POWER_ON, POWER_OFF, VOLUME_SET, VOLUME_DELTA, MUTE, UNMUTE), apply to all devices
			result = await this.executeGlobalIntent(spaceId, devices, intent, targetResults);
		}

		// Add skipped offline devices info to result (only those actually targeted)
		result.skippedOfflineDevices = targetedOfflineIds.length;

		if (targetedOfflineIds.length > 0) {
			result.offlineDeviceIds = targetedOfflineIds;
		}

		this.intentsService.completeIntent(intentRecord.id, targetResults);

		// Emit state change event for WebSocket clients (fire and forget)
		// Always emit state change so UI stays in sync
		void this.emitMediaStateChange(spaceId);

		// Only store "last applied" state when ALL devices succeeded
		// Partial failures should not update the stored state, as it would mislead
		// the panel about what was actually applied across all devices
		if (result.success && result.failedDevices === 0) {
			void this.storeMediaState(spaceId, intent, result);
		}

		return result;
	}

	/**
	 * Filter out offline devices from a list of media devices.
	 * Returns online devices and list of unique offline device IDs.
	 *
	 * Devices with UNKNOWN status are treated as potentially online and included
	 * in the online list (commands will fail naturally if device is truly offline).
	 *
	 * Note: A device may have multiple channels, so we use a Set to ensure
	 * each device ID appears only once in offlineIds.
	 */
	private filterOfflineMediaDevices(devices: MediaDevice[]): { online: MediaDevice[]; offlineIds: string[] } {
		const online: MediaDevice[] = [];
		const offlineIdSet = new Set<string>();

		for (const device of devices) {
			// Treat UNKNOWN status as potentially online - allow commands to attempt
			if (device.device.status.online || device.device.status.status === ConnectionState.UNKNOWN) {
				online.push(device);
			} else {
				offlineIdSet.add(device.device.id);
			}
		}

		return { online, offlineIds: [...offlineIdSet] };
	}

	/**
	 * Map MediaIntentType to IntentType for intent tracking.
	 */
	private mapMediaIntentType(type: MediaIntentType): IntentType {
		switch (type) {
			case MediaIntentType.POWER_ON:
				return IntentType.SPACE_MEDIA_POWER_ON;
			case MediaIntentType.POWER_OFF:
				return IntentType.SPACE_MEDIA_POWER_OFF;
			case MediaIntentType.VOLUME_SET:
				return IntentType.SPACE_MEDIA_VOLUME_SET;
			case MediaIntentType.VOLUME_DELTA:
				return IntentType.SPACE_MEDIA_VOLUME_DELTA;
			case MediaIntentType.MUTE:
				return IntentType.SPACE_MEDIA_MUTE;
			case MediaIntentType.UNMUTE:
				return IntentType.SPACE_MEDIA_UNMUTE;
			case MediaIntentType.ROLE_POWER:
				return IntentType.SPACE_MEDIA_ROLE_POWER;
			case MediaIntentType.ROLE_VOLUME:
				return IntentType.SPACE_MEDIA_ROLE_VOLUME;
			case MediaIntentType.PLAY:
				return IntentType.SPACE_MEDIA_PLAY;
			case MediaIntentType.PAUSE:
				return IntentType.SPACE_MEDIA_PAUSE;
			case MediaIntentType.STOP:
				return IntentType.SPACE_MEDIA_STOP;
			case MediaIntentType.NEXT:
				return IntentType.SPACE_MEDIA_NEXT;
			case MediaIntentType.PREVIOUS:
				return IntentType.SPACE_MEDIA_PREVIOUS;
			case MediaIntentType.INPUT_SET:
				return IntentType.SPACE_MEDIA_INPUT_SET;
			case MediaIntentType.SET_MODE:
				return IntentType.SPACE_MEDIA_SET_MODE;
			default:
				return IntentType.SPACE_MEDIA_POWER_ON;
		}
	}

	/**
	 * Build intent targets for tracking.
	 */
	private buildMediaTargets(devices: MediaDevice[]): IntentTarget[] {
		return devices.map((device) => ({ deviceId: device.device.id }));
	}

	/**
	 * Filter offline device IDs by role for role-specific intents.
	 *
	 * For role-specific intents (ROLE_POWER, ROLE_VOLUME), only returns offline
	 * device IDs that match the target role. For non-role-specific intents,
	 * returns all offline device IDs unchanged.
	 *
	 * @param allDevices - All media devices in the space (including offline)
	 * @param offlineIds - IDs of offline devices
	 * @param intent - The media intent being executed
	 * @returns Filtered list of offline device IDs that would have been targeted
	 */
	private filterOfflineIdsByRole(allDevices: MediaDevice[], offlineIds: string[], intent: MediaIntentDto): string[] {
		// For non-role-specific intents, all offline devices are targeted
		if (!this.isRoleSpecificIntent(intent.type) || !intent.role) {
			return offlineIds;
		}

		// Filter offline IDs to only those with at least one channel matching the target role
		// Uses some() instead of find() to check if ANY channel matches, since multi-channel
		// devices may have different roles per channel (e.g., TV with TELEVISION and SPEAKER)
		return offlineIds.filter((deviceId) => {
			return allDevices.some((d) => d.device.id === deviceId && d.role === intent.role);
		});
	}

	/**
	 * Build value payload for intent tracking.
	 */
	private buildMediaIntentValue(intent: MediaIntentDto): unknown {
		const value: Record<string, unknown> = {};

		if (intent.mode !== undefined) value.mode = intent.mode;
		if (intent.volume !== undefined) value.volume = intent.volume;
		if (intent.delta !== undefined) value.delta = intent.delta;
		if (intent.increase !== undefined) value.increase = intent.increase;
		if (intent.role !== undefined) value.role = intent.role;
		if (intent.on !== undefined) value.on = intent.on;
		if (intent.type !== undefined) value.intentType = intent.type;
		if (intent.source !== undefined) value.source = intent.source;

		return Object.keys(value).length > 0 ? value : null;
	}

	/**
	 * Get playback control properties from a device.
	 *
	 * This method supports two modes:
	 * 1. With preferredChannel: Only checks that specific channel to prevent duplicate
	 *    commands when a device has multiple media channels (e.g., TV with both
	 *    TELEVISION and MEDIA_PLAYBACK channels)
	 * 2. Without preferredChannel: Searches all channels for backward compatibility
	 *
	 * Property priority:
	 * - Primary: MEDIA_PLAYBACK channel → COMMAND property (direct playback control)
	 * - Fallback: TELEVISION channel → REMOTE_KEY property (simulated remote control)
	 *
	 * @param device - The device entity to search
	 * @param preferredChannel - Optional channel to restrict the search to
	 * @returns Channel and property references for playback control
	 */
	private getPlaybackProperties(
		device: DeviceEntity,
		preferredChannel?: ChannelEntity | null,
	): {
		channel: ChannelEntity | null;
		commandProperty: ChannelPropertyEntity | null;
		remoteKeyProperty: ChannelPropertyEntity | null;
	} {
		// If a preferred channel is provided, only check that specific channel
		// This prevents duplicate commands when a device has multiple media channels
		if (preferredChannel) {
			const isPlaybackChannel = preferredChannel.category === ChannelCategory.MEDIA_PLAYBACK;
			const isTelevisionChannel = preferredChannel.category === ChannelCategory.TELEVISION;

			if (isPlaybackChannel) {
				const commandProperty =
					preferredChannel.properties?.find((p) => p.category === PropertyCategory.COMMAND) ?? null;
				if (commandProperty) {
					return {
						channel: preferredChannel,
						commandProperty,
						remoteKeyProperty: null,
					};
				}
			}

			if (isTelevisionChannel) {
				const remoteKeyProperty =
					preferredChannel.properties?.find((p) => p.category === PropertyCategory.REMOTE_KEY) ?? null;
				if (remoteKeyProperty) {
					return {
						channel: preferredChannel,
						commandProperty: null,
						remoteKeyProperty,
					};
				}
			}

			// Preferred channel doesn't have playback capabilities, return empty result
			// This ensures we only execute playback commands on channels that support them
			return {
				channel: null,
				commandProperty: null,
				remoteKeyProperty: null,
			};
		}

		// No preferred channel specified, search all channels (backward compatibility)
		// Primary: media_playback.command
		const playbackChannel = device.channels?.find((ch) => ch.category === ChannelCategory.MEDIA_PLAYBACK) ?? null;
		const commandProperty = playbackChannel?.properties?.find((p) => p.category === PropertyCategory.COMMAND) ?? null;

		// Fallback: television.remote_key
		const televisionChannel = device.channels?.find((ch) => ch.category === ChannelCategory.TELEVISION) ?? null;
		const remoteKeyProperty =
			televisionChannel?.properties?.find((p) => p.category === PropertyCategory.REMOTE_KEY) ?? null;

		return {
			channel: commandProperty ? playbackChannel : (televisionChannel ?? playbackChannel ?? null),
			commandProperty,
			remoteKeyProperty,
		};
	}

	private getInputProperties(device: DeviceEntity): {
		channel: ChannelEntity | null;
		sourceProperty: ChannelPropertyEntity | null;
	} {
		// Prefer television.source
		const televisionChannel = device.channels?.find((ch) => ch.category === ChannelCategory.TELEVISION) ?? null;
		const televisionSource = televisionChannel?.properties?.find((p) => p.category === PropertyCategory.SOURCE) ?? null;

		if (televisionChannel && televisionSource) {
			return { channel: televisionChannel, sourceProperty: televisionSource };
		}

		// Fallback: media_input.source
		const inputChannel = device.channels?.find((ch) => ch.category === ChannelCategory.MEDIA_INPUT) ?? null;
		const sourceProperty = inputChannel?.properties?.find((p) => p.category === PropertyCategory.SOURCE) ?? null;

		return { channel: inputChannel ?? null, sourceProperty };
	}

	/**
	 * Persist last applied media intent state for restoration (InfluxDB).
	 */
	private async storeMediaState(spaceId: string, intent: MediaIntentDto, result: MediaIntentResult): Promise<void> {
		const intentType = this.mapMediaIntentType(intent.type);

		let mode: MediaMode | null = null;
		let volume: number | null = null;
		let muted: boolean | null = null;
		let role: string | null = null;
		let on: boolean | null = null;
		let source: string | null = null;

		switch (intent.type) {
			case MediaIntentType.SET_MODE:
				mode = intent.mode ?? null;
				break;
			case MediaIntentType.VOLUME_SET:
				volume = intent.volume ?? null;
				break;
			case MediaIntentType.VOLUME_DELTA:
				volume = result.newVolume ?? null;
				break;
			case MediaIntentType.MUTE:
				muted = true;
				break;
			case MediaIntentType.UNMUTE:
				muted = false;
				break;
			case MediaIntentType.POWER_ON:
				on = true;
				break;
			case MediaIntentType.POWER_OFF:
				on = false;
				break;
			case MediaIntentType.ROLE_VOLUME:
				volume = intent.volume ?? null;
				role = intent.role ?? null;
				break;
			case MediaIntentType.ROLE_POWER:
				on = intent.on ?? null;
				role = intent.role ?? null;
				break;
			case MediaIntentType.INPUT_SET:
				source = intent.source ?? null;
				break;
			case MediaIntentType.PLAY:
			case MediaIntentType.PAUSE:
			case MediaIntentType.STOP:
			case MediaIntentType.NEXT:
			case MediaIntentType.PREVIOUS:
				break;
		}

		await this.intentTimeseriesService.storeMediaStateChange(spaceId, intentType, {
			mode,
			volume,
			muted,
			role,
			on,
			source,
		});
	}

	/**
	 * Emit a media state change event for WebSocket clients.
	 * Fetches the current aggregated state and broadcasts it.
	 */
	private async emitMediaStateChange(spaceId: string): Promise<void> {
		try {
			const state = await this.mediaStateService.getMediaState(spaceId);

			if (state) {
				this.eventEmitter.emit(EventType.MEDIA_STATE_CHANGED, {
					space_id: spaceId,
					state,
				});

				this.logger.debug(`Emitted media state change event spaceId=${spaceId}`);
			}
		} catch (error) {
			this.logger.error(`Failed to emit media state change event spaceId=${spaceId}: ${error}`);
		}
	}

	/**
	 * Execute a global intent that affects all media devices.
	 */
	private async executeGlobalIntent(
		spaceId: string,
		devices: MediaDevice[],
		intent: MediaIntentDto,
		targetResults: IntentTargetResult[],
	): Promise<MediaIntentResult> {
		let affectedDevices = 0;
		let failedDevices = 0;
		let skippedDevices = 0;
		let newVolume: number | undefined;
		let isMuted: boolean | undefined;
		const volumeDeltaVolumes: number[] = [];

		// Track processed device IDs for playback intents to avoid duplicate commands
		// when a device has multiple media channels (e.g., TELEVISION + MEDIA_PLAYBACK)
		const isPlaybackIntent = [
			MediaIntentType.PLAY,
			MediaIntentType.PAUSE,
			MediaIntentType.STOP,
			MediaIntentType.NEXT,
			MediaIntentType.PREVIOUS,
		].includes(intent.type);
		const processedDeviceIds = new Set<string>();

		for (const device of devices) {
			// Skip HIDDEN devices
			if (device.role === MediaRole.HIDDEN) {
				continue;
			}

			// For playback intents, skip if we've already processed this device
			// (prevents duplicate commands for devices with multiple media channels)
			if (isPlaybackIntent && processedDeviceIds.has(device.device.id)) {
				this.logger.debug(`Skipping duplicate playback for deviceId=${device.device.id} (already processed)`);
				continue;
			}

			// For VOLUME_DELTA, calculate the new volume BEFORE execution
			// (we'll only track it if the execution succeeds)
			let calculatedVolume: number | null = null;
			if (intent.type === MediaIntentType.VOLUME_DELTA && intent.delta !== undefined && intent.increase !== undefined) {
				calculatedVolume = this.calculateVolumeDelta(device, intent.delta, intent.increase);
			}

			const outcome = await this.executeIntentForDevice(device, intent);

			// Mark device as processed for playback deduplication
			if (isPlaybackIntent) {
				processedDeviceIds.add(device.device.id);
			}

			if (outcome === IntentTargetStatus.SUCCESS) {
				affectedDevices++;
				targetResults.push({ deviceId: device.device.id, status: IntentTargetStatus.SUCCESS });

				// For VOLUME_DELTA, track the calculated volume for successfully affected devices
				if (calculatedVolume !== null) {
					volumeDeltaVolumes.push(calculatedVolume);
				}
			} else if (outcome === IntentTargetStatus.FAILED) {
				failedDevices++;
				targetResults.push({ deviceId: device.device.id, status: IntentTargetStatus.FAILED });
			} else {
				skippedDevices++;
				targetResults.push({ deviceId: device.device.id, status: IntentTargetStatus.SKIPPED });
			}
		}

		// Calculate result metadata
		switch (intent.type) {
			case MediaIntentType.VOLUME_SET:
				newVolume = intent.volume;
				break;
			case MediaIntentType.VOLUME_DELTA:
				// Calculate average volume from successfully affected devices
				if (volumeDeltaVolumes.length > 0) {
					const sum = volumeDeltaVolumes.reduce((a, b) => a + b, 0);
					newVolume = Math.round(sum / volumeDeltaVolumes.length);
				}
				break;
			case MediaIntentType.MUTE:
				isMuted = true;
				break;
			case MediaIntentType.UNMUTE:
				isMuted = false;
				break;
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Media intent completed spaceId=${spaceId} type=${intent.type} affected=${affectedDevices} failed=${failedDevices}`,
		);

		const failedTargets = targetResults.filter((t) => t.status === IntentTargetStatus.FAILED).map((t) => t.deviceId);

		return {
			success: overallSuccess,
			affectedDevices,
			failedDevices,
			skippedDevices,
			newVolume,
			isMuted,
			failedTargets,
		};
	}

	/**
	 * Execute a mode-based media intent using role-based orchestration.
	 * This method applies different power/volume rules based on each device's role.
	 */
	private async executeModeIntent(
		spaceId: string,
		devices: MediaDevice[],
		mode: MediaMode,
		targetResults: IntentTargetResult[],
	): Promise<MediaIntentResult> {
		// Use the pure function to determine what to do with each device
		const selections = selectMediaForMode(devices, mode);

		// Log telemetry for role-based selection
		const onDevices = selections.filter((s) => s.rule.power === true);
		const offDevices = selections.filter((s) => s.rule.power === false);
		const hasRoles = devices.some((d) => d.role !== null);
		const usingFallback = selections.some((s) => s.isFallback);

		this.logger.log(
			`Mode intent spaceId=${spaceId} mode=${mode} ` +
				`totalDevices=${devices.length} onCount=${onDevices.length} offCount=${offDevices.length} ` +
				`hasRoles=${hasRoles} usingFallback=${usingFallback}`,
		);

		let affectedDevices = 0;
		let failedDevices = 0;
		let skippedDevices = 0;

		// Execute commands for each device based on its selection
		for (const selection of selections) {
			const outcome = await this.executeRuleForDevice(selection.media, selection.rule);

			if (outcome === IntentTargetStatus.SUCCESS) {
				affectedDevices++;
				targetResults.push({ deviceId: selection.media.device.id, status: IntentTargetStatus.SUCCESS });
			} else if (outcome === IntentTargetStatus.FAILED) {
				failedDevices++;
				targetResults.push({ deviceId: selection.media.device.id, status: IntentTargetStatus.FAILED });
			} else {
				skippedDevices++;
				targetResults.push({ deviceId: selection.media.device.id, status: IntentTargetStatus.SKIPPED });
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		// Store last applied mode (state service persists and caches)
		if (overallSuccess) {
			this.mediaStateService.setLastAppliedMode(spaceId, mode);
		}

		this.logger.debug(
			`Mode intent completed spaceId=${spaceId} mode=${mode} affected=${affectedDevices} failed=${failedDevices}`,
		);

		const failedTargets = targetResults.filter((t) => t.status === IntentTargetStatus.FAILED).map((t) => t.deviceId);

		return { success: overallSuccess, affectedDevices, failedDevices, skippedDevices, failedTargets };
	}

	/**
	 * Execute a role-based rule for a single device.
	 * Handles on/off state, volume, and mute based on the rule.
	 */
	private async executeRuleForDevice(device: MediaDevice, rule: MediaRoleOrchestrationRule): Promise<CommandOutcome> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id} type=${device.device.type}`);
			return IntentTargetStatus.FAILED;
		}

		const commands: IDevicePropertyData[] = [];

		// Set power state if provided and capability exists
		if (rule.power !== undefined && device.onProperty) {
			commands.push({
				device: device.device,
				channel: device.mediaChannel,
				property: device.onProperty,
				value: rule.power,
			});
		}

		// Set volume if device is turning on and has volume support
		if (
			(rule.power === undefined || rule.power) &&
			rule.volume !== undefined &&
			rule.volume !== null &&
			device.volumeProperty
		) {
			commands.push({
				device: device.device,
				channel: device.mediaChannel,
				property: device.volumeProperty,
				value: rule.volume,
			});
		}

		// Set mute state if specified and device supports it
		if ((rule.power === undefined || rule.power) && rule.muted !== undefined && device.muteProperty) {
			commands.push({
				device: device.device,
				channel: device.mediaChannel,
				property: device.muteProperty,
				value: rule.muted,
			});
		}

		if (commands.length === 0) {
			return IntentTargetStatus.SKIPPED;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Rule execution failed for device id=${device.device.id}`);
				return IntentTargetStatus.FAILED;
			}

			return IntentTargetStatus.SUCCESS;
		} catch (error) {
			this.logger.error(`Error executing rule for device id=${device.device.id}: ${error}`);
			return IntentTargetStatus.FAILED;
		}
	}

	/**
	 * Find all media devices in a space with their channels, properties, and roles.
	 * Excludes devices with HIDDEN role as they should not be controlled by intents.
	 */
	private async getMediaDevicesInSpace(spaceId: string): Promise<MediaDevice[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const mediaDevices: MediaDevice[] = [];

		// Get role map for this space
		const roleMap = await this.mediaRoleService.getRoleMap(spaceId);

		for (const device of devices) {
			// Check if device is a media device
			if (!MEDIA_DEVICE_CATEGORIES.includes(device.category as (typeof MEDIA_DEVICE_CATEGORIES)[number])) {
				continue;
			}

			// Find media channels
			const mediaChannels =
				device.channels?.filter((ch) =>
					MEDIA_CHANNEL_CATEGORIES.includes(ch.category as (typeof MEDIA_CHANNEL_CATEGORIES)[number]),
				) ?? [];

			for (const mediaChannel of mediaChannels) {
				const isTelevision = mediaChannel.category === ChannelCategory.TELEVISION;
				const isSwitcher = mediaChannel.category === ChannelCategory.SWITCHER;
				const isSpeaker = mediaChannel.category === ChannelCategory.SPEAKER;

				// Power only from television/switcher .on or .active
				const onProperty =
					isTelevision || isSwitcher
						? (mediaChannel.properties?.find(
								(p) => p.category === PropertyCategory.ON || p.category === PropertyCategory.ACTIVE,
							) ?? null)
						: null;

				// Volume/mute from speaker or television channels
				// TVs can have integrated volume/mute controls on their TELEVISION channel
				const volumeProperty =
					isSpeaker || isTelevision
						? (mediaChannel.properties?.find((p) => p.category === PropertyCategory.VOLUME) ?? null)
						: null;
				const muteProperty =
					isSpeaker || isTelevision
						? (mediaChannel.properties?.find((p) => p.category === PropertyCategory.MUTE) ?? null)
						: null;

				// Only include channels that expose at least one controllable property
				const isControlChannel =
					onProperty ||
					volumeProperty ||
					muteProperty ||
					mediaChannel.category === ChannelCategory.MEDIA_PLAYBACK ||
					mediaChannel.category === ChannelCategory.MEDIA_INPUT;

				if (!isControlChannel) {
					continue;
				}

				// Get role assignment for this device (device-level)
				const roleEntity = roleMap.get(device.id);
				const role = roleEntity?.role ?? null;

				// Skip HIDDEN devices - they should not be controlled by intents
				if (role === MediaRole.HIDDEN) {
					this.logger.debug(`Skipping HIDDEN media device deviceId=${device.id} channelId=${mediaChannel.id}`);
					continue;
				}

				mediaDevices.push({
					device,
					mediaChannel,
					onProperty,
					volumeProperty,
					muteProperty,
					role,
				});
			}
		}

		return mediaDevices;
	}

	/**
	 * Execute a media intent for a single device (POWER_ON, POWER_OFF, VOLUME_SET, VOLUME_DELTA, MUTE, UNMUTE).
	 * SET_MODE is handled separately via executeModeIntent for role-based orchestration.
	 */
	private async executeIntentForDevice(device: MediaDevice, intent: MediaIntentDto): Promise<CommandOutcome> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id} type=${device.device.type}`);
			return IntentTargetStatus.FAILED;
		}

		const commands: IDevicePropertyData[] = [];

		switch (intent.type) {
			case MediaIntentType.POWER_OFF:
				if (!device.onProperty) {
					this.logger.debug(`Skipping power_off (no power capability) deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.onProperty,
					value: false,
				});
				break;

			case MediaIntentType.POWER_ON:
				if (!device.onProperty) {
					this.logger.debug(`Skipping power_on (no power capability) deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.onProperty,
					value: true,
				});
				break;

			case MediaIntentType.VOLUME_SET:
				if (intent.volume === undefined) {
					this.logger.warn('VOLUME_SET intent requires volume parameter');
					return IntentTargetStatus.FAILED;
				}
				if (!device.volumeProperty) {
					this.logger.debug(`Device does not support volume control deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED; // Not a failure, device just doesn't support this
				}
				if (device.onProperty && !this.getPropertyBooleanValue(device.onProperty)) {
					this.logger.debug(`Skipping volume set; device is off deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED;
				}
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.volumeProperty,
					value: intent.volume,
				});
				break;

			case MediaIntentType.VOLUME_DELTA:
				if (intent.delta === undefined || intent.increase === undefined) {
					this.logger.warn('VOLUME_DELTA intent requires delta and increase parameters');
					return IntentTargetStatus.FAILED;
				}
				commands.push(...this.buildVolumeDeltaCommands(device, intent.delta, intent.increase));
				break;

			case MediaIntentType.MUTE:
				if (device.muteProperty) {
					commands.push({
						device: device.device,
						channel: device.mediaChannel,
						property: device.muteProperty,
						value: true,
					});
				} else if (device.volumeProperty) {
					commands.push({
						device: device.device,
						channel: device.mediaChannel,
						property: device.volumeProperty,
						value: 0,
					});
				} else {
					this.logger.debug(`Device does not support mute or volume fallback deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED; // Not a failure, device just doesn't support this
				}
				break;

			case MediaIntentType.UNMUTE:
				if (device.muteProperty) {
					commands.push({
						device: device.device,
						channel: device.mediaChannel,
						property: device.muteProperty,
						value: false,
					});
				} else if (device.volumeProperty) {
					this.logger.debug(`Device does not support mute; leaving volume unchanged deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED;
				} else {
					this.logger.debug(`Device does not support mute deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED; // Not a failure, device just doesn't support this
				}
				break;

			case MediaIntentType.PLAY:
			case MediaIntentType.PAUSE:
			case MediaIntentType.STOP:
			case MediaIntentType.NEXT:
			case MediaIntentType.PREVIOUS: {
				const { channel, commandProperty, remoteKeyProperty } = this.getPlaybackProperties(
					device.device,
					device.mediaChannel,
				);

				const playbackValue =
					intent.type === MediaIntentType.PLAY
						? 'play'
						: intent.type === MediaIntentType.PAUSE
							? 'pause'
							: intent.type === MediaIntentType.STOP
								? 'stop'
								: intent.type === MediaIntentType.NEXT
									? 'next'
									: 'previous';

				if (commandProperty && channel) {
					commands.push({
						device: device.device,
						channel,
						property: commandProperty,
						value: playbackValue,
					});
					break;
				}

				if (remoteKeyProperty && channel) {
					commands.push({
						device: device.device,
						channel,
						property: remoteKeyProperty,
						value: playbackValue,
					});
					break;
				}

				this.logger.debug(`Playback control not supported deviceId=${device.device.id} intent=${intent.type}`);
				return IntentTargetStatus.SKIPPED; // no-op
			}

			case MediaIntentType.INPUT_SET: {
				if (!intent.source) {
					this.logger.warn('INPUT_SET intent requires source parameter');
					return IntentTargetStatus.FAILED;
				}

				const { sourceProperty, channel } = this.getInputProperties(device.device);

				if (sourceProperty && channel) {
					commands.push({
						device: device.device,
						channel,
						property: sourceProperty,
						value: intent.source,
					});
					break;
				}

				this.logger.debug(`Input control not supported deviceId=${device.device.id}`);
				return IntentTargetStatus.SKIPPED; // no-op
			}

			case MediaIntentType.SET_MODE:
				// SET_MODE is handled via executeModeIntent, not here
				this.logger.warn('SET_MODE should be handled via executeModeIntent');
				return IntentTargetStatus.FAILED;

			default:
				this.logger.warn(`Unknown intent type: ${String(intent.type)}`);
				return IntentTargetStatus.FAILED;
		}

		if (commands.length === 0) {
			this.logger.debug(`No commands to execute for device id=${device.device.id}`);
			return IntentTargetStatus.SKIPPED;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Command execution failed for device id=${device.device.id}`);
				return IntentTargetStatus.FAILED;
			}

			this.logger.debug(`Successfully executed commands for device id=${device.device.id}`);
			return IntentTargetStatus.SUCCESS;
		} catch (error) {
			this.logger.error(`Error executing commands for device id=${device.device.id}: ${error}`);
			return IntentTargetStatus.FAILED;
		}
	}

	/**
	 * Calculate the new volume after a delta adjustment for a device.
	 * Returns null if the device cannot be adjusted (no volume support or is off).
	 */
	private calculateVolumeDelta(device: MediaDevice, delta: VolumeDelta, increase: boolean): number | null {
		// If device doesn't support volume, return null
		if (!device.volumeProperty) {
			return null;
		}

		// Only adjust volume for devices that are currently ON when power-capable
		const isPowerCapable = !!device.onProperty;
		if (isPowerCapable && !this.getPropertyBooleanValue(device.onProperty)) {
			return null;
		}

		// Get current volume value
		const currentVolume = this.getPropertyNumericValue(device.volumeProperty) ?? 50;

		// Calculate new volume using defined delta steps
		const deltaValue = VOLUME_DELTA_STEPS[delta] ?? 10;
		let newVolume = increase ? currentVolume + deltaValue : currentVolume - deltaValue;

		// Clamp to [0, 100]
		newVolume = this.clampValue(newVolume, 0, 100);

		return newVolume;
	}

	/**
	 * Build commands for a volume delta adjustment.
	 */
	private buildVolumeDeltaCommands(device: MediaDevice, delta: VolumeDelta, increase: boolean): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		const newVolume = this.calculateVolumeDelta(device, delta, increase);

		// If device can't be adjusted, return empty commands
		if (newVolume === null) {
			if (!device.volumeProperty) {
				this.logger.debug(`Device does not support volume adjustment deviceId=${device.device.id}`);
			} else {
				this.logger.debug(`Skipping volume delta for OFF device deviceId=${device.device.id}`);
			}
			return commands;
		}

		commands.push({
			device: device.device,
			channel: device.mediaChannel,
			property: device.volumeProperty,
			value: newVolume,
		});

		return commands;
	}

	/**
	 * Check if an intent type is a role-specific intent.
	 */
	private isRoleSpecificIntent(type: MediaIntentType): boolean {
		return [MediaIntentType.ROLE_POWER, MediaIntentType.ROLE_VOLUME].includes(type);
	}

	/**
	 * Execute a role-specific intent for devices in a specific role.
	 */
	private async executeRoleIntent(
		spaceId: string,
		allDevices: MediaDevice[],
		intent: MediaIntentDto,
		targetResults: IntentTargetResult[],
	): Promise<MediaIntentResult> {
		if (!intent.role) {
			this.logger.warn('Role-specific intent missing role parameter');
			return { success: false, affectedDevices: 0, failedDevices: 0 };
		}

		// Filter devices to only those with the specified role
		const roleDevices = allDevices.filter((d) => d.role === intent.role);

		if (roleDevices.length === 0) {
			this.logger.debug(`No devices found with role=${intent.role} in space id=${spaceId}`);
			return { success: true, affectedDevices: 0, failedDevices: 0 };
		}

		this.logger.debug(
			`Executing role intent type=${intent.type} role=${intent.role} devicesCount=${roleDevices.length}`,
		);

		let affectedDevices = 0;
		let failedDevices = 0;
		let skippedDevices = 0;

		for (const device of roleDevices) {
			const outcome = await this.executeRoleIntentForDevice(device, intent);

			if (outcome === IntentTargetStatus.SUCCESS) {
				affectedDevices++;
				targetResults.push({ deviceId: device.device.id, status: IntentTargetStatus.SUCCESS });
			} else if (outcome === IntentTargetStatus.FAILED) {
				failedDevices++;
				targetResults.push({ deviceId: device.device.id, status: IntentTargetStatus.FAILED });
			} else {
				skippedDevices++;
				targetResults.push({ deviceId: device.device.id, status: IntentTargetStatus.SKIPPED });
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Role intent completed spaceId=${spaceId} role=${intent.role} affected=${affectedDevices} failed=${failedDevices}`,
		);

		const failedTargets = targetResults.filter((t) => t.status === IntentTargetStatus.FAILED).map((t) => t.deviceId);

		return { success: overallSuccess, affectedDevices, failedDevices, skippedDevices, failedTargets };
	}

	/**
	 * Execute a role-specific intent for a single device.
	 */
	private async executeRoleIntentForDevice(device: MediaDevice, intent: MediaIntentDto): Promise<CommandOutcome> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id} type=${device.device.type}`);
			return IntentTargetStatus.FAILED;
		}

		const commands: IDevicePropertyData[] = [];

		switch (intent.type) {
			case MediaIntentType.ROLE_POWER:
				if (intent.on === undefined) {
					this.logger.warn('ROLE_POWER intent missing on parameter');
					return IntentTargetStatus.FAILED;
				}
				if (!device.onProperty) {
					this.logger.debug(`Device does not support power control deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.onProperty,
					value: intent.on,
				});
				break;

			case MediaIntentType.ROLE_VOLUME:
				if (intent.volume === undefined) {
					this.logger.warn('ROLE_VOLUME intent missing volume parameter');
					return IntentTargetStatus.FAILED;
				}
				if (!device.volumeProperty) {
					this.logger.debug(`Device does not support volume deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED; // Not a failure, device just doesn't support this
				}
				if (device.onProperty && !this.getPropertyBooleanValue(device.onProperty)) {
					this.logger.debug(`Skipping role volume; device is off deviceId=${device.device.id}`);
					return IntentTargetStatus.SKIPPED;
				}
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.volumeProperty,
					value: intent.volume,
				});
				break;

			default:
				this.logger.warn(`Unknown role intent type: ${String(intent.type)}`);
				return IntentTargetStatus.FAILED;
		}

		if (commands.length === 0) {
			return IntentTargetStatus.SKIPPED;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Role intent execution failed for device id=${device.device.id}`);
				return IntentTargetStatus.FAILED;
			}

			return IntentTargetStatus.SUCCESS;
		} catch (error) {
			this.logger.error(`Error executing role intent for device id=${device.device.id}: ${error}`);
			return IntentTargetStatus.FAILED;
		}
	}
}
