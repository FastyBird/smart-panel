import { Injectable } from '@nestjs/common';

import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraUpstreamException,
} from '../../../modules/cameras/cameras.exceptions';
import {
	CameraStreamProfile,
	CameraStreamSource,
	ICameraStreamProvider,
} from '../../../modules/cameras/platforms/camera-stream.provider';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { buildBridgeStreamUrl, parseProtectStreamUrl } from '../client/protect-stream-url';
import {
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_RTSPS_QUALITIES,
	PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS,
	PROTECT_STREAM_QUALITIES,
	PROTECT_STREAM_READ_DEADLINE_MS,
	PROTECT_STREAM_SOURCE_BUDGET_MS,
	ProtectProfileUnavailableReason,
	ProtectRtspsQuality,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectConnectorService } from './protect-connector.service';
import { readDefaultStreamQuality } from './protect-default-stream-quality';
import { ProtectStreamAvailabilityService } from './protect-stream-availability.service';
import { ProtectStreamBridgeService } from './protect-stream-bridge.service';
import { toCameraProviderError } from './protect-stream-errors';
import { ProtectSynchronizerService } from './protect-synchronizer.service';

const MAIN_CHANNEL = 'camera.main';
const PACKAGE_CHANNEL = 'camera.package';

/** What `resolveSource` may spend on the console read; the bridge pre-flight gets the rest of the budget. */
const SOURCE_READ_DEADLINE_MS = Math.min(
	PROTECT_STREAM_READ_DEADLINE_MS,
	PROTECT_STREAM_SOURCE_BUDGET_MS - PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS,
);

interface ProtectCameraChannels {
	cameraId: string;
	nvrId: string | null;
	mainChannelId: string;
	packageChannelId: string | null;
}

/**
 * Camera stream provider for UniFi Protect cameras (D2, D5, D8). It holds no stream address: every `resolveSource`
 * reads the console, and the returned bridge URL (which carries the alias) goes to the cameras core alone.
 */
@Injectable()
export class UnifiProtectStreamProvider implements ICameraStreamProvider {
	constructor(
		private readonly connector: ProtectConnectorService,
		private readonly synchronizer: ProtectSynchronizerService,
		private readonly availability: ProtectStreamAvailabilityService,
		private readonly bridge: ProtectStreamBridgeService,
		private readonly configService: ConfigService,
	) {}

	getType(): string {
		return DEVICES_UNIFI_PROTECT_TYPE;
	}

	async listProfiles(device: DeviceEntity, options: { signal?: AbortSignal } = {}): Promise<CameraStreamProfile[]> {
		const camera = this.toCamera(device);

		if (camera === null) {
			return [];
		}

		const order = this.orderedQualities(camera);
		const blocked = this.blockedReason(camera);

		if (blocked !== null) {
			return order.map((quality) => this.toProfile(camera, quality, blocked));
		}

		const entry = await this.availability.getAvailability(camera.cameraId, { signal: options.signal });

		// A listing the core gave up on says nothing about the camera: no reason is reported and nothing is logged.
		if (options.signal?.aborted === true) {
			throw toCameraProviderError(
				new ProtectApiError(ProtectErrorCategory.CANCELLED, 'cameras/{id}/rtsps-stream'),
				'source',
			);
		}

		const host = this.bridge.getUpstreamHost();
		const ports = this.availability.getStreamPorts(camera.cameraId);

		return order.map((quality) => {
			const port = ports?.[quality];
			let reason: ProtectProfileUnavailableReason | null = null;

			if (host !== null && port !== undefined && this.bridge.getVerification({ host, port }) === 'unverified') {
				reason = 'stream_tls_unverified';
			} else if (entry === null) {
				reason = 'stream_state_unknown';
			} else if (!entry.availability[quality]) {
				reason = 'stream_not_enabled';
			}

			return this.toProfile(camera, quality, reason);
		});
	}

