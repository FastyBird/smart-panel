import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { MediaIntentDto } from '../dto/media-intent.dto';
import {
	EventType,
	MEDIA_CHANNEL_CATEGORIES,
	MEDIA_DEVICE_CATEGORIES,
	MEDIA_MODE_ORCHESTRATION,
	MediaIntentType,
	MediaMode,
	MediaRole,
	MediaRoleVolumeRule,
	SPACES_MODULE_NAME,
	VOLUME_DELTA_STEPS,
	VolumeDelta,
} from '../spaces.constants';

import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceMediaRoleService } from './space-media-role.service';
import { SpaceMediaStateService } from './space-media-state.service';
import { SpacesService } from './spaces.service';

/**
 * Represents a media device with its channel, properties, and role.
 */
export interface MediaDevice {
	device: DeviceEntity;
	mediaChannel: ChannelEntity;
	onProperty: ChannelPropertyEntity;
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
	rule: MediaRoleVolumeRule;
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
		const fallbackRule = modeConfig[MediaRole.PRIMARY] ?? { on: false, volume: null, muted: false };

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
		let rule: MediaRoleVolumeRule;
		const isFallback = false;

		if (media.role === null) {
			// Device has no role assigned - apply same rule as SECONDARY or turn off
			const secondaryRule = modeConfig[MediaRole.SECONDARY];
			rule = secondaryRule ?? { on: false, volume: null, muted: false };
		} else if (media.role === MediaRole.HIDDEN) {
			// Hidden devices are never controlled
			continue;
		} else {
			// Apply the rule for this role
			const roleRule = modeConfig[media.role];
			rule = roleRule ?? { on: false, volume: null, muted: false };
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
}

/**
 * State of media devices in a space.
 */
export interface MediaState {
	hasMedia: boolean;
	anyOn: boolean;
	allOff: boolean;
	averageVolume: number | null;
	anyMuted: boolean;
	devicesCount: number;
	devicesByRole: Record<string, number>;
	lastAppliedMode: MediaMode | null;
	lastAppliedAt: Date | null;
}

/**
 * Service handling all media-related intent operations.
 * Manages media state, mode-based orchestration, and volume control.
 */
@Injectable()
export class MediaIntentService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'MediaIntentService');

	// Track last applied mode per space (in-memory, resets on restart)
	private lastAppliedModes = new Map<string, { mode: MediaMode; timestamp: Date }>();

	constructor(
		private readonly spacesService: SpacesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly mediaRoleService: SpaceMediaRoleService,
		private readonly eventEmitter: EventEmitter2,
		@Inject(forwardRef(() => SpaceMediaStateService))
		private readonly mediaStateService: SpaceMediaStateService,
	) {
		super();
	}

	/**
	 * Get the current media state for a space.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async getMediaState(spaceId: string): Promise<MediaState | null> {
		// Verify space exists - return null for controller to throw 404
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);
			return null;
		}

		// Get all media devices in the space
		const devices = await this.getMediaDevicesInSpace(spaceId);

		if (devices.length === 0) {
			return {
				hasMedia: false,
				anyOn: false,
				allOff: true,
				averageVolume: null,
				anyMuted: false,
				devicesCount: 0,
				devicesByRole: {},
				lastAppliedMode: null,
				lastAppliedAt: null,
			};
		}

		// Calculate aggregate state
		let onCount = 0;
		let volumeSum = 0;
		let volumeCount = 0;
		let mutedCount = 0;
		const roleCount: Record<string, number> = {};

		for (const device of devices) {
			const isOn = this.getPropertyBooleanValue(device.onProperty);
			if (isOn) {
				onCount++;
			}

			const volume = this.getPropertyNumericValue(device.volumeProperty);
			if (volume !== null) {
				volumeSum += volume;
				volumeCount++;
			}

			const isMuted = this.getPropertyBooleanValue(device.muteProperty);
			if (isMuted) {
				mutedCount++;
			}

			const roleKey = device.role ?? 'unassigned';
			roleCount[roleKey] = (roleCount[roleKey] ?? 0) + 1;
		}

		const lastMode = this.lastAppliedModes.get(spaceId);

		return {
			hasMedia: true,
			anyOn: onCount > 0,
			allOff: onCount === 0,
			averageVolume: volumeCount > 0 ? Math.round(volumeSum / volumeCount) : null,
			anyMuted: mutedCount > 0,
			devicesCount: devices.length,
			devicesByRole: roleCount,
			lastAppliedMode: lastMode?.mode ?? null,
			lastAppliedAt: lastMode?.timestamp ?? null,
		};
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
		const devices = await this.getMediaDevicesInSpace(spaceId);

		if (devices.length === 0) {
			this.logger.debug(`No media devices found in space id=${spaceId}`);
			return { success: true, affectedDevices: 0, failedDevices: 0 };
		}

		this.logger.debug(`Found ${devices.length} media devices in space id=${spaceId}`);

		let result: MediaIntentResult;

		// For SET_MODE, use role-based orchestration
		if (intent.type === MediaIntentType.SET_MODE && intent.mode) {
			result = await this.executeModeIntent(spaceId, devices, intent.mode);
		} else if (this.isRoleSpecificIntent(intent.type)) {
			// For role-specific intents, only affect devices with the specified role
			result = await this.executeRoleIntent(spaceId, devices, intent);
		} else {
			// For other intents (POWER_ON, POWER_OFF, VOLUME_SET, VOLUME_DELTA, MUTE, UNMUTE), apply to all devices
			result = await this.executeGlobalIntent(spaceId, devices, intent);
		}

		// Emit state change event for WebSocket clients (fire and forget)
		if (result.success) {
			void this.emitMediaStateChange(spaceId);
		}

		return result;
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
	): Promise<MediaIntentResult> {
		let affectedDevices = 0;
		let failedDevices = 0;
		let newVolume: number | undefined;
		let isMuted: boolean | undefined;

		for (const device of devices) {
			// Skip HIDDEN devices
			if (device.role === MediaRole.HIDDEN) {
				continue;
			}

			const success = await this.executeIntentForDevice(device, intent);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		// Calculate result metadata
		switch (intent.type) {
			case MediaIntentType.VOLUME_SET:
				newVolume = intent.volume;
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

		return { success: overallSuccess, affectedDevices, failedDevices, newVolume, isMuted };
	}

	/**
	 * Execute a mode-based media intent using role-based orchestration.
	 * This method applies different power/volume rules based on each device's role.
	 */
	private async executeModeIntent(
		spaceId: string,
		devices: MediaDevice[],
		mode: MediaMode,
	): Promise<MediaIntentResult> {
		// Use the pure function to determine what to do with each device
		const selections = selectMediaForMode(devices, mode);

		// Log telemetry for role-based selection
		const onDevices = selections.filter((s) => s.rule.on);
		const offDevices = selections.filter((s) => !s.rule.on);
		const hasRoles = devices.some((d) => d.role !== null);
		const usingFallback = selections.some((s) => s.isFallback);

		this.logger.log(
			`Mode intent spaceId=${spaceId} mode=${mode} ` +
				`totalDevices=${devices.length} onCount=${onDevices.length} offCount=${offDevices.length} ` +
				`hasRoles=${hasRoles} usingFallback=${usingFallback}`,
		);

		let affectedDevices = 0;
		let failedDevices = 0;

		// Execute commands for each device based on its selection
		for (const selection of selections) {
			const success = await this.executeRuleForDevice(selection.media, selection.rule);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		// Store last applied mode
		if (overallSuccess) {
			this.lastAppliedModes.set(spaceId, { mode, timestamp: new Date() });
		}

		this.logger.debug(
			`Mode intent completed spaceId=${spaceId} mode=${mode} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices };
	}

	/**
	 * Execute a role-based rule for a single device.
	 * Handles on/off state, volume, and mute based on the rule.
	 */
	private async executeRuleForDevice(device: MediaDevice, rule: MediaRoleVolumeRule): Promise<boolean> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id} type=${device.device.type}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		// Set on/off state
		commands.push({
			device: device.device,
			channel: device.mediaChannel,
			property: device.onProperty,
			value: rule.on,
		});

		// Set volume if device is turning on and has volume support
		if (rule.on && rule.volume !== null && device.volumeProperty) {
			commands.push({
				device: device.device,
				channel: device.mediaChannel,
				property: device.volumeProperty,
				value: rule.volume,
			});
		}

		// Set mute state if specified and device supports it
		if (rule.on && device.muteProperty) {
			commands.push({
				device: device.device,
				channel: device.mediaChannel,
				property: device.muteProperty,
				value: rule.muted,
			});
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Rule execution failed for device id=${device.device.id}`);
				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Error executing rule for device id=${device.device.id}: ${error}`);
			return false;
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
				// Find the ON property (required for media)
				const onProperty = mediaChannel.properties?.find((p) => p.category === PropertyCategory.ON);

				if (!onProperty) {
					continue;
				}

				// Find optional properties
				const volumeProperty =
					mediaChannel.properties?.find((p) => p.category === PropertyCategory.VOLUME) ?? null;
				const muteProperty = mediaChannel.properties?.find((p) => p.category === PropertyCategory.MUTE) ?? null;

				// Get role assignment for this device (keyed by deviceId:channelId)
				const roleKey = `${device.id}:${mediaChannel.id}`;
				const roleEntity = roleMap.get(roleKey);
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
	private async executeIntentForDevice(device: MediaDevice, intent: MediaIntentDto): Promise<boolean> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id} type=${device.device.type}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		switch (intent.type) {
			case MediaIntentType.POWER_OFF:
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.onProperty,
					value: false,
				});
				break;

			case MediaIntentType.POWER_ON:
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
					return false;
				}
				if (!device.volumeProperty) {
					this.logger.debug(`Device does not support volume control deviceId=${device.device.id}`);
					return true; // Not a failure, device just doesn't support this
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
					return false;
				}
				commands.push(...this.buildVolumeDeltaCommands(device, intent.delta, intent.increase));
				break;

			case MediaIntentType.MUTE:
				if (!device.muteProperty) {
					this.logger.debug(`Device does not support mute deviceId=${device.device.id}`);
					return true; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.muteProperty,
					value: true,
				});
				break;

			case MediaIntentType.UNMUTE:
				if (!device.muteProperty) {
					this.logger.debug(`Device does not support mute deviceId=${device.device.id}`);
					return true; // Not a failure, device just doesn't support this
				}
				commands.push({
					device: device.device,
					channel: device.mediaChannel,
					property: device.muteProperty,
					value: false,
				});
				break;

			case MediaIntentType.SET_MODE:
				// SET_MODE is handled via executeModeIntent, not here
				this.logger.warn('SET_MODE should be handled via executeModeIntent');
				return false;

			default:
				this.logger.warn(`Unknown intent type: ${String(intent.type)}`);
				return false;
		}

		if (commands.length === 0) {
			this.logger.debug(`No commands to execute for device id=${device.device.id}`);
			return true;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Command execution failed for device id=${device.device.id}`);
				return false;
			}

			this.logger.debug(`Successfully executed commands for device id=${device.device.id}`);
			return true;
		} catch (error) {
			this.logger.error(`Error executing commands for device id=${device.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Build commands for a volume delta adjustment.
	 */
	private buildVolumeDeltaCommands(
		device: MediaDevice,
		delta: VolumeDelta,
		increase: boolean,
	): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		// If device doesn't support volume, just ignore (no-op)
		if (!device.volumeProperty) {
			this.logger.debug(`Device does not support volume adjustment deviceId=${device.device.id}`);
			return commands;
		}

		// Only adjust volume for devices that are currently ON
		const isOn = this.getPropertyBooleanValue(device.onProperty);

		if (!isOn) {
			this.logger.debug(`Skipping volume delta for OFF device deviceId=${device.device.id}`);
			return commands;
		}

		// Get current volume value
		const currentVolume = this.getPropertyNumericValue(device.volumeProperty) ?? 50;

		// Calculate new volume using defined delta steps
		const deltaValue = VOLUME_DELTA_STEPS[delta] ?? 10;
		let newVolume = increase ? currentVolume + deltaValue : currentVolume - deltaValue;

		// Clamp to [0, 100]
		newVolume = this.clampValue(newVolume, 0, 100);

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

		for (const device of roleDevices) {
			const success = await this.executeRoleIntentForDevice(device, intent);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Role intent completed spaceId=${spaceId} role=${intent.role} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices };
	}

	/**
	 * Execute a role-specific intent for a single device.
	 */
	private async executeRoleIntentForDevice(device: MediaDevice, intent: MediaIntentDto): Promise<boolean> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id} type=${device.device.type}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		switch (intent.type) {
			case MediaIntentType.ROLE_POWER:
				if (intent.on === undefined) {
					this.logger.warn('ROLE_POWER intent missing on parameter');
					return false;
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
					return false;
				}
				if (!device.volumeProperty) {
					this.logger.debug(`Device does not support volume deviceId=${device.device.id}`);
					return true; // Not a failure, device just doesn't support this
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
				return false;
		}

		if (commands.length === 0) {
			return true;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Role intent execution failed for device id=${device.device.id}`);
				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Error executing role intent for device id=${device.device.id}: ${error}`);
			return false;
		}
	}
}
