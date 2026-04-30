import { EventEmitter } from 'events';

import { DevicesService } from '../../../modules/devices/services/devices.service';

import { DeviceManagerService } from './device-manager.service';
import { ShellyNgDiscoveryService } from './shelly-ng-discovery.service';

const startMock = jest.fn();
const stopMock = jest.fn();
const discoverers: EventEmitter[] = [];

jest.mock('shellies-ds9', () => ({
	MdnsDeviceDiscoverer: class MockMdnsDeviceDiscoverer extends EventEmitter {
		constructor() {
			super();
			discoverers.push(this);
		}

		start = startMock;
		stop = stopMock;
	},
}));

jest.mock('../devices-shelly-ng.constants', () => ({
	DEVICES_SHELLY_NG_PLUGIN_NAME: 'devices-shelly-ng-plugin',
	DEVICES_SHELLY_NG_TYPE: 'shelly-ng',
	AddressType: {
		ETHERNET: 'ethernet',
		WIFI: 'wifi',
	},
	DESCRIPTORS: {
		SWITCH: {
			name: 'Shelly Plus 1',
			models: ['SNSW-001X16EU'],
			categories: ['lighting', 'switcher'],
			components: [{ type: 'switch', ids: [0] }],
			system: [{ type: 'wifi' }],
		},
		SENSOR: {
			name: 'Shelly H&T',
			models: ['SNSN-0013A'],
			categories: ['sensor'],
			components: [{ type: 'temperature', ids: [0] }],
			system: [{ type: 'wifi' }],
		},
	},
}));

