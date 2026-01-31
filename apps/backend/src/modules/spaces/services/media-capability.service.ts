import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PermissionType, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { MediaCapabilityMappingModel, MediaCapabilitySummaryModel } from '../models/media-routing.model';
import {
	MEDIA_CHANNEL_CATEGORIES,
	MEDIA_DEVICE_CATEGORIES,
	MediaCapabilityPermission,
	MediaEndpointType,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpacesService } from './spaces.service';

/**
 * Service that derives media capability summaries from devices in a space.
 * Used by DerivedMediaEndpointService and SpaceMediaActivityBindingService.
 * Does not use persisted endpoint/routing tables.
 */
@Injectable()
export class MediaCapabilityService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'MediaCapabilityService');

	constructor(private readonly spacesService: SpacesService) {}

	/**
	 * Get all media devices in a space with their capability summaries
	 */
	async getMediaCapabilitiesInSpace(spaceId: string): Promise<MediaCapabilitySummaryModel[]> {
		this.logger.debug(`Getting media capabilities for space id=${spaceId}`);

		await this.spacesService.getOneOrThrow(spaceId);

		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const summaries: MediaCapabilitySummaryModel[] = [];

		for (const device of devices) {
			if (!MEDIA_DEVICE_CATEGORIES.includes(device.category as (typeof MEDIA_DEVICE_CATEGORIES)[number])) {
				continue;
			}

			const summary = this.buildCapabilitySummary(device);
			if (summary) {
				summaries.push(summary);
			}
		}

		this.logger.debug(`Found ${summaries.length} media devices with capabilities in space id=${spaceId}`);

		return summaries;
	}

	private buildCapabilitySummary(device: DeviceEntity): MediaCapabilitySummaryModel | null {
		const capabilities = this.detectCapabilities(device, null);

		if (!capabilities) {
			return null;
		}

		const summary: MediaCapabilitySummaryModel = {
			deviceId: device.id,
			deviceName: device.name,
			deviceCategory: device.category,
			isOnline: device.status?.online ?? false,
			suggestedEndpointTypes: [],
		};

		if (capabilities.power) summary.power = capabilities.power;
		if (capabilities.volume) summary.volume = capabilities.volume;
		if (capabilities.mute) summary.mute = capabilities.mute;
		if (capabilities.playback) summary.playback = capabilities.playback;
		if (capabilities.playbackState) summary.playbackState = capabilities.playbackState;
		if (capabilities.input) summary.input = capabilities.input;
		if (capabilities.remote) summary.remote = capabilities.remote;

		summary.suggestedEndpointTypes = this.suggestEndpointTypes(device, capabilities);

		return summary;
	}

	private detectCapabilities(
		device: DeviceEntity,
		preferredChannelId: string | null,
	): Record<string, MediaCapabilityMappingModel> | null {
		const capabilities: Record<string, MediaCapabilityMappingModel> = {};

		const mediaChannels =
			device.channels?.filter((ch) => {
				if (preferredChannelId && ch.id === preferredChannelId) return true;
				return MEDIA_CHANNEL_CATEGORIES.includes(ch.category as (typeof MEDIA_CHANNEL_CATEGORIES)[number]);
			}) ?? [];

		for (const channel of mediaChannels) {
			const isTelevision = channel.category === ChannelCategory.TELEVISION;
			const isSwitcher = channel.category === ChannelCategory.SWITCHER;
			const isSpeaker = channel.category === ChannelCategory.SPEAKER;
			const isPlayback = channel.category === ChannelCategory.MEDIA_PLAYBACK;
			const isInput = channel.category === ChannelCategory.MEDIA_INPUT;

			for (const property of channel.properties ?? []) {
				const permission = this.mapPermissions(property.permissions);

				if (
					(isTelevision || isSwitcher) &&
					(property.category === PropertyCategory.ON || property.category === PropertyCategory.ACTIVE)
				) {
					if (!capabilities.power) {
						capabilities.power = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				if ((isSpeaker || isTelevision) && property.category === PropertyCategory.VOLUME) {
					if (!capabilities.volume) {
						capabilities.volume = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				if ((isSpeaker || isTelevision) && property.category === PropertyCategory.MUTE) {
					if (!capabilities.mute) {
						capabilities.mute = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				if (isPlayback && property.category === PropertyCategory.COMMAND) {
					if (!capabilities.playback) {
						capabilities.playback = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				if (isPlayback && property.category === PropertyCategory.STATE) {
					if (!capabilities.playbackState) {
						capabilities.playbackState = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				if ((isTelevision || isInput) && property.category === PropertyCategory.SOURCE) {
					if (!capabilities.input) {
						capabilities.input = { propertyId: property.id, channelId: channel.id, permission };
					}
				}

				if (isTelevision && property.category === PropertyCategory.REMOTE_KEY) {
					if (!capabilities.remote) {
						capabilities.remote = { propertyId: property.id, channelId: channel.id, permission };
					}
				}
			}
		}

		return Object.keys(capabilities).length > 0 ? capabilities : null;
	}

	private suggestEndpointTypes(
		device: DeviceEntity,
		capabilities: Record<string, MediaCapabilityMappingModel>,
	): MediaEndpointType[] {
		const types: MediaEndpointType[] = [];
		const category = device.category as DeviceCategory;

		switch (category) {
			case DeviceCategory.TELEVISION:
			case DeviceCategory.PROJECTOR:
				types.push(MediaEndpointType.DISPLAY);
				if (capabilities.volume) types.push(MediaEndpointType.AUDIO_OUTPUT);
				if (capabilities.remote) types.push(MediaEndpointType.REMOTE_TARGET);
				break;

			case DeviceCategory.AV_RECEIVER:
				types.push(MediaEndpointType.AUDIO_OUTPUT);
				if (capabilities.input) types.push(MediaEndpointType.SOURCE);
				break;

			case DeviceCategory.SPEAKER:
				types.push(MediaEndpointType.AUDIO_OUTPUT);
				break;

			case DeviceCategory.SET_TOP_BOX:
			case DeviceCategory.GAME_CONSOLE:
			case DeviceCategory.STREAMING_SERVICE:
				types.push(MediaEndpointType.SOURCE);
				if (capabilities.remote) types.push(MediaEndpointType.REMOTE_TARGET);
				break;

			case DeviceCategory.MEDIA:
				if (capabilities.playback) types.push(MediaEndpointType.SOURCE);
				if (capabilities.volume) types.push(MediaEndpointType.AUDIO_OUTPUT);
				if (capabilities.remote) types.push(MediaEndpointType.REMOTE_TARGET);
				break;

			default:
				break;
		}

		return types;
	}

	private mapPermissions(permissions: PermissionType[]): MediaCapabilityPermission {
		const hasRead =
			permissions.includes(PermissionType.READ_ONLY) || permissions.includes(PermissionType.READ_WRITE);
		const hasWrite =
			permissions.includes(PermissionType.WRITE_ONLY) || permissions.includes(PermissionType.READ_WRITE);

		if (hasRead && hasWrite) return MediaCapabilityPermission.READ_WRITE;
		if (hasWrite) return MediaCapabilityPermission.WRITE;
		return MediaCapabilityPermission.READ;
	}
}
