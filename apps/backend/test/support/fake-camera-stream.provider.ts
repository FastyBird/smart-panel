import { CameraOfflineException, CameraRateLimitedException } from '../../src/modules/cameras/cameras.exceptions';
import {
	CameraSnapshot,
	CameraStreamProfile,
	CameraStreamSource,
	ICameraStreamProvider,
} from '../../src/modules/cameras/platforms/camera-stream.provider';
import { ChannelCategory } from '../../src/modules/devices/devices.constants';
import { DeviceEntity } from '../../src/modules/devices/entities/devices.entity';

export const FAKE_CAMERA_SECRET_URL = 'rtsps://fake-console:7441/SENTINELALIAS0123456789?enableSrtp';

// A valid 2x2 JPEG.
export const FAKE_CAMERA_JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7/ooooA//2Q==',
	'base64',
);

export type FakeCameraMode = 'ok' | 'offline' | 'rate_limited' | 'throw_with_secret';

export class FakeCameraStreamProvider implements ICameraStreamProvider {
	mode: FakeCameraMode = 'ok';
	snapshotCalls = 0;

	constructor(private readonly type: string) {}

	getType(): string {
		return this.type;
	}

	listProfiles(device: DeviceEntity): Promise<CameraStreamProfile[]> {
		this.throwIfSecret();

		const channelId =
			device.channels?.find((channel) => channel.category === ChannelCategory.CAMERA)?.id ?? 'camera-channel';

		return Promise.resolve([
			{ id: 'medium', channelId, width: 1280, height: 720, fps: 15, videoCodec: 'h264', available: true },
			{ id: 'high', channelId, available: false, unavailableReason: 'stream_not_enabled' },
		]);
	}

	resolveSource(): Promise<CameraStreamSource> {
		this.throwIfSecret();

		return Promise.resolve({ url: FAKE_CAMERA_SECRET_URL, transport: 'rtsps-insecure' });
	}

	async getSnapshot(): Promise<CameraSnapshot> {
		this.snapshotCalls++;

		this.throwIfSecret();

		// Yield so that parallel requests can join the same in-flight call.
		await new Promise((resolve) => setTimeout(resolve, 20));

		if (this.mode === 'offline') throw new CameraOfflineException('Camera is offline');
		if (this.mode === 'rate_limited') throw new CameraRateLimitedException('Camera is busy');

		return { contentType: 'image/jpeg', data: FAKE_CAMERA_JPEG };
	}

	private throwIfSecret(): void {
		if (this.mode === 'throw_with_secret') {
			throw new Error(FAKE_CAMERA_SECRET_URL);
		}
	}
}
