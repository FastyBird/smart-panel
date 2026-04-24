/*
eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion,
@typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/unbound-method, @typescript-eslint/no-require-imports
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { MappingLoaderService } from '../mappings';
import { DeviceManagerService } from '../services/device-manager.service';
import { ShellyNgDiscoveryService } from '../services/shelly-ng-discovery.service';

import { ShellyNgDevicesController } from './shelly-ng-devices.controller';

jest.mock('../devices-shelly-ng.constants', () => ({
	DEVICES_SHELLY_NG_PLUGIN_NAME: 'devices-shelly-ng-plugin',
	DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME: 'devices-shelly-ng',
	AddressType: {
		ETHERNET: 'ethernet',
		WIFI: 'wifi',
	},
	ADDRESS_PRIORITY: {
		ethernet: 0,
		wifi: 1,
	},
	DESCRIPTORS: {
		SHELLYPLUS1: {
			name: 'Shelly Plus 1',
			models: ['SHEM-PLUS-1'],
			categories: ['switcher'],
			components: [{ type: 'switch', ids: [0] }],
			system: [{ type: 'wifi' }],
		},
		SHELLYDIMMER: {
			name: 'Shelly Dimmer',
			models: ['S3DM-0010WW'],
			categories: ['lighting'],
			components: [{ type: 'light', ids: [0] }],
			system: [{ type: 'wifi' }],
		},
	},
}));

describe('ShellyNgDevicesController', () => {
	let controller: ShellyNgDevicesController;
	let deviceManager: jest.Mocked<DeviceManagerService>;
	let discoveryService: jest.Mocked<ShellyNgDiscoveryService>;

	beforeAll(() => {});

	beforeEach(async () => {
		const deviceManagerMock: Partial<jest.Mocked<DeviceManagerService>> = {
			getDeviceInfo: jest.fn(),
		};
		const discoveryServiceMock: Partial<jest.Mocked<ShellyNgDiscoveryService>> = {
			start: jest.fn(),
			get: jest.fn(),
			manual: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ShellyNgDevicesController],
			providers: [
				{ provide: DeviceManagerService, useValue: deviceManagerMock },
				{ provide: ShellyNgDiscoveryService, useValue: discoveryServiceMock },
				{
					provide: MappingLoaderService,
					useValue: {
						reload: jest.fn(),
						getCacheStats: jest.fn(() => ({ size: 0, mappingsLoaded: 0 })),
					},
				},
			],
		}).compile();

		controller = module.get(ShellyNgDevicesController);
		deviceManager = module.get(DeviceManagerService) as jest.Mocked<DeviceManagerService>;
		discoveryService = module.get(ShellyNgDiscoveryService) as jest.Mocked<ShellyNgDiscoveryService>;
	});

	describe('Shelly NG discovery endpoints', () => {
		const discoverySession = {
			id: 'session-1',
			status: 'running' as const,
			startedAt: '2026-04-29T12:00:00.000Z',
			expiresAt: '2026-04-29T12:00:30.000Z',
			remainingSeconds: 30,
			devices: [],
		};

		it('starts a discovery session', async () => {
			discoveryService.start.mockResolvedValue(discoverySession);

			const result = await controller.startDiscovery();

			expect(discoveryService.start).toHaveBeenCalledWith({ duration: 30 });
			expect(result.data).toEqual(discoverySession);
		});

		it('returns an existing discovery session', () => {
			discoveryService.get.mockReturnValue(discoverySession);

			const result = controller.getDiscovery('session-1');

			expect(discoveryService.get).toHaveBeenCalledWith('session-1');
			expect(result.data).toEqual(discoverySession);
		});

		it('throws NotFoundException when discovery session does not exist', () => {
			discoveryService.get.mockReturnValue(null);

			expect(() => controller.getDiscovery('missing')).toThrow(NotFoundException);
		});

		it('adds manual device lookup to a discovery session', async () => {
			discoveryService.manual.mockResolvedValue(discoverySession);

			const result = await controller.addManualDiscoveryDevice('session-1', {
				data: {
					hostname: '192.168.1.12',
					password: 'secret',
				},
			});

			expect(discoveryService.manual).toHaveBeenCalledWith('session-1', {
				hostname: '192.168.1.12',
				password: 'secret',
			});
			expect(result.data).toEqual(discoverySession);
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('controller is defined', () => {
		expect(controller).toBeDefined();
	});

	describe('POST /devices/info (getInfo)', () => {
		const baseDeviceInfo = {
			id: 'shelly0110dimg3-8cbfeaa58474',
			name: 'My Shelly',
			mac: '8CBFEAA58474',
			model: 'S3DM-0010WW',
			fw_id: '2024-05-05-0000',
			ver: '1.7.0',
			app: 'Dimmer0110VPMG3',
			profile: 'switch',
			auth_en: true,
			auth_domain: 'local',
			discoverable: true,
			key: 'key-abc',
			batch: 'b',
			fw_sbits: 'bits',
			components: [{ type: 'switch', ids: [0, 1] }],
		};

		it('returns mapped & validated device info', async () => {
			deviceManager.getDeviceInfo.mockResolvedValue(baseDeviceInfo);

			const payload = { data: { hostname: '192.168.1.10', password: 'secret' } };
			const result = await controller.getInfo(payload);

			expect(result.data.firmware).toBe('1.7.0'); // from ver
			expect(result.data.authentication).toEqual({ enabled: true, domain: 'local' }); // from auth_en/auth_domain

			expect(result.data.id).toBe(baseDeviceInfo.id);
			expect(result.data.model).toBe(baseDeviceInfo.model);
			expect(Array.isArray(result.data.components)).toBe(true);
			expect(result.data.components[0]).toEqual({ type: 'switch', ids: [0, 1] });

			expect(deviceManager.getDeviceInfo).toHaveBeenCalledWith('192.168.1.10', 'secret');
		});

		it('throws NotFoundException when DeviceManagerService throws known domain error', async () => {
			const { DevicesShellyNgException } = jest.requireActual('../devices-shelly-ng.exceptions');
			deviceManager.getDeviceInfo.mockRejectedValue(new DevicesShellyNgException('boom'));

			await expect(controller.getInfo({ data: { hostname: 'x', password: 'y' } })).rejects.toThrow(NotFoundException);
		});

		it('re-throws unexpected errors (e.g. TypeError) without catching them', async () => {
			deviceManager.getDeviceInfo.mockRejectedValue(new TypeError('Cannot read properties of undefined'));

			await expect(controller.getInfo({ data: { hostname: 'x', password: 'y' } })).rejects.toThrow(TypeError);
		});

		it('throws UnprocessableEntityException on validation failure (bad components ids)', async () => {
			deviceManager.getDeviceInfo.mockResolvedValue({
				...baseDeviceInfo,
				components: [{ type: 'switch', ids: ['x' as unknown as number] }], // invalid shape for model
			});

			await expect(controller.getInfo({ data: { hostname: '192.168.1.10', password: null } })).rejects.toThrow(
				UnprocessableEntityException,
			);
		});
	});

	describe('GET /devices/supported (getSupported)', () => {
		it('returns validated supported devices derived from DESCRIPTORS', async () => {
			const result = await controller.getSupported();

			expect(result.data).toHaveLength(2);

			const groups = result.data.map((d) => d.group).sort();

			expect(groups).toEqual(['SHELLYDIMMER', 'SHELLYPLUS1']);

			const plus1 = result.data.find((d) => d.group === 'SHELLYPLUS1')!;

			expect(plus1.name).toBe('Shelly Plus 1');
			expect(plus1.models).toEqual(['SHEM-PLUS-1']);
			expect(plus1.components).toEqual([{ type: 'switch', ids: [0] }]);
			expect(plus1.system).toEqual([{ type: 'wifi' }]);
		});

		it('skips invalid descriptor entries (by validation) and still returns others', async () => {
			// Replace DESCRIPTORS at runtime to inject one invalid entry
			const constants = require('../devices-shelly-ng.constants');

			constants.DESCRIPTORS.BROKEN = {
				name: 'Broken',
				models: ['X'],
				categories: ['lighting'],
				components: [{ type: 'light', ids: ['bad' as any] }], // invalid ids
				system: [{ type: 'wifi' }],
			};

			const result = await controller.getSupported();

			const groups = result.data.map((d: any) => d.group);

			expect(groups).toContain('SHELLYPLUS1');
			expect(groups).toContain('SHELLYDIMMER');
			expect(groups).not.toContain('BROKEN');
		});
	});
});
