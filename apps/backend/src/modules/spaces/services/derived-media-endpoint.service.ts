import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../devices/devices.constants';
import {
	DerivedMediaCapabilitiesModel,
	DerivedMediaEndpointModel,
	DerivedMediaEndpointsResultModel,
	DerivedMediaLinksModel,
} from '../models/derived-media-endpoint.model';
import { MediaCapabilityMappingModel, MediaCapabilitySummaryModel } from '../models/media-routing.model';
import { MediaEndpointType, SPACES_MODULE_NAME } from '../spaces.constants';

import { MediaCapabilityService } from './media-capability.service';
import { SpacesService } from './spaces.service';

/**
 * Service that builds derived (non-persisted) media endpoints from device capabilities.
 *
 * This is a read model that flattens Space → Devices → Channels → Properties
 * into functional media endpoints with deterministic IDs.
 */
@Injectable()
export class DerivedMediaEndpointService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'DerivedMediaEndpointService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly mediaCapabilityService: MediaCapabilityService,
	) {}

	/**
	 * Build all derived media endpoints for a space.
	 *
	 * Scans all media devices in the space, extracts capabilities,
	 * and produces functional endpoint projections with deterministic IDs.
	 */
	async buildEndpointsForSpace(spaceId: string): Promise<DerivedMediaEndpointsResultModel> {
		this.logger.debug(`Building derived media endpoints for space id=${spaceId}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(spaceId);

		// Get capability summaries from existing service
		const summaries = await this.mediaCapabilityService.getMediaCapabilitiesInSpace(spaceId);

		const endpoints: DerivedMediaEndpointModel[] = [];

		for (const summary of summaries) {
			const deviceEndpoints = this.buildEndpointsForDevice(spaceId, summary);

			for (const endpoint of deviceEndpoints) {
				this.logger.debug(
					`Generated endpoint: id=${endpoint.endpointId} type=${endpoint.type} device=${summary.deviceId} ` +
						`(${summary.deviceName})`,
				);
			}

			if (deviceEndpoints.length === 0) {
				this.logger.debug(
					`No endpoints generated for device=${summary.deviceId} (${summary.deviceName}) ` +
						`category=${summary.deviceCategory}: no matching endpoint types`,
				);
			}

			endpoints.push(...deviceEndpoints);
		}

		this.logger.debug(`Built ${endpoints.length} derived media endpoints for space id=${spaceId}`);

		const result = new DerivedMediaEndpointsResultModel();
		result.spaceId = spaceId;
		result.endpoints = endpoints;

		return result;
	}

	/**
	 * Build endpoints for a single device based on its capability summary.
	 */
	private buildEndpointsForDevice(spaceId: string, summary: MediaCapabilitySummaryModel): DerivedMediaEndpointModel[] {
		const endpoints: DerivedMediaEndpointModel[] = [];
		const types = this.determineEndpointTypes(summary);

		for (const type of types) {
			const endpoint = this.buildSingleEndpoint(spaceId, summary, type);
			endpoints.push(endpoint);
		}

		return endpoints;
	}

	/**
	 * Determine which endpoint types a device should expose based on category and capabilities.
	 */
	private determineEndpointTypes(summary: MediaCapabilitySummaryModel): MediaEndpointType[] {
		const types: MediaEndpointType[] = [];
		const category = summary.deviceCategory as DeviceCategory;

		switch (category) {
			case DeviceCategory.TELEVISION:
			case DeviceCategory.PROJECTOR:
				types.push(MediaEndpointType.DISPLAY);
				if (summary.volume) {
					types.push(MediaEndpointType.AUDIO_OUTPUT);
				}
				if (summary.remote) {
					types.push(MediaEndpointType.REMOTE_TARGET);
				}
				break;

			case DeviceCategory.AV_RECEIVER:
				types.push(MediaEndpointType.AUDIO_OUTPUT);
				if (summary.input) {
					types.push(MediaEndpointType.SOURCE);
				}
				break;

			case DeviceCategory.SPEAKER:
				types.push(MediaEndpointType.AUDIO_OUTPUT);
				if (summary.playback) {
					types.push(MediaEndpointType.SOURCE);
				}
				break;

			case DeviceCategory.SET_TOP_BOX:
			case DeviceCategory.GAME_CONSOLE:
			case DeviceCategory.STREAMING_SERVICE:
				types.push(MediaEndpointType.SOURCE);
				if (summary.remote) {
					types.push(MediaEndpointType.REMOTE_TARGET);
				}
				break;

			case DeviceCategory.MEDIA:
				// Generic media device - derive from capabilities
				if (summary.playback) {
					types.push(MediaEndpointType.SOURCE);
				}
				if (summary.volume) {
					types.push(MediaEndpointType.AUDIO_OUTPUT);
				}
				if (summary.remote) {
					types.push(MediaEndpointType.REMOTE_TARGET);
				}
				break;
		}

		return types;
	}

	/**
	 * Build a single derived endpoint for a device + type combination.
	 *
	 * Endpoint ID is deterministic: `${spaceId}:${type}:${deviceId}`
	 */
	private buildSingleEndpoint(
		spaceId: string,
		summary: MediaCapabilitySummaryModel,
		type: MediaEndpointType,
	): DerivedMediaEndpointModel {
		const endpoint = new DerivedMediaEndpointModel();

		endpoint.endpointId = `${spaceId}:${type}:${summary.deviceId}`;
		endpoint.spaceId = spaceId;
		endpoint.deviceId = summary.deviceId;
		endpoint.type = type;
		endpoint.name = this.buildEndpointName(summary.deviceName, type);
		endpoint.capabilities = this.buildCapabilities(summary, type);
		endpoint.links = this.buildLinks(summary, type);

		return endpoint;
	}

	/**
	 * Build human-readable endpoint name from device name and type.
	 */
	private buildEndpointName(deviceName: string, type: MediaEndpointType): string {
		const typeLabels: Record<MediaEndpointType, string> = {
			[MediaEndpointType.DISPLAY]: 'Display',
			[MediaEndpointType.AUDIO_OUTPUT]: 'Audio Output',
			[MediaEndpointType.SOURCE]: 'Source',
			[MediaEndpointType.REMOTE_TARGET]: 'Remote Target',
		};

		return `${deviceName} (${typeLabels[type]})`;
	}

	/**
	 * Build capability flags for an endpoint.
	 * Only capabilities relevant to the endpoint type are set to true.
	 */
	private buildCapabilities(
		summary: MediaCapabilitySummaryModel,
		type: MediaEndpointType,
	): DerivedMediaCapabilitiesModel {
		const caps = new DerivedMediaCapabilitiesModel();

		switch (type) {
			case MediaEndpointType.DISPLAY:
				caps.power = !!summary.power;
				caps.inputSelect = !!summary.input;
				caps.volume = false;
				caps.mute = false;
				caps.playback = !!summary.playback;
				caps.track = !!(summary.trackMetadata || summary.artist || summary.album || summary.playbackState);
				caps.remoteCommands = false;
				break;

			case MediaEndpointType.AUDIO_OUTPUT:
				caps.power = !!summary.power;
				caps.volume = !!summary.volume;
				caps.mute = !!summary.mute;
				caps.inputSelect = !!summary.input;
				caps.playback = !!summary.playback;
				caps.track = !!(summary.trackMetadata || summary.artist || summary.album || summary.playbackState);
				caps.remoteCommands = false;
				break;

			case MediaEndpointType.SOURCE:
				caps.power = !!summary.power;
				caps.inputSelect = !!summary.input;
				caps.playback = !!summary.playback;
				caps.track = !!(summary.trackMetadata || summary.artist || summary.album || summary.playbackState);
				caps.volume = false;
				caps.mute = false;
				caps.remoteCommands = false;
				break;

			case MediaEndpointType.REMOTE_TARGET:
				caps.remoteCommands = !!summary.remote;
				caps.power = !!summary.power;
				caps.volume = false;
				caps.mute = false;
				caps.inputSelect = false;
				caps.playback = false;
				caps.track = false;
				break;
		}

		return caps;
	}

	/**
	 * Build capability → property/command links for an endpoint.
	 * Only links for capabilities that exist are included.
	 */
	private buildLinks(summary: MediaCapabilitySummaryModel, type: MediaEndpointType): DerivedMediaLinksModel {
		const links = new DerivedMediaLinksModel();

		const addLink = (cap: MediaCapabilityMappingModel | undefined, field: string): void => {
			if (cap) {
				(links as Record<string, unknown>)[field] = { propertyId: cap.propertyId };
			}
		};

		switch (type) {
			case MediaEndpointType.DISPLAY:
				addLink(summary.power, 'power');
				addLink(summary.input, 'inputSelect');
				addLink(summary.playback, 'playback');
				addLink(summary.playbackState, 'playbackState');
				addLink(summary.trackMetadata, 'trackMetadata');
				addLink(summary.album, 'album');
				addLink(summary.artist, 'artist');
				addLink(summary.position, 'position');
				addLink(summary.duration, 'duration');
				break;

			case MediaEndpointType.AUDIO_OUTPUT:
				addLink(summary.power, 'power');
				addLink(summary.volume, 'volume');
				addLink(summary.mute, 'mute');
				addLink(summary.input, 'inputSelect');
				addLink(summary.playback, 'playback');
				addLink(summary.playbackState, 'playbackState');
				addLink(summary.trackMetadata, 'trackMetadata');
				addLink(summary.album, 'album');
				addLink(summary.artist, 'artist');
				addLink(summary.position, 'position');
				addLink(summary.duration, 'duration');
				break;

			case MediaEndpointType.SOURCE:
				addLink(summary.power, 'power');
				addLink(summary.input, 'inputSelect');
				addLink(summary.playback, 'playback');
				addLink(summary.playbackState, 'playbackState');
				addLink(summary.trackMetadata, 'trackMetadata');
				addLink(summary.album, 'album');
				addLink(summary.artist, 'artist');
				addLink(summary.position, 'position');
				addLink(summary.duration, 'duration');
				break;

			case MediaEndpointType.REMOTE_TARGET:
				addLink(summary.power, 'power');
				if (summary.remote) {
					links.remote = { commands: { remoteKey: summary.remote.propertyId } };
				}
				break;
		}

		return links;
	}
}
