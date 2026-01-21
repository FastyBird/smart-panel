import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import {
	MEDIA_CHANNEL_CATEGORIES,
	MEDIA_DEVICE_CATEGORIES,
	MEDIA_MODE_ORCHESTRATION,
	MediaMode,
	MediaRole,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpaceMediaRoleService } from './space-media-role.service';
import { SpacesService } from './spaces.service';

/**
 * Aggregated state for a single media role.
 */
export interface RoleMediaAggregatedState {
	role: MediaRole;
	// On/off state
	isOn: boolean;
	isOnMixed: boolean;
	// Current values - null when devices have different values (mixed)
	volume: number | null;
	isMuted: boolean;
	// Mixed flags
	isVolumeMixed: boolean;
	isMutedMixed: boolean;
	// Device counts
	devicesCount: number;
	devicesOn: number;
}

/**
 * Aggregated state for unassigned media devices
 */
export interface OtherMediaState {
	isOn: boolean;
	isOnMixed: boolean;
	volume: number | null;
	isMuted: boolean;
	isVolumeMixed: boolean;
	isMutedMixed: boolean;
	devicesCount: number;
	devicesOn: number;
}

/**
 * Mode match result for media
 */
export interface MediaModeMatch {
	mode: MediaMode;
	confidence: 'exact' | 'approximate';
	matchPercentage: number;
}

/**
 * Complete media state for a space
 */
export interface SpaceMediaState {
	// Mode detection
	detectedMode: MediaMode | null;
	modeConfidence: 'exact' | 'approximate' | 'none';
	modeMatchPercentage: number | null;

	// Last applied mode (from in-memory tracking)
	lastAppliedMode: MediaMode | null;
	lastAppliedVolume: number | null;
	lastAppliedMuted: boolean | null;
	lastAppliedAt: Date | null;

	// Summary
	totalDevices: number;
	devicesOn: number;
	averageVolume: number | null;
	anyMuted: boolean;

	// Per-role state
	roles: Partial<Record<MediaRole, RoleMediaAggregatedState>>;

	// Devices without role
	other: OtherMediaState;
}

/**
 * Internal media state for aggregation
 */
interface MediaDeviceState {
	deviceId: string;
	channelId: string;
	role: MediaRole | null;
	isOn: boolean;
	volume: number | null;
	isMuted: boolean;
}

/**
 * Service for calculating aggregated media state per role.
 * Provides state data for UI display without panel-side calculation.
 */
