import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
	sanitizeProviderError,
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

type FailureKind = 'offline' | 'rate_limited' | 'upstream';

/** A failed fetch, replayed to later requests until `until` so that polling does not hammer a failing camera. */
interface FailureEntry {
	kind: FailureKind;
	until: number;
}

@Injectable()
export class CameraSnapshotService {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'CameraSnapshotService');

	private readonly cache = new Map<string, CacheEntry>();
	private readonly failures = new Map<string, FailureEntry>();
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
		const minIntervalMs = this.minIntervalMs(provider, device);

		if (entry && now - entry.fetchedAt < minIntervalMs) {
			return { contentType: entry.contentType, data: entry.data, ageMs: now - entry.fetchedAt, stale: false };
		}

		// A recent failure is replayed without calling the provider. A usable cached image is never hidden by it.
		const failure = this.activeFailure(key, now);

		if (failure) {
			if (failure.kind === 'rate_limited' && entry) {
				return { contentType: entry.contentType, data: entry.data, ageMs: now - entry.fetchedAt, stale: true };
			}

			throw this.replayFailure(failure.kind);
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
					minIntervalMs,
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

		for (const key of [...this.failures.keys()]) {
			if (key.startsWith(prefix)) this.failures.delete(key);
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
		minIntervalMs: number,
		isCurrent: () => boolean,
		call: () => Promise<CameraSnapshot>,
	): Promise<CameraSnapshotResult> {
		let snapshot: CameraSnapshot;

		try {
			snapshot = await call();
		} catch (error) {
			// Only offline, rate limited and profile unavailable keep their meaning; the rest becomes an upstream failure
			// with a fixed message. Never log the error message: a provider may embed a source URL in it.
			const sanitized = sanitizeProviderError(error);

			if (sanitized instanceof CameraRateLimitedException) {
				this.recordFailure(key, 'rate_limited', minIntervalMs, isCurrent);

				const stale = this.liveEntry(key, Date.now());

				if (stale) {
					return { contentType: stale.contentType, data: stale.data, ageMs: Date.now() - stale.fetchedAt, stale: true };
				}

				throw sanitized;
			}

			if (sanitized instanceof CameraOfflineException) {
				this.cache.delete(key);
				this.recordFailure(key, 'offline', minIntervalMs, isCurrent);

				throw sanitized;
			}

			// An unknown profile says nothing about the camera, so it is not remembered.
			if (sanitized instanceof CameraProfileUnavailableException) {
				throw sanitized;
			}

			this.logger.warn(
				`Camera snapshot failed deviceId=${deviceId} profileId=${profileId ?? 'default'} error=${errorName(error)}`,
			);
			this.recordFailure(key, 'upstream', minIntervalMs, isCurrent);

			throw sanitized;
		}

		const contentType = acceptedMediaType(snapshot?.contentType);

		if (!snapshot || contentType === null || !snapshot.data?.length) {
			this.logger.warn(
				`Camera snapshot rejected deviceId=${deviceId} profileId=${profileId ?? 'default'} error=InvalidImage`,
			);
			this.recordFailure(key, 'upstream', minIntervalMs, isCurrent);

			throw new CameraUpstreamException('Camera returned an invalid image');
		}

		// An eviction while the call was running removes it from the in-flight map; do not resurrect the entry.
		if (isCurrent()) {
			this.cache.set(key, { contentType, data: snapshot.data, fetchedAt: Date.now() });
			this.failures.delete(key);
		}

		return { contentType, data: snapshot.data, ageMs: 0, stale: false };
	}

	private recordFailure(key: string, kind: FailureKind, minIntervalMs: number, isCurrent: () => boolean): void {
		// An eviction while the call was running must not be undone by its failure.
		if (!isCurrent()) return;

		const now = Date.now();

		// Keys carry caller-chosen profile ids, so drop expired entries to keep the map small.
		for (const [failedKey, failure] of this.failures) {
			if (failure.until <= now) this.failures.delete(failedKey);
		}

		this.failures.set(key, { kind, until: now + minIntervalMs });
	}

	private activeFailure(key: string, now: number): FailureEntry | undefined {
		const failure = this.failures.get(key);

		if (failure && failure.until <= now) {
			this.failures.delete(key);

			return undefined;
		}

		return failure;
	}

	private replayFailure(kind: FailureKind): Error {
		switch (kind) {
			case 'offline':
				return new CameraOfflineException('Camera is offline');
			case 'rate_limited':
				return new CameraRateLimitedException('Camera is busy');
			case 'upstream':
				return new CameraUpstreamException('Camera did not respond');
		}
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

/** The media type of an accepted image content type, without parameters (`image/jpeg; charset=binary` is a JPEG). */
function acceptedMediaType(contentType: unknown): string | null {
	if (typeof contentType !== 'string') return null;

	const mediaType = contentType.split(';')[0].trim().toLowerCase();

	return ACCEPTED_CONTENT_TYPES.includes(mediaType) ? mediaType : null;
}

function errorName(error: unknown): string {
	return error instanceof Error ? error.name : 'UnknownError';
}
