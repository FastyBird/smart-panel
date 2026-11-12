import { DeviceEntity } from '../../devices/entities/devices.entity';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
	CamerasNotFoundException,
} from '../cameras.exceptions';
import { CameraSnapshot, CameraStreamProfile, ICameraStreamProvider } from '../platforms/camera-stream.provider';

import { CameraSnapshotService } from './camera-snapshot.service';
import { CameraProviderTimeoutError, CamerasService } from './cameras.service';

const jpeg = (n: number): CameraSnapshot => ({ contentType: 'image/jpeg', data: Buffer.from([0xff, 0xd8, n]) });

const flush = () => jest.advanceTimersByTimeAsync(0);

describe('CameraSnapshotService', () => {
	const device = { id: 'c1', name: 'Front door' } as DeviceEntity;

	let provider: ICameraStreamProvider;
	let getSnapshot: jest.Mock;
	let listProfiles: jest.Mock;
	let camerasService: { getProviderOrThrow: jest.Mock; findProfileById: jest.Mock };
	let service: CameraSnapshotService;

	beforeEach(() => {
		jest.useFakeTimers();

		getSnapshot = jest.fn().mockResolvedValue(jpeg(1));
		listProfiles = jest.fn();
		provider = {
			getType: () => 'devices-a',
			listProfiles,
			resolveSource: jest.fn(),
			getSnapshot,
		} as unknown as ICameraStreamProvider;

		camerasService = {
			getProviderOrThrow: jest.fn().mockResolvedValue({ device, provider }),
			findProfileById: jest.fn().mockImplementation((_d, _p, profileId: string) =>
				Promise.resolve({
					id: profileId,
					channelId: `ch-${profileId}`,
					available: false,
				} as CameraStreamProfile),
			),
		};

		service = new CameraSnapshotService(camerasService as unknown as CamerasService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('calls the provider once for concurrent requests', async () => {
		let release!: (v: CameraSnapshot) => void;

		getSnapshot.mockReturnValue(new Promise((r) => (release = r)));

		const all = Promise.all([
			service.getSnapshot('c1', {}),
			service.getSnapshot('c1', {}),
			service.getSnapshot('c1', {}),
		]);

		await flush();
		release(jpeg(1));

		const results = await all;

		expect(getSnapshot).toHaveBeenCalledTimes(1);
		expect(results.map((r) => r.data[2])).toEqual([1, 1, 1]);
	});

	it('serves the cached image inside the minimum interval and refetches after it', async () => {
		getSnapshot.mockResolvedValueOnce(jpeg(1)).mockResolvedValueOnce(jpeg(2));

		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(1999);

		const cached = await service.getSnapshot('c1', {});

		expect(cached.data[2]).toBe(1);
		expect(cached).toMatchObject({ stale: false, ageMs: 1999 });

		jest.advanceTimersByTime(2);

		expect((await service.getSnapshot('c1', {})).data[2]).toBe(2);
		expect(getSnapshot).toHaveBeenCalledTimes(2);
	});

	it('returns ageMs 0 and stale false for a fresh image', async () => {
		expect(await service.getSnapshot('c1', {})).toMatchObject({ stale: false, ageMs: 0, contentType: 'image/jpeg' });
	});

	it('uses the provider interval when it is valid and ignores one below 250 ms', async () => {
		const interval = jest.fn().mockReturnValue(5000);

		provider.getSnapshotMinIntervalMs = interval;

		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(4999);
		await service.getSnapshot('c1', {});

		expect(getSnapshot).toHaveBeenCalledTimes(1);

		jest.advanceTimersByTime(2);
		await service.getSnapshot('c1', {});

		expect(getSnapshot).toHaveBeenCalledTimes(2);

		interval.mockReturnValue(10);
		getSnapshot.mockClear();

		jest.advanceTimersByTime(5001);
		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(1999);
		await service.getSnapshot('c1', {});

		expect(getSnapshot).toHaveBeenCalledTimes(1);

		jest.advanceTimersByTime(2);
		await service.getSnapshot('c1', {});

		expect(getSnapshot).toHaveBeenCalledTimes(2);
	});

	it('falls back to the default interval when the provider value is not finite', async () => {
		provider.getSnapshotMinIntervalMs = jest.fn().mockReturnValue(Number.NaN) as () => number;

		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(1999);
		await service.getSnapshot('c1', {});

		expect(getSnapshot).toHaveBeenCalledTimes(1);
	});

	it('falls back to the default interval when the interval hook throws and does not log its message', async () => {
		provider.getSnapshotMinIntervalMs = jest.fn().mockImplementation(() => {
			throw new Error('rtsps://x:7441/SENTINEL');
		}) as () => number;

		const warn = jest.fn();

		(service as unknown as { logger: { warn: jest.Mock } }).logger = { warn };

		const first = await service.getSnapshot('c1', {});

		jest.advanceTimersByTime(1999);
		await service.getSnapshot('c1', {});

		expect(first.stale).toBe(false);
		expect(getSnapshot).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalled();
		expect(JSON.stringify(warn.mock.calls)).not.toContain('SENTINEL');
		expect(JSON.stringify(warn.mock.calls)).toContain('Error');
	});

	it('keeps separate entries per profile and quality', async () => {
		await service.getSnapshot('c1', { highQuality: true });
		await service.getSnapshot('c1', { highQuality: false });
		await service.getSnapshot('c1', { profileId: 'package', highQuality: false });
		await service.getSnapshot('c1', { profileId: 'high', highQuality: false });
		await service.getSnapshot('c1', { highQuality: true });
		await service.getSnapshot('c1', { profileId: 'package', highQuality: false });

		expect(getSnapshot).toHaveBeenCalledTimes(4);
	});

	it('passes channelId of the requested profile and highQuality to the provider', async () => {
		await service.getSnapshot('c1', { profileId: 'package', highQuality: true });

		expect(camerasService.findProfileById).toHaveBeenCalledWith(device, provider, 'package');
		expect(getSnapshot).toHaveBeenCalledWith(device, { channelId: 'ch-package', highQuality: true });
	});

	it('does not look the profile up again inside the minimum interval', async () => {
		await service.getSnapshot('c1', { profileId: 'package' });
		jest.advanceTimersByTime(1000);

		const cached = await service.getSnapshot('c1', { profileId: 'package' });

		expect(cached).toMatchObject({ stale: false, ageMs: 1000 });
		expect(camerasService.findProfileById).toHaveBeenCalledTimes(1);
		expect(getSnapshot).toHaveBeenCalledTimes(1);
	});

	it('looks the profile up once for concurrent requests', async () => {
		let release!: (v: CameraStreamProfile) => void;

		camerasService.findProfileById.mockReturnValue(new Promise((r) => (release = r)));

		const all = Promise.all([
			service.getSnapshot('c1', { profileId: 'package' }),
			service.getSnapshot('c1', { profileId: 'package' }),
			service.getSnapshot('c1', { profileId: 'package' }),
		]);

		await flush();
		release({ id: 'package', channelId: 'ch-package', available: false });
		await all;

		expect(camerasService.findProfileById).toHaveBeenCalledTimes(1);
		expect(getSnapshot).toHaveBeenCalledTimes(1);
	});

	it('serves the stale image when the profile lookup is rate limited', async () => {
		await service.getSnapshot('c1', { profileId: 'package' });
		jest.advanceTimersByTime(7000);
		camerasService.findProfileById.mockRejectedValueOnce(new CameraRateLimitedException('x'));

		const result = await service.getSnapshot('c1', { profileId: 'package' });

		expect(result).toMatchObject({ stale: true, ageMs: 7000 });
		expect(getSnapshot).toHaveBeenCalledTimes(1);
	});

	it('rethrows a rate limited profile lookup when nothing is cached', async () => {
		camerasService.findProfileById.mockRejectedValue(new CameraRateLimitedException('x'));

		await expect(service.getSnapshot('c1', { profileId: 'package' })).rejects.toBeInstanceOf(
			CameraRateLimitedException,
		);
	});

	it('never lists profiles without a profile id and passes an undefined channelId', async () => {
		await service.getSnapshot('c1', {});

		expect(camerasService.findProfileById).not.toHaveBeenCalled();
		expect(listProfiles).not.toHaveBeenCalled();
		expect(getSnapshot).toHaveBeenCalledWith(device, { channelId: undefined, highQuality: false });
	});

	it('propagates an unknown profile as unavailable', async () => {
		camerasService.findProfileById.mockRejectedValue(new CameraProfileUnavailableException('nope'));

		await expect(service.getSnapshot('c1', { profileId: 'nope' })).rejects.toBeInstanceOf(
			CameraProfileUnavailableException,
		);
		expect(getSnapshot).not.toHaveBeenCalled();

		// An unknown profile never creates a cache entry.
		getSnapshot.mockRejectedValue(new CameraRateLimitedException('x'));
		camerasService.findProfileById.mockImplementation((_d, _p, id: string) =>
			Promise.resolve({ id, channelId: `ch-${id}`, available: true }),
		);
		await expect(service.getSnapshot('c1', { profileId: 'nope' })).rejects.toBeInstanceOf(CameraRateLimitedException);
	});

	it('maps a profile lookup timeout or failure to CameraUpstreamException', async () => {
		camerasService.findProfileById.mockRejectedValueOnce(new CameraProviderTimeoutError());
		camerasService.findProfileById.mockRejectedValueOnce(new Error('rtsps://console:7441/SECRETALIAS'));

		await expect(service.getSnapshot('c1', { profileId: 'a' })).rejects.toBeInstanceOf(CameraUpstreamException);
		await expect(service.getSnapshot('c1', { profileId: 'a' })).rejects.toMatchObject({
			name: 'CameraUpstreamException',
			message: expect.not.stringContaining('SECRETALIAS') as unknown as string,
		});
	});

	it('propagates a missing camera', async () => {
		camerasService.getProviderOrThrow.mockRejectedValue(new CamerasNotFoundException('nope'));

		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CamerasNotFoundException);
	});

	it('returns the last image as stale while the provider is rate limited', async () => {
		getSnapshot.mockResolvedValueOnce(jpeg(1)).mockRejectedValueOnce(new CameraRateLimitedException('x'));

		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(7000);

		const result = await service.getSnapshot('c1', {});

		expect(result).toMatchObject({ stale: true, ageMs: 7000 });
		expect(result.data[2]).toBe(1);
	});

	it('rethrows rate limiting when nothing is cached', async () => {
		getSnapshot.mockRejectedValue(new CameraRateLimitedException('x'));

		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraRateLimitedException);
	});

	it('drops the cache when the camera goes offline', async () => {
		getSnapshot
			.mockResolvedValueOnce(jpeg(1))
			.mockRejectedValueOnce(new CameraOfflineException('x'))
			.mockRejectedValueOnce(new CameraRateLimitedException('x'));

		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(3000);
		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraOfflineException);
		jest.advanceTimersByTime(3000);
		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraRateLimitedException);
	});

	it('fails after 10 s, clears the in-flight call and retries on the next request', async () => {
		getSnapshot.mockReturnValueOnce(new Promise(() => undefined)).mockResolvedValueOnce(jpeg(2));

		const pending = service.getSnapshot('c1', {});
		const assertion = expect(pending).rejects.toBeInstanceOf(CameraUpstreamException);

		await jest.advanceTimersByTimeAsync(10_000);
		await assertion;

		expect((await service.getSnapshot('c1', {})).data[2]).toBe(2);
	});

	it('keeps the cached image when the provider fails with an unknown error', async () => {
		getSnapshot.mockResolvedValueOnce(jpeg(1)).mockRejectedValueOnce(new Error('boom'));

		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(3000);
		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraUpstreamException);

		getSnapshot.mockRejectedValueOnce(new CameraRateLimitedException('x'));
		jest.advanceTimersByTime(1000);

		expect(await service.getSnapshot('c1', {})).toMatchObject({ stale: true });
	});

	it('wraps unknown provider errors without their message', async () => {
		getSnapshot.mockRejectedValue(new Error('rtsps://console:7441/SECRETALIAS'));

		await expect(service.getSnapshot('c1', {})).rejects.toMatchObject({
			name: 'CameraUpstreamException',
			message: expect.not.stringContaining('SECRETALIAS') as unknown as string,
		});
	});

	it('never serves an entry older than 300 s', async () => {
		getSnapshot.mockResolvedValueOnce(jpeg(1)).mockRejectedValueOnce(new CameraRateLimitedException('x'));

		await service.getSnapshot('c1', {});
		jest.advanceTimersByTime(300_001);

		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraRateLimitedException);
	});

	it('evicts every entry of a deleted device', async () => {
		getSnapshot
			.mockResolvedValueOnce(jpeg(1))
			.mockResolvedValueOnce(jpeg(2))
			.mockRejectedValue(new CameraRateLimitedException('x'));

		await service.getSnapshot('c1', {});
		await service.getSnapshot('c1', { highQuality: true });
		service.onDeviceDeleted({ id: 'c1' });
		jest.advanceTimersByTime(3000);

		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraRateLimitedException);
		await expect(service.getSnapshot('c1', { highQuality: true })).rejects.toBeInstanceOf(CameraRateLimitedException);
	});

	it('does not store a result that finishes after the device was evicted', async () => {
		let release!: (v: CameraSnapshot) => void;

		getSnapshot
			.mockReturnValueOnce(new Promise((r) => (release = r)))
			.mockRejectedValue(new CameraRateLimitedException('x'));

		const pending = service.getSnapshot('c1', {});

		await flush();
		service.evict('c1');
		release(jpeg(1));
		await pending;
		jest.advanceTimersByTime(3000);

		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraRateLimitedException);
	});

	it('evict leaves other devices alone', async () => {
		getSnapshot.mockResolvedValueOnce(jpeg(1)).mockRejectedValueOnce(new CameraRateLimitedException('x'));
		camerasService.getProviderOrThrow.mockImplementation((id: string) =>
			Promise.resolve({ device: { ...device, id }, provider }),
		);

		await service.getSnapshot('c2', {});
		service.evict('c1');
		jest.advanceTimersByTime(3000);

		expect(await service.getSnapshot('c2', {})).toMatchObject({ stale: true });
	});

	it('rejects a non-image or empty provider result', async () => {
		getSnapshot.mockResolvedValueOnce({ contentType: 'text/html', data: Buffer.from('<html>') });
		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraUpstreamException);

		getSnapshot.mockResolvedValueOnce({ contentType: 'image/jpeg', data: Buffer.alloc(0) });
		await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraUpstreamException);
	});

	it('accepts png and webp results', async () => {
		getSnapshot.mockResolvedValueOnce({ contentType: 'image/png', data: Buffer.from([1]) });
		expect((await service.getSnapshot('c1', {})).contentType).toBe('image/png');

		service.evict('c1');
		getSnapshot.mockResolvedValueOnce({ contentType: 'image/webp', data: Buffer.from([1]) });
		expect((await service.getSnapshot('c1', {})).contentType).toBe('image/webp');
	});
});