@Injectable()
export class SpaceMediaStateService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceMediaStateService');

	// Track last applied state per space (mode/volume/mute)
	private lastAppliedModes = new Map<
		string,
		{ mode: MediaMode | null; volume: number | null; muted: boolean | null; timestamp: Date }
	>();

	constructor(
		private readonly spacesService: SpacesService,
		private readonly mediaRoleService: SpaceMediaRoleService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
	) {}

	/**
	 * Get the complete aggregated media state for a space.
	 * Includes per-role state, mode detection, and summary.
	 */
	async getMediaState(spaceId: string): Promise<SpaceMediaState | null> {
		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);
			return null;
		}

		// Get all media device states
		const devices = await this.getMediaDeviceStates(spaceId);

		if (devices.length === 0) {
			return this.buildEmptyState();
		}

		// Aggregate state per role
		const roleStates = this.aggregateByRole(devices);

		// Get devices without role for "other" state
		const otherDevices = devices.filter((d) => d.role === null);
		const otherState = this.aggregateOtherState(otherDevices);

		// Calculate summary
		const totalDevices = devices.length;
		const devicesOn = devices.filter((d) => d.isOn).length;
		const volumeDevices = devices.filter((d) => d.volume !== null);
		const averageVolume =
			volumeDevices.length > 0
				? Math.round(volumeDevices.reduce((sum, d) => sum + (d.volume ?? 0), 0) / volumeDevices.length)
				: null;
		const anyMuted = devices.some((d) => d.isMuted);

		// Detect mode
		const modeMatch = this.detectMode(devices);

		// Get last applied mode
		const lastState = await this.resolveLastAppliedState(spaceId);

		return {
			detectedMode: modeMatch?.mode ?? null,
			modeConfidence: modeMatch?.confidence ?? 'none',
			modeMatchPercentage: modeMatch?.matchPercentage ?? null,
			lastAppliedMode: lastState?.mode ?? null,
			lastAppliedVolume: lastState?.volume ?? null,
			lastAppliedMuted: lastState?.muted ?? null,
			lastAppliedAt: lastState?.timestamp ?? null,
			totalDevices,
			devicesOn,
			averageVolume,
			anyMuted,
			roles: roleStates,
			other: otherState,
		};
	}

	/**
	 * Update last applied mode (called by MediaIntentService)
	 */
	setLastAppliedMode(spaceId: string, mode: MediaMode): void {
		const record = { mode, volume: null, muted: null, timestamp: new Date() };
		this.lastAppliedModes.set(spaceId, record);
	}

	private async resolveLastAppliedState(
		spaceId: string,
	): Promise<{ mode: MediaMode | null; volume: number | null; muted: boolean | null; timestamp: Date } | null> {
		const cached = this.lastAppliedModes.get(spaceId);

		if (cached) {
			return cached;
		}

		const persisted = await this.intentTimeseriesService.getLastMediaState(spaceId);

		if (!persisted) {
			return null;
		}

		const record = {
			mode:
				persisted.mode && Object.values(MediaMode).includes(persisted.mode as MediaMode)
					? (persisted.mode as MediaMode)
					: null,
			volume: persisted.volume ?? null,
			muted: persisted.muted ?? null,
			timestamp: persisted.appliedAt,
		};

		this.lastAppliedModes.set(spaceId, record);
		return record;
	}

	/**
	 * Get all media device states for a space
	 */
	private async getMediaDeviceStates(spaceId: string): Promise<MediaDeviceState[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const states: MediaDeviceState[] = [];

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

			for (const channel of mediaChannels) {
				const isSpeaker = channel.category === ChannelCategory.SPEAKER;
				const isTelevision = channel.category === ChannelCategory.TELEVISION;

				// Power is available when channel exposes an ON property
				const onProperty = channel.properties?.find((p) => p.category === PropertyCategory.ON);

				// Volume/mute from speaker or television channels
				// TVs can have integrated volume/mute controls on their TELEVISION channel
				const volumeProperty =
					isSpeaker || isTelevision
						? channel.properties?.find((p) => p.category === PropertyCategory.VOLUME)
						: undefined;
				const muteProperty =
					isSpeaker || isTelevision
						? channel.properties?.find((p) => p.category === PropertyCategory.MUTE)
						: undefined;

				// Only include channels that expose at least one controllable property
				const isControlChannel =
					onProperty ||
					volumeProperty ||
					muteProperty ||
					channel.category === ChannelCategory.MEDIA_PLAYBACK ||
					channel.category === ChannelCategory.MEDIA_INPUT;

				if (!isControlChannel) {
					continue;
				}

				// Get role assignment (device-level)
				const roleEntity = roleMap.get(device.id);
				const role = roleEntity?.role ?? null;

				// Skip HIDDEN devices
				if (role === MediaRole.HIDDEN) {
					continue;
				}

				states.push({
					deviceId: device.id,
					channelId: channel.id,
					role,
					isOn: this.getPropertyBooleanValue(onProperty),
					volume: this.getPropertyNumericValue(volumeProperty),
					isMuted: this.getPropertyBooleanValue(muteProperty),
				});
			}
		}

		return states;
	}

	/**
	 * Aggregate states by role
	 */
	private aggregateByRole(devices: MediaDeviceState[]): Partial<Record<MediaRole, RoleMediaAggregatedState>> {
		const roleStates: Partial<Record<MediaRole, RoleMediaAggregatedState>> = {};

		// Group devices by role
		const devicesByRole = new Map<MediaRole, MediaDeviceState[]>();

		for (const device of devices) {
			if (device.role === null) {
				continue; // Skip unassigned for role aggregation
			}

			const existing = devicesByRole.get(device.role) ?? [];
			existing.push(device);
			devicesByRole.set(device.role, existing);
		}

		// Aggregate each role
		for (const [role, roleDevices] of devicesByRole) {
			const onDevices = roleDevices.filter((d) => d.isOn);
			const isOnMixed = onDevices.length > 0 && onDevices.length < roleDevices.length;
			const isOn = onDevices.length > 0;

			// Calculate volume aggregate
			const volumeDevices = roleDevices.filter((d) => d.volume !== null);
			let volume: number | null = null;
			let isVolumeMixed = false;

			if (volumeDevices.length > 0) {
				const volumes = new Set(volumeDevices.map((d) => d.volume));
				if (volumes.size === 1) {
					volume = volumeDevices[0].volume;
				} else {
					isVolumeMixed = true;
				}
			}

			// Calculate mute aggregate
			const mutedDevices = roleDevices.filter((d) => d.isMuted);
			const isMuted = mutedDevices.length > 0;
			const isMutedMixed = mutedDevices.length > 0 && mutedDevices.length < roleDevices.length;

			roleStates[role] = {
				role,
				isOn,
				isOnMixed,
				volume,
				isMuted,
				isVolumeMixed,
				isMutedMixed,
				devicesCount: roleDevices.length,
				devicesOn: onDevices.length,
			};
		}

		return roleStates;
	}

	/**
	 * Aggregate state for devices without role
	 */
	private aggregateOtherState(devices: MediaDeviceState[]): OtherMediaState {
		if (devices.length === 0) {
			return {
				isOn: false,
				isOnMixed: false,
				volume: null,
				isMuted: false,
				isVolumeMixed: false,
				isMutedMixed: false,
				devicesCount: 0,
				devicesOn: 0,
			};
		}

		const onDevices = devices.filter((d) => d.isOn);
		const isOnMixed = onDevices.length > 0 && onDevices.length < devices.length;
		const isOn = onDevices.length > 0;

		// Calculate volume aggregate
		const volumeDevices = devices.filter((d) => d.volume !== null);
		let volume: number | null = null;
		let isVolumeMixed = false;

		if (volumeDevices.length > 0) {
			const volumes = new Set(volumeDevices.map((d) => d.volume));
			if (volumes.size === 1) {
				volume = volumeDevices[0].volume;
			} else {
				isVolumeMixed = true;
			}
		}

		// Calculate mute aggregate
		const mutedDevices = devices.filter((d) => d.isMuted);
		const isMuted = mutedDevices.length > 0;
		const isMutedMixed = mutedDevices.length > 0 && mutedDevices.length < devices.length;

		return {
			isOn,
			isOnMixed,
			volume,
			isMuted,
			isVolumeMixed,
			isMutedMixed,
			devicesCount: devices.length,
			devicesOn: onDevices.length,
		};
	}

	/**
	 * Detect which mode the current state matches (if any)
	 */
	private detectMode(devices: MediaDeviceState[]): MediaModeMatch | null {
		if (devices.length === 0) {
			return null;
		}

		// Check each mode for match
		let bestMatch: MediaModeMatch | null = null;

		for (const mode of Object.values(MediaMode)) {
			const modeConfig = MEDIA_MODE_ORCHESTRATION[mode];
			let matchingDevices = 0;
			let totalCheckedDevices = 0;

			for (const device of devices) {
				if (device.role === null) {
					continue; // Skip unassigned for mode matching
				}

				const rule = modeConfig[device.role];

				if (!rule) {
					continue;
				}

				totalCheckedDevices++;

				// Check if device matches rule
				const powerMatches = rule.power === undefined || device.isOn === rule.power;
				const volumeMatches =
					rule.volume === undefined ||
					rule.volume === null ||
					device.volume === null ||
					Math.abs((device.volume ?? 0) - rule.volume) <= 5; // Allow 5% tolerance
				const muteMatches = rule.muted === undefined || device.isMuted === rule.muted;

				if (powerMatches && volumeMatches && muteMatches) {
					matchingDevices++;
				}
			}

			if (totalCheckedDevices === 0) {
				continue;
			}

			const matchPercentage = Math.round((matchingDevices / totalCheckedDevices) * 100);

			// Exact match
			if (matchPercentage === 100) {
				return { mode, confidence: 'exact', matchPercentage: 100 };
			}

			// Keep track of best approximate match
			if (matchPercentage >= 80 && (!bestMatch || matchPercentage > bestMatch.matchPercentage)) {
				bestMatch = { mode, confidence: 'approximate', matchPercentage };
			}
		}

		return bestMatch;
	}

	/**
	 * Build an empty state for spaces with no media devices
	 */
	private buildEmptyState(): SpaceMediaState {
		return {
			detectedMode: null,
			modeConfidence: 'none',
			modeMatchPercentage: null,
			lastAppliedMode: null,
			lastAppliedVolume: null,
			lastAppliedMuted: null,
			lastAppliedAt: null,
			totalDevices: 0,
			devicesOn: 0,
			averageVolume: null,
			anyMuted: false,
			roles: {},
			other: {
				isOn: false,
				isOnMixed: false,
				volume: null,
				isMuted: false,
				isVolumeMixed: false,
				isMutedMixed: false,
				devicesCount: 0,
				devicesOn: 0,
			},
		};
	}

	/**
	 * Get boolean value from a property
	 */
	private getPropertyBooleanValue(property: ChannelPropertyEntity | null | undefined): boolean {
		if (!property) {
			return false;
		}

		const value = property.value;

		if (typeof value === 'boolean') {
			return value;
		}

		if (value === 'true' || value === 1 || value === '1' || value === 'on') {
			return true;
		}

		return false;
	}

	/**
	 * Get numeric value from a property
	 */
	private getPropertyNumericValue(property: ChannelPropertyEntity | null | undefined): number | null {
		if (!property) {
			return null;
		}

		const value = property.value;

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);
			return isNaN(parsed) ? null : parsed;
		}

		return null;
	}
}
