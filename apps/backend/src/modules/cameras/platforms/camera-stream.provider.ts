import { DeviceEntity } from '../../devices/entities/devices.entity';

export interface CameraStreamProfile {
	id: string; // 'high' | 'medium' | 'low' | 'package' | provider-defined
	channelId: string; // id of the device's `camera` channel this profile belongs to
	width?: number;
	height?: number;
	fps?: number;
	videoCodec?: string; // 'h264' | 'hevc' | 'av1' | …
	audioCodec?: string;
	available: boolean;
	unavailableReason?: string; // short machine code, e.g. 'stream_not_enabled'
}

export interface CameraStreamSource {
	url: string; // SECRET. Never logged, persisted or returned to a client.
	transport: 'rtsp' | 'rtsps-insecure' | 'http';
}

export interface CameraSnapshot {
	contentType: string;
	data: Buffer;
}

/**
 * A stream provider integrates one family of camera devices.
 *
 * Every call that reaches the camera or its vendor API takes an optional `AbortSignal`. The module bounds how long it
 * waits for a call and aborts the signal when that time is up, but it cannot stop the call itself: a provider MUST
 * bound its own upstream I/O (connect and read timeouts) and SHOULD stop its work when the signal aborts. The
 * module's timeout only ends the wait for the caller, which gets a 503; a call that ignores the signal keeps running
 * until it settles on its own, its result is discarded, and the module starts no further call for the same snapshot
 * until it has.
 */
export interface ICameraStreamProvider {
	getType(): string; // device `type` discriminator, e.g. 'devices-unifi-protect'
	listProfiles(device: DeviceEntity, options?: { signal?: AbortSignal }): Promise<CameraStreamProfile[]>;
	resolveSource(
		device: DeviceEntity,
		profileId: string,
		options?: { signal?: AbortSignal },
	): Promise<CameraStreamSource>;
	getSnapshot(
		device: DeviceEntity,
		options: { channelId?: string; highQuality?: boolean; signal?: AbortSignal },
	): Promise<CameraSnapshot>;
	getSnapshotMinIntervalMs?(device: DeviceEntity): number;
}
