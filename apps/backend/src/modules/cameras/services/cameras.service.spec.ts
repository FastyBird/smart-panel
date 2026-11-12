import { DeviceCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DevicesService } from '../../devices/services/devices.service';
import { CameraProfileUnavailableException, CamerasNotFoundException } from '../cameras.exceptions';
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
});
