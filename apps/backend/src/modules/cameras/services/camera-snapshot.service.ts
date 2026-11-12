import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import {
	CameraOfflineException,
	CameraRateLimitedException,
	CameraUpstreamException,
	CamerasException,
} from '../cameras.exceptions';
import { CameraSnapshot, ICameraStreamProvider } from '../platforms/camera-stream.provider';

import { CAMERA_PROVIDER_TIMEOUT_MS, CameraProviderTimeoutError, CamerasService } from './cameras.service';

export const CAMERA_SNAPSHOT_DEFAULT_MIN_INTERVAL_MS = 2000;
export const CAMERA_SNAPSHOT_MIN_ALLOWED_INTERVAL_MS = 250;
export const CAMERA_SNAPSHOT_MAX_AGE_MS = 300_000;

const ACCEPTED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface CameraSnapshotResult {
	contentType: string;
	data: Buffer;
	ageMs: number;
	stale: boolean;
}

interface CacheEntry {
	contentType: string;
	data: Buffer;
	fetchedAt: number;
}

@Injectable()
export class CameraSnapshotService {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'CameraSnapshotService');

	private readonly cache = new Map<string, CacheEntry>();
	private readonly inFlight = new Map<string, Promise<CameraSnapshotResult>>();

	constructor(private readonly camerasService: CamerasService) {}

	async getSnapshot(
		deviceId: string,
		options: { profileId?: string; highQuality?: boolean },
	): Promise<CameraSnapshotResult> {
		const { device, provider } = await this.camerasService.getProviderOrThrow(deviceId);
		const highQuality = options.highQuality === true;

		const key = `${deviceId}:${options.profileId ?? 'default'}:${highQuality}`;
		const now = Date.now();
		const entry = this.liveEntry(key, now);

		if (entry && now - entry.fetchedAt < this.minIntervalMs(provider, device)) {
			return { contentType: entry.contentType, data: entry.data, ageMs: now - entry.fetchedAt, stale: false };
		}

		const running = this.inFlight.get(key);

		if (running !== undefined) {
			return running;
		}

		const request: Promise<CameraSnapshotResult> = (async () => {
			try {
				return await this.fetchFresh(
					key,
					deviceId,
					options.profileId,
					() => this.inFlight.get(key) === request,
					async () => {
						// The profile lookup is part of the coalesced fetch: cache hits and joiners never reach the provider.
						const channelId =
							options.profileId === undefined
								? undefined
								: (await this.camerasService.findProfileById(device, provider, options.profileId)).channelId;

						return this.withTimeout(provider.getSnapshot(device, { channelId, highQuality }));
					},
				);
			} finally {
				if (this.inFlight.get(key) === request) {
					this.inFlight.delete(key);
				}
			}
		})();

		this.inFlight.set(key, request);

		return request;
	}

	evict(deviceId: string): void {
		const prefix = `${deviceId}:`;

		for (const key of [...this.cache.keys()]) {
			if (key.startsWith(prefix)) this.cache.delete(key);
		}

		for (const key of [...this.inFlight.keys()]) {
			if (key.startsWith(prefix)) this.inFlight.delete(key);
		}
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	onDeviceDeleted(device: { id: string }): void {
		this.evict(device.id);
	}

	private async fetchFresh(
		key: string,
		deviceId: string,
		profileId: string | undefined,
		isCurrent: () => boolean,
		call: () => Promise<CameraSnapshot>,
	): Promise<CameraSnapshotResult> {
		let snapshot: CameraSnapshot;

		try {
			snapshot = await call();
		} catch (error) {
			if (error instanceof CameraRateLimitedException) {
				const stale = this.liveEntry(key, Date.now());

				if (stale) {
					return { contentType: stale.contentType, data: stale.data, ageMs: Date.now() - stale.fetchedAt, stale: true };
				}

				throw error;
			}

			if (error instanceof CameraOfflineException) {
				this.cache.delete(key);

				throw error;
			}

			// Unknown profile and other module exceptions keep their own meaning.
			if (error instanceof CamerasException && !(error instanceof CameraUpstreamException)) {
				throw error;
			}

			// Never log the error message: a provider may embed a source URL in it.
			this.logger.warn(
				`Camera snapshot failed deviceId=${deviceId} profileId=${profileId ?? 'default'} error=${errorName(error)}`,
			);

			throw new CameraUpstreamException('Camera did not respond');
		}

		if (!snapshot || !ACCEPTED_CONTENT_TYPES.includes(snapshot.contentType) || !snapshot.data?.length) {
			this.logger.warn(
				`Camera snapshot rejected deviceId=${deviceId} profileId=${profileId ?? 'default'} error=InvalidImage`,
			);

			throw new CameraUpstreamException('Camera returned an invalid image');
		}

		// An eviction while the call was running removes it from the in-flight map; do not resurrect the entry.
		if (isCurrent()) {
			this.cache.set(key, { contentType: snapshot.contentType, data: snapshot.data, fetchedAt: Date.now() });
		}

		return { contentType: snapshot.contentType, data: snapshot.data, ageMs: 0, stale: false };
	}

	private liveEntry(key: string, now: number): CacheEntry | undefined {
		const entry = this.cache.get(key);

		if (entry && now - entry.fetchedAt > CAMERA_SNAPSHOT_MAX_AGE_MS) {
			this.cache.delete(key);

			return undefined;
		}

		return entry;
	}

	private minIntervalMs(provider: ICameraStreamProvider, device: DeviceEntity): number {
		let value: number | undefined;

		try {
			value = provider.getSnapshotMinIntervalMs?.(device);
		} catch (error) {
			// Never log the error message: a provider may embed a source URL in it.
			this.logger.warn(`Camera snapshot interval hook failed deviceId=${device.id} error=${errorName(error)}`);

			return CAMERA_SNAPSHOT_DEFAULT_MIN_INTERVAL_MS;
		}

		return typeof value === 'number' && Number.isFinite(value) && value >= CAMERA_SNAPSHOT_MIN_ALLOWED_INTERVAL_MS
			? value
			: CAMERA_SNAPSHOT_DEFAULT_MIN_INTERVAL_MS;
	}

	private async withTimeout<T>(promise: Promise<T>): Promise<T> {
		let timer: NodeJS.Timeout | undefined;

		try {
			return await Promise.race([
				promise,
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new CameraProviderTimeoutError()), CAMERA_PROVIDER_TIMEOUT_MS);
					timer.unref();
				}),
			]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}
}

function errorName(error: unknown): string {
	return error instanceof Error ? error.name : 'UnknownError';
}