describe('ShellyNgDiscoveryService', () => {
	let service: ShellyNgDiscoveryService;
	let deviceManager: jest.Mocked<DeviceManagerService>;
	let devicesService: jest.Mocked<DevicesService>;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		discoverers.length = 0;

		startMock.mockResolvedValue(undefined);
		stopMock.mockResolvedValue(undefined);

		deviceManager = {
			getDeviceInfo: jest.fn(),
		} as unknown as jest.Mocked<DeviceManagerService>;
		devicesService = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<DevicesService>;

		service = new ShellyNgDiscoveryService(deviceManager, devicesService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('starts an mDNS scan and enriches discovered unprotected devices', async () => {
		deviceManager.getDeviceInfo.mockResolvedValue({
			id: 'shellyplus1-aabbcc',
			name: 'Kitchen relay',
			mac: 'AABBCC',
			model: 'SNSW-001X16EU',
			fw_id: '2024-05-05-0000',
			ver: '1.2.3',
			app: 'Plus1',
			profile: 'switch',
			auth_en: false,
			auth_domain: null,
			discoverable: true,
			key: 'key-abc',
			batch: 'b',
			fw_sbits: 'bits',
			components: [{ type: 'switch', ids: [0] }],
		});
		devicesService.findOneBy.mockResolvedValue(null);

		const session = await service.start({ duration: 30 });

		expect(startMock).toHaveBeenCalledTimes(1);
		expect(session.status).toBe('running');
		expect(session.devices).toEqual([]);

		discoverers[0]?.emit('discover', {
			deviceId: 'shellyplus1-aabbcc',
			hostname: '192.168.1.10',
		});

		await Promise.resolve();
		await Promise.resolve();

		const updated = service.get(session.id);

		expect(deviceManager.getDeviceInfo.mock.calls).toContainEqual(['192.168.1.10', null]);
		expect(updated?.devices).toEqual([
			expect.objectContaining({
				identifier: 'shellyplus1-aabbcc',
				hostname: '192.168.1.10',
				name: 'Kitchen relay',
				model: 'SNSW-001X16EU',
				displayName: 'Shelly Plus 1',
				status: 'ready',
				categories: ['lighting', 'switcher'],
				suggestedCategory: null,
			}),
		]);
	});

	it('marks protected devices as needing a password until manually verified', async () => {
		deviceManager.getDeviceInfo.mockResolvedValue({
			id: 'shellyht-aabbcc',
			name: 'Bathroom sensor',
			mac: 'AABBCC',
			model: 'SNSN-0013A',
			fw_id: '2024-05-05-0000',
			ver: '1.2.3',
			app: 'HT',
			profile: 'sensor',
			auth_en: true,
			auth_domain: 'shelly',
			discoverable: true,
			key: 'key-abc',
			batch: 'b',
			fw_sbits: 'bits',
			components: [{ type: 'temperature', ids: [0] }],
		});
		devicesService.findOneBy.mockResolvedValue(null);

		const session = await service.start({ duration: 30 });

		discoverers[0]?.emit('discover', {
			deviceId: 'shellyht-aabbcc',
			hostname: '192.168.1.11',
		});

		await Promise.resolve();
		await Promise.resolve();

		expect(service.get(session.id)?.devices[0]).toEqual(
			expect.objectContaining({
				status: 'needs_password',
				suggestedCategory: 'sensor',
			}),
		);

		await service.manual(session.id, {
			hostname: '192.168.1.11',
			password: 'secret',
		});

		expect(deviceManager.getDeviceInfo.mock.calls.at(-1)).toEqual(['192.168.1.11', 'secret']);
		expect(service.get(session.id)?.devices[0]).toEqual(
			expect.objectContaining({
				status: 'ready',
				source: 'manual',
			}),
		);
	});

	it('keeps using verified credentials when a protected device is rediscovered', async () => {
		deviceManager.getDeviceInfo.mockResolvedValue({
			id: 'shellyht-aabbcc',
			name: 'Bathroom sensor',
			mac: 'AABBCC',
			model: 'SNSN-0013A',
			fw_id: '2024-05-05-0000',
			ver: '1.2.3',
			app: 'HT',
			profile: 'sensor',
			auth_en: true,
			auth_domain: 'shelly',
			discoverable: true,
			key: 'key-abc',
			batch: 'b',
			fw_sbits: 'bits',
			components: [{ type: 'temperature', ids: [0] }],
		});
		devicesService.findOneBy.mockResolvedValue(null);

		const session = await service.start({ duration: 30 });

		await service.manual(session.id, {
			hostname: '192.168.1.11',
			password: 'secret',
		});

		discoverers[0]?.emit('discover', {
			deviceId: 'shellyht-aabbcc',
			hostname: 'shellyht-aabbcc.local',
		});

		await Promise.resolve();
		await Promise.resolve();

		expect(deviceManager.getDeviceInfo.mock.calls.at(-1)).toEqual(['shellyht-aabbcc.local', 'secret']);
		expect(service.get(session.id)?.devices.at(-1)).toEqual(
			expect.objectContaining({
				status: 'ready',
			}),
		);
	});

	it('finishes and stops the mDNS scan after the requested duration', async () => {
		const session = await service.start({ duration: 5 });

		jest.advanceTimersByTime(5_000);
		await Promise.resolve();

		const updated = service.get(session.id);

		expect(stopMock).toHaveBeenCalledTimes(1);
		expect(updated?.status).toBe('finished');
	});

	it('removes finished sessions after the cleanup delay', async () => {
		const session = await service.start({ duration: 5 });

		jest.advanceTimersByTime(5_000);
		await Promise.resolve();

		expect(service.get(session.id)?.status).toBe('finished');

		jest.advanceTimersByTime(5 * 60_000);

		expect(service.get(session.id)).toBeNull();
	});

	it('does not retain a session when mDNS startup fails', async () => {
		startMock.mockRejectedValueOnce(new Error('bind failed'));

		await expect(service.start({ duration: 5 })).rejects.toThrow('bind failed');

		expect((service as unknown as { sessions: Map<string, unknown> }).sessions.size).toBe(0);
		expect(jest.getTimerCount()).toBe(0);
	});
});
