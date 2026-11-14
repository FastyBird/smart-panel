import { DeviceCategory } from '../../devices/devices.constants';
import { DeviceHiddenFilter } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DevicesService } from '../../devices/services/devices.service';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraProviderTimeoutError,
	CameraRateLimitedException,
	CameraUpstreamException,
	CamerasException,
	CamerasForbiddenException,
	CamerasNotFoundException,
} from '../cameras.exceptions';
import { ICameraStreamProvider } from '../platforms/camera-stream.provider';

import { CameraStreamProviderRegistryService } from './camera-stream-provider.registry.service';
import { CamerasService } from './cameras.service';

const provider = (type: string) =>
	({
		getType: () => type,
		listProfiles: jest.fn().mockResolvedValue([]),
		resolveSource: jest.fn(),
		getSnapshot: jest.fn(),
	}) as unknown as jest.Mocked<ICameraStreamProvider>;

const device = (id: string, category: DeviceCategory, type: string) =>
	({ id, name: `Device ${id}`, category, type }) as DeviceEntity;

describe('CamerasService', () => {
	const camera = device('c1', DeviceCategory.CAMERA, 'devices-a');
	const doorbell = device('d1', DeviceCategory.DOORBELL, 'devices-b');
	const light = device('l1', DeviceCategory.LIGHTING, 'devices-a');

	let service: CamerasService;
	let providerA: jest.Mocked<ICameraStreamProvider>;
	let devicesService: { findAll: jest.Mock; findOne: jest.Mock };

	beforeEach(() => {
		providerA = provider('devices-a');

		const registry = new CameraStreamProviderRegistryService();

		registry.register(providerA);

		const all = [camera, doorbell, light];

		devicesService = {
			findAll: jest.fn().mockResolvedValue(all),
			findOne: jest.fn((id: string) => Promise.resolve(all.find((d) => d.id === id) ?? null)),
		};

		service = new CamerasService(devicesService as unknown as DevicesService, registry);
	});

	it('lists only camera and doorbell devices', async () => {
		expect((await service.findAll()).map((c) => c.deviceId)).toEqual(['c1', 'd1']);
	});

	it('lists visible devices only', async () => {
		await service.findAll();

		expect(devicesService.findAll).toHaveBeenCalledWith(undefined, DeviceHiddenFilter.FALSE);
	});

	it('still resolves a hidden camera by id', async () => {
		devicesService.findOne.mockResolvedValue({ ...camera, hidden: true });

		await expect(service.getOneOrThrow('c1')).resolves.toMatchObject({ device: { id: 'c1' }, provider: providerA });
	});

	it('reports live_view and profiles from the provider', async () => {
		providerA.listProfiles.mockResolvedValue([{ id: 'medium', channelId: 'ch1', available: true }]);

		const [cam, bell] = await service.findAll();

		expect(cam.liveView).toBe(true);
		expect(cam.profiles).toEqual([expect.objectContaining({ id: 'medium', channelId: 'ch1', available: true })]);
		expect(bell.liveView).toBe(false);
		expect(bell.profiles).toEqual([]);
	});

	it('lists a camera with empty profiles when its provider throws', async () => {
		providerA.listProfiles.mockRejectedValue(new Error('rtsps://console:7441/SECRETALIAS'));

		const [cam] = await service.findAll();

		expect(cam.liveView).toBe(true);
		expect(cam.profiles).toEqual([]);
	});

	it('getOneOrThrow rejects unknown ids and non-camera devices', async () => {
		await expect(service.getOneOrThrow('missing')).rejects.toBeInstanceOf(CamerasNotFoundException);
		await expect(service.getOneOrThrow('l1')).rejects.toBeInstanceOf(CamerasNotFoundException);
	});

	it('getProviderOrThrow rejects a camera without a provider', async () => {
		await expect(service.getProviderOrThrow('d1')).rejects.toBeInstanceOf(CamerasNotFoundException);
		await expect(service.getProviderOrThrow('c1')).resolves.toEqual({ device: camera, provider: providerA });
	});

	it('resolveProfile picks the requested profile, defaults to the first available, and rejects unavailable ones', async () => {
		providerA.listProfiles.mockResolvedValue([
			{ id: 'high', channelId: 'ch1', available: false, unavailableReason: 'stream_not_enabled' },
			{ id: 'medium', channelId: 'ch1', available: true },
		]);

		expect((await service.resolveProfile(camera, providerA)).id).toBe('medium');
		expect((await service.resolveProfile(camera, providerA, 'medium')).id).toBe('medium');
		await expect(service.resolveProfile(camera, providerA, 'high')).rejects.toBeInstanceOf(
			CameraProfileUnavailableException,
		);
		await expect(service.resolveProfile(camera, providerA, 'nope')).rejects.toBeInstanceOf(
			CameraProfileUnavailableException,
		);
	});

	it('findProfileById returns a profile even when it is unavailable and rejects unknown ids', async () => {
		providerA.listProfiles.mockResolvedValue([
			{ id: 'high', channelId: 'ch1', available: false, unavailableReason: 'stream_not_enabled' },
		]);

		expect((await service.findProfileById(camera, providerA, 'high')).channelId).toBe('ch1');
		await expect(service.findProfileById(camera, providerA, 'nope')).rejects.toBeInstanceOf(
			CameraProfileUnavailableException,
		);
	});

	it('gives up on a provider that does not answer within the timeout', async () => {
		jest.useFakeTimers();

		try {
			providerA.listProfiles.mockReturnValue(new Promise(() => undefined));

			const pending = service.findAll();

			await jest.advanceTimersByTimeAsync(10_001);

			const [cam] = await pending;

			expect(cam.liveView).toBe(true);
			expect(cam.profiles).toEqual([]);
		} finally {
			jest.useRealTimers();
		}
	});

	it('resolveSource passes an abort signal and fails after 10 s', async () => {
		jest.useFakeTimers();

		try {
			providerA.resolveSource.mockReturnValue(new Promise(() => undefined));

			const pending = service.resolveSource(camera, providerA, 'medium').catch((e: Error) => e);

			await jest.advanceTimersByTimeAsync(1);

			const [, profileId, options] = providerA.resolveSource.mock.calls[0] as [
				unknown,
				string,
				{ signal: AbortSignal },
			];

			expect(profileId).toBe('medium');
			expect(options.signal.aborted).toBe(false);

			await jest.advanceTimersByTimeAsync(10_001);

			expect(await pending).toBeInstanceOf(CameraProviderTimeoutError);
			expect(options.signal.aborted).toBe(true);
		} finally {
			jest.useRealTimers();
		}
	});

	it('resolveSource returns the provider source', async () => {
		providerA.resolveSource.mockResolvedValue({ url: 'rtsp://cam.local/stream', transport: 'rtsp' });

		await expect(service.resolveSource(camera, providerA, 'medium')).resolves.toEqual({
			url: 'rtsp://cam.local/stream',
			transport: 'rtsp',
		});
	});

	it('resolveSource sanitizes provider errors', async () => {
		const secretUrl = 'rtsps://fake-console:7441/SENTINELALIAS0123456789?enableSrtp';

		providerA.resolveSource.mockRejectedValue(new Error(secretUrl));

		const error = await service.resolveSource(camera, providerA, 'medium').catch((e: Error) => e);

		expect(error).toBeInstanceOf(CameraUpstreamException);
		expect((error as Error).message).toBe('Camera did not respond');
		expect(JSON.stringify((error as Error).message)).not.toContain('SENTINELALIAS');
	});

	it('resolveSource keeps an offline camera as offline', async () => {
		providerA.resolveSource.mockRejectedValue(new CameraOfflineException('x rtsp://secret'));

		await expect(service.resolveSource(camera, providerA, 'medium')).rejects.toMatchObject({
			name: 'CameraOfflineException',
			message: 'Camera is offline',
		});
	});

	it('passes an abort signal to listProfiles and aborts it on timeout', async () => {
		jest.useFakeTimers();

		try {
			providerA.listProfiles.mockReturnValue(new Promise(() => undefined));

			const pending = service.findAll();

			await jest.advanceTimersByTimeAsync(1);

			const options = providerA.listProfiles.mock.calls[0][1] as { signal: AbortSignal };

			expect(options.signal.aborted).toBe(false);

			await jest.advanceTimersByTimeAsync(10_001);
			await pending;

			expect(options.signal.aborted).toBe(true);
		} finally {
			jest.useRealTimers();
		}
	});

	describe('profile lookup coalescing', () => {
		it('serves concurrent lookups of one device with a single provider call', async () => {
			let release!: (value: never[]) => void;

			providerA.listProfiles.mockReturnValue(new Promise((resolve) => (release = resolve)));

			const first = service.findProfileById(camera, providerA, 'p1').catch((e: unknown) => e);
			const second = service.toModel(camera, providerA);

			release([]);

			await Promise.all([first, second]);

			expect(providerA.listProfiles.mock.calls).toHaveLength(1);
		});

		it('does not start another provider call after the first lookup timed out', async () => {
			jest.useFakeTimers();

			try {
				providerA.listProfiles.mockReturnValue(new Promise(() => undefined));

				const first = service.resolveProfile(camera, providerA).catch((e: unknown) => e);

				await jest.advanceTimersByTimeAsync(10_001);

				expect(await first).toBeInstanceOf(CameraProviderTimeoutError);

				const second = service.resolveProfile(camera, providerA).catch((e: unknown) => e);

				await jest.advanceTimersByTimeAsync(10_001);

				expect(await second).toBeInstanceOf(CameraProviderTimeoutError);
				expect(providerA.listProfiles.mock.calls).toHaveLength(1);
			} finally {
				jest.useRealTimers();
			}
		});

		it('calls the provider again once the earlier call has settled', async () => {
			jest.useFakeTimers();

			try {
				let release!: (value: never[]) => void;

				providerA.listProfiles.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

				const first = service.findProfileById(camera, providerA, 'p1').catch((e: unknown) => e);

				await jest.advanceTimersByTimeAsync(10_001);
				await first;

				release([]);
				await jest.advanceTimersByTimeAsync(1);

				providerA.listProfiles.mockResolvedValue([{ id: 'p1', channelId: 'ch1', available: true }]);

				await expect(service.findProfileById(camera, providerA, 'p1')).resolves.toMatchObject({ id: 'p1' });
				expect(providerA.listProfiles.mock.calls).toHaveLength(2);
			} finally {
				jest.useRealTimers();
			}
		});

		it('does not let a replacement provider join the old provider pending lookup', async () => {
			jest.useFakeTimers();

			try {
				const providerB = provider('devices-a');

				providerA.listProfiles.mockReturnValue(new Promise(() => undefined));
				providerB.listProfiles.mockResolvedValue([{ id: 'pb', channelId: 'ch1', available: true }]);

				const first = service.resolveProfile(camera, providerA).catch((e: unknown) => e);

				await jest.advanceTimersByTimeAsync(1);

				await expect(service.findProfileById(camera, providerB, 'pb')).resolves.toMatchObject({ id: 'pb' });
				expect(providerB.listProfiles.mock.calls).toHaveLength(1);

				const again = service.resolveProfile(camera, providerA).catch((e: unknown) => e);

				await jest.advanceTimersByTimeAsync(10_001);

				expect(await first).toBeInstanceOf(CameraProviderTimeoutError);
				expect(await again).toBeInstanceOf(CameraProviderTimeoutError);
				expect(providerA.listProfiles.mock.calls).toHaveLength(1);
			} finally {
				jest.useRealTimers();
			}
		});

		it('clears the entry when the provider call is rejected', async () => {
			providerA.listProfiles.mockRejectedValueOnce(new Error('boom'));

			await expect(service.findProfileById(camera, providerA, 'p1')).rejects.toBeInstanceOf(CamerasException);

			providerA.listProfiles.mockResolvedValue([{ id: 'p1', channelId: 'ch1', available: true }]);

			await expect(service.findProfileById(camera, providerA, 'p1')).resolves.toMatchObject({ id: 'p1' });
			expect(providerA.listProfiles.mock.calls).toHaveLength(2);
		});
	});

	it('does not log the name an untrusted provider error carries', async () => {
		const warn = jest.fn();
		const thrown = new Error('x');

		thrown.name = 'rtsps://console:7441/SECRETALIAS';
		(service as unknown as { logger: { warn: jest.Mock } }).logger = { warn };
		providerA.listProfiles.mockRejectedValue(thrown);

		await service.resolveProfile(camera, providerA).catch(() => undefined);

		expect(JSON.stringify(warn.mock.calls)).toContain('ProviderError');
		expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRETALIAS');
	});

	it('wraps an untyped provider error without leaking its message', async () => {
		providerA.listProfiles.mockRejectedValue(new Error('rtsps://fake-console:7441/SECRET'));

		const resolved = service.resolveProfile(camera, providerA).catch((e: Error) => e);
		const found = service.findProfileById(camera, providerA, 'high').catch((e: Error) => e);

		for (const error of [await resolved, await found] as Error[]) {
			expect(error).toBeInstanceOf(CameraUpstreamException);
			expect(error.message).toBe('Camera did not respond');
			expect(JSON.stringify([error.name, error.message])).not.toContain('SECRET');
		}
	});

	it.each([
		['offline', new CameraOfflineException('alias SENTINELALIAS'), CameraOfflineException, 'Camera is offline'],
		[
			'rate limited',
			new CameraRateLimitedException('alias SENTINELALIAS'),
			CameraRateLimitedException,
			'Camera is busy',
		],
		[
			'profile unavailable',
			new CameraProfileUnavailableException('alias SENTINELALIAS'),
			CameraProfileUnavailableException,
			'Stream profile is not available',
		],
	])('passes a provider %s exception through with a fixed message', async (_name, thrown, expected, message) => {
		providerA.listProfiles.mockRejectedValue(thrown);

		const error = await service.resolveProfile(camera, providerA).catch((e: Error) => e);

		expect(error).toBeInstanceOf(expected);
		expect((error as Error).message).toBe(message);
	});

	it.each([
		['not found', new CamerasNotFoundException('alias SENTINELALIAS')],
		['forbidden', new CamerasForbiddenException('alias SENTINELALIAS')],
		['base', new CamerasException('alias SENTINELALIAS')],
		['upstream', new CameraUpstreamException('alias SENTINELALIAS')],
	])('wraps a provider %s exception as CameraUpstreamException', async (_name, thrown) => {
		providerA.listProfiles.mockRejectedValue(thrown);

		for (const error of [
			await service.resolveProfile(camera, providerA).catch((e: Error) => e),
			await service.findProfileById(camera, providerA, 'high').catch((e: Error) => e),
		]) {
			expect(error).toBeInstanceOf(CameraUpstreamException);
			expect((error as Error).constructor).toBe(CameraUpstreamException);
			expect((error as Error).message).toBe('Camera did not respond');
		}
	});

	it('logs the device id but never the error message when a provider call fails', async () => {
		const warn = jest.fn();

		(service as unknown as { logger: { warn: jest.Mock } }).logger = { warn };
		providerA.listProfiles.mockRejectedValue(new CamerasForbiddenException('alias SENTINELALIAS'));

		await service.resolveProfile(camera, providerA).catch(() => undefined);

		const line = (warn.mock.calls as string[][]).map((call) => call[0]).join('\n');

		expect(warn).toHaveBeenCalledTimes(1);
		expect(line).toContain('deviceId=c1');
		expect(line).toContain('CamerasForbiddenException');
		expect(JSON.stringify(warn.mock.calls)).not.toContain('SENTINELALIAS');
	});

	it('unrefs the provider timeout timer so that it cannot keep the process alive', async () => {
		const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

		try {
			await service.resolveProfile(camera, providerA).catch(() => undefined);

			const timer = setTimeoutSpy.mock.results.map((r) => r.value as NodeJS.Timeout).find((t) => t !== undefined);

			expect(timer?.hasRef()).toBe(false);
		} finally {
			setTimeoutSpy.mockRestore();
		}
	});
});