	async resolveSource(
		device: DeviceEntity,
		profileId: string,
		options: { signal?: AbortSignal } = {},
	): Promise<CameraStreamSource> {
		const camera = this.toCamera(device);

		if (camera === null || !this.isKnownProfile(camera, profileId)) {
			throw new CameraProfileUnavailableException('Stream profile is not available');
		}

		if (this.blockedReason(camera) !== null) {
			throw new CameraOfflineException('Camera is offline');
		}

		const startedAt = Date.now();
		let consoleUrl: string | null;

		try {
			const streams = await this.availability.readStreams(camera.cameraId, {
				signal: options.signal,
				deadlineMs: SOURCE_READ_DEADLINE_MS,
			});

			consoleUrl = streams[profileId as ProtectRtspsQuality];
		} catch (error) {
			throw toCameraProviderError(error, 'source');
		}

		if (consoleUrl === null || consoleUrl === undefined) {
			throw new CameraProfileUnavailableException('Stream profile is not available');
		}

		const parsed = parseProtectStreamUrl(consoleUrl);

		// The bridge derives the upstream host by the same rule; null here means no session or an invalid override.
		if (parsed === null || this.bridge.getUpstreamHost() === null) {
			throw new CameraUpstreamException('Camera did not respond');
		}

		let url: string | null;

		try {
			const endpoint = await this.bridge.prepare(
				{ port: parsed.port },
				{
					signal: options.signal,
					deadlineMs: Math.max(1, PROTECT_STREAM_SOURCE_BUDGET_MS - (Date.now() - startedAt)),
				},
			);

			url = buildBridgeStreamUrl(endpoint, parsed.alias);
		} catch (error) {
			throw toCameraProviderError(error, 'bridge');
		}

		if (url === null) {
			throw new CameraUpstreamException('Camera did not respond');
		}

		return { url, transport: 'rtsp' };
	}

	/** Task 7. */
	getSnapshot(): Promise<never> {
		return Promise.reject(new CameraUpstreamException('Camera did not respond'));
	}

	private toCamera(device: DeviceEntity): ProtectCameraChannels | null {
		const protect = device as DeviceEntity & {
			protectNvrId?: string | null;
			protectDeviceId?: unknown;
			protectModelKey?: unknown;
		};

		if (
			protect.type !== DEVICES_UNIFI_PROTECT_TYPE ||
			typeof protect.protectDeviceId !== 'string' ||
			protect.protectDeviceId === '' ||
			(protect.protectModelKey !== 'camera' && protect.protectModelKey !== null)
		) {
			return null;
		}

		const channels = Array.isArray(device.channels) ? device.channels : [];
		const main = channels.find((channel) => channel.identifier === MAIN_CHANNEL);
		const pkg = channels.find((channel) => channel.identifier === PACKAGE_CHANNEL);

		if (main === undefined) {
			return null;
		}

		return {
			cameraId: protect.protectDeviceId,
			nvrId: typeof protect.protectNvrId === 'string' ? protect.protectNvrId : null,
			mainChannelId: main.id,
			packageChannelId: pkg?.id ?? null,
		};
	}

	/** D5: `console_unavailable`, then `camera_offline`; null when a request may follow. */
	private blockedReason(camera: ProtectCameraChannels): ProtectProfileUnavailableReason | null {
		const identity = this.connector.getConsoleIdentity();

		if (identity === null || identity.nvrId !== camera.nvrId) {
			return 'console_unavailable';
		}

		return this.synchronizer.getCachedDevice('camera', camera.cameraId)?.state === 'CONNECTED'
			? null
			: 'camera_offline';
	}

	private orderedQualities(camera: ProtectCameraChannels): ProtectRtspsQuality[] {
		const first = readDefaultStreamQuality(this.configService);
		const main: ProtectRtspsQuality[] = [first, ...PROTECT_STREAM_QUALITIES.filter((quality) => quality !== first)];

		return camera.packageChannelId === null ? main : [...main, 'package'];
	}

	private isKnownProfile(camera: ProtectCameraChannels, profileId: string): boolean {
		return (
			PROTECT_RTSPS_QUALITIES.includes(profileId as ProtectRtspsQuality) &&
			(profileId !== 'package' || camera.packageChannelId !== null)
		);
	}

	private toProfile(
		camera: ProtectCameraChannels,
		quality: ProtectRtspsQuality,
		reason: ProtectProfileUnavailableReason | null,
	): CameraStreamProfile {
		const profile: CameraStreamProfile = {
			id: quality,
			channelId: quality === 'package' ? camera.packageChannelId : camera.mainChannelId,
			available: reason === null,
		};

		if (reason !== null) {
			profile.unavailableReason = reason;
		}

		return profile;
	}
}
