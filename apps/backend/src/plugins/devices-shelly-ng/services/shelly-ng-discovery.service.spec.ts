import { EventEmitter } from 'events';

import { DevicesService } from '../../../modules/devices/services/devices.service';

import { DeviceManagerService } from './device-manager.service';
import { ShellyNgDiscoveryService } from './shelly-ng-discovery.service';
import { ShellyNgService } from './shelly-ng.service';

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

interface FakeLibDevice {
	id: string;
	model: string;
	modelName: string;
	firmware: { version?: string };
	wifi?: { sta_ip?: string };
	ethernet?: { ip?: string };
	system?: { config?: { device?: { name?: string | null } } };
}

const buildLibDevice = (overrides: Partial<FakeLibDevice> = {}): FakeLibDevice => ({
	id: 'shellyplus1-aabbcc',
	model: 'SNSW-001X16EU',
	modelName: 'Shelly Plus 1',
	firmware: { version: '1.2.3' },
	wifi: { sta_ip: '192.168.1.10' },
	system: { config: { device: { name: 'Kitchen relay' } } },
	...overrides,
});

describe('ShellyNgDiscoveryService', () => {
	let service: ShellyNgDiscoveryService;
	let deviceManager: jest.Mocked<DeviceManagerService>;
	let devicesService: jest.Mocked<DevicesService>;
	let shellyNgService: jest.Mocked<ShellyNgService>;
	let addedEmitter: EventEmitter;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();

		deviceManager = {
			getDeviceInfo: jest.fn(),
		} as unknown as jest.Mocked<DeviceManagerService>;
		devicesService = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<DevicesService>;

		addedEmitter = new EventEmitter();
		shellyNgService = {
			getKnownDevices: jest.fn().mockReturnValue([]),
			subscribeToAddedDevice: jest.fn((handler: (device: unknown) => void) => {
				addedEmitter.on('add', handler);
				return () => addedEmitter.off('add', handler);
			}),
		} as unknown as jest.Mocked<ShellyNgService>;

		service = new ShellyNgDiscoveryService(deviceManager, devicesService, shellyNgService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('seeds the session from devices the main connector already knows', async () => {
		const libDevice = buildLibDevice();
		shellyNgService.getKnownDevices.mockReturnValue([libDevice as unknown as never]);
		devicesService.findOneBy.mockResolvedValue(null);

		const session = await service.start({ duration: 30 });

		expect(deviceManager.getDeviceInfo.mock.calls).toHaveLength(0);
		expect(session.devices).toEqual([
			expect.objectContaining({
				identifier: 'shellyplus1-aabbcc',
				hostname: '192.168.1.10',
				name: 'Kitchen relay',
				model: 'SNSW-001X16EU',
				displayName: 'Shelly Plus 1',
				status: 'ready',
				source: 'mdns',
				categories: ['lighting', 'switcher'],
			}),
		]);
	});

	it('marks devices already in the database as already_registered without RPC', async () => {
		const libDevice = buildLibDevice();
		shellyNgService.getKnownDevices.mockReturnValue([libDevice as unknown as never]);
		devicesService.findOneBy.mockResolvedValue({
			id: 'existing-uuid',
			name: 'Adopted relay',
		} as never);

		const session = await service.start({ duration: 30 });

		expect(deviceManager.getDeviceInfo.mock.calls).toHaveLength(0);
		expect(session.devices[0]).toEqual(
			expect.objectContaining({
				status: 'already_registered',
				registeredDeviceId: 'existing-uuid',
				registeredDeviceName: 'Adopted relay',
			}),
		);
	});

	it('picks up new devices the main connector reports during the scan window', async () => {
		shellyNgService.getKnownDevices.mockReturnValue([]);
		devicesService.findOneBy.mockResolvedValue(null);

		const session = await service.start({ duration: 30 });

		expect(session.devices).toEqual([]);

		addedEmitter.emit('add', buildLibDevice());

		await Promise.resolve();
		await Promise.resolve();

		expect(service.get(session.id)?.devices).toEqual([
			expect.objectContaining({
				identifier: 'shellyplus1-aabbcc',
				status: 'ready',
				source: 'mdns',
			}),
		]);
	});

	it('inspects manually entered hostnames over RPC and stores their password', async () => {
		shellyNgService.getKnownDevices.mockReturnValue([]);
		devicesService.findOneBy.mockResolvedValue(null);
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

		const session = await service.start({ duration: 30 });

		await service.manual(session.id, {
			hostname: '192.168.1.11',
			password: 'secret',
		});

		expect(deviceManager.getDeviceInfo.mock.calls.at(-1)).toEqual(['192.168.1.11', 'secret']);
		expect(service.get(session.id)?.devices.at(-1)).toEqual(
			expect.objectContaining({
				identifier: 'shellyht-aabbcc',
				status: 'ready',
				source: 'manual',
			}),
		);
	});

	it('does not overwrite a manually-entered snapshot when the same hostname comes through the lib', async () => {
		shellyNgService.getKnownDevices.mockReturnValue([]);
		devicesService.findOneBy.mockResolvedValue(null);
		deviceManager.getDeviceInfo.mockResolvedValue({
			id: 'shellyplus1-aabbcc',
			name: 'Manual entry name',
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

		const session = await service.start({ duration: 30 });

		await service.manual(session.id, {
			hostname: '192.168.1.10',
			password: null,
		});

		// Lib reports the same hostname after the user already entered it manually.
		addedEmitter.emit('add', buildLibDevice());

		await Promise.resolve();
		await Promise.resolve();

		// Manual entry wins — it has the user's password and is the canonical snapshot.
		expect(service.get(session.id)?.devices[0]).toEqual(
			expect.objectContaining({
				source: 'manual',
				name: 'Manual entry name',
			}),
		);
	});

	it('finishes after the requested duration and detaches the listener', async () => {
		const unsubscribe = jest.fn();
		shellyNgService.subscribeToAddedDevice.mockReturnValue(unsubscribe);

		const session = await service.start({ duration: 5 });

		jest.advanceTimersByTime(5_000);
		await Promise.resolve();

		expect(service.get(session.id)?.status).toBe('finished');
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it('removes finished sessions after the cleanup delay', async () => {
		const session = await service.start({ duration: 5 });

		jest.advanceTimersByTime(5_000);
		await Promise.resolve();

		expect(service.get(session.id)?.status).toBe('finished');

		jest.advanceTimersByTime(5 * 60_000);

		expect(service.get(session.id)).toBeNull();
	});
});
