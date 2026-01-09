/*
eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion,
@typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { SHELLY_AUTH_USERNAME } from '../devices-shelly-v1.constants';
import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import { ShellyInfoResponse, ShellySettingsResponse, ShellyStatusResponse } from '../interfaces/shelly-http.interface';

import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';
import { ShellyV1ProbeService } from './shelly-v1-probe.service';

jest.mock('../devices-shelly-v1.constants', () => ({
	...jest.requireActual('../devices-shelly-v1.constants'),
	DESCRIPTORS: {
		SHELLY1: {
			name: 'Shelly 1',
			models: ['SHSW-1'],
			categories: ['switcher'],
			bindings: [],
		},
		SHELLY25: {
			name: 'Shelly 2.5',
			models: ['SHSW-25'],
			categories: ['switcher'],
			bindings: [],
		},
	},
}));

describe('ShellyV1ProbeService', () => {
	let service: ShellyV1ProbeService;
	let httpClient: jest.Mocked<ShellyV1HttpClientService>;

	const mockShellyInfo: ShellyInfoResponse = {
		type: 'SHSW-1',
		mac: '8CBFEAA58474',
		auth: false,
		fw: '1.14.0',
		longid: 1234567890,
	};

	const mockStatus: ShellyStatusResponse = {
		wifi_sta: {
			connected: true,
			ssid: 'MyWiFi',
			ip: '192.168.1.100',
			rssi: -60,
		},
		cloud: {
			enabled: false,
			connected: false,
		},
		mqtt: {
			connected: false,
		},
		time: '10:30',
		unixtime: 1700000000,
		serial: 123,
		has_update: false,
		mac: '8CBFEAA58474',
		uptime: 3600,
		ram_total: 50000,
		ram_free: 30000,
		ram_lwm: 25000,
		fs_size: 200000,
		fs_free: 150000,
	};

	const mockSettings: ShellySettingsResponse = {
		device: {
			type: 'SHSW-1',
			mac: '8CBFEAA58474',
			hostname: 'shelly1-8CBFEAA58474',
		},
		wifi_ao: {
			enabled: false,
			ssid: '',
		},
		wifi_sta: {
			enabled: true,
			ssid: 'MyWiFi',
			ipv4_method: 'dhcp',
			ip: '192.168.1.100',
			gw: '192.168.1.1',
			mask: '255.255.255.0',
			dns: '192.168.1.1',
		},
		fw: '1.14.0',
		name: 'My Shelly',
		discoverable: true,
		timezone: 'UTC',
		cloud: {
			enabled: false,
			connected: false,
		},
	};

	beforeAll(() => {});

	beforeEach(async () => {
		const httpClientMock: Partial<jest.Mocked<ShellyV1HttpClientService>> = {
			getDeviceInfo: jest.fn(),
			getDeviceStatus: jest.fn(),
			getDeviceSettings: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [ShellyV1ProbeService, { provide: ShellyV1HttpClientService, useValue: httpClientMock }],
		}).compile();

		service = module.get(ShellyV1ProbeService);
		httpClient = module.get(ShellyV1HttpClientService) as jest.Mocked<ShellyV1HttpClientService>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('service is defined', () => {
		expect(service).toBeDefined();
	});

	describe('probeDevice', () => {
		it('successfully probes device without auth', async () => {
			httpClient.getDeviceInfo.mockResolvedValue(mockShellyInfo);
			httpClient.getDeviceStatus.mockResolvedValue(mockStatus);
			httpClient.getDeviceSettings.mockResolvedValue(mockSettings);

			const result = await service.probeDevice({ hostname: '192.168.1.100' });

			expect(result.reachable).toBe(true);
			expect(result.authRequired).toBe(false);
			expect(result.host).toBe('192.168.1.100');
			expect(result.mac).toBe('8CBFEAA58474');
			expect(result.model).toBe('SHSW-1');
			expect(result.firmware).toBe('1.14.0');
			expect(result.ip).toBe('192.168.1.100');
			expect(result.deviceType).toBe('Shelly 1');
			expect(result.description).toBe('Shelly 1 (SHSW-1)');

			expect(httpClient.getDeviceInfo).toHaveBeenCalledWith('192.168.1.100');
			expect(httpClient.getDeviceStatus).toHaveBeenCalledWith('192.168.1.100');
			// Note: getDeviceSettings is no longer called during probe (optimization)
		});

		it('successfully probes device with valid auth', async () => {
			const shellyInfoWithAuth = { ...mockShellyInfo, auth: true };

			httpClient.getDeviceInfo.mockResolvedValue(shellyInfoWithAuth);
			httpClient.getDeviceStatus.mockResolvedValue(mockStatus);

			const result = await service.probeDevice({ hostname: '192.168.1.100', password: 'secret' });

			expect(result.reachable).toBe(true);
			expect(result.authRequired).toBe(true);
			expect(result.authValid).toBe(true);
			expect(result.ip).toBe('192.168.1.100');

			expect(httpClient.getDeviceInfo).toHaveBeenCalledWith('192.168.1.100');
			expect(httpClient.getDeviceStatus).toHaveBeenCalledWith(
				'192.168.1.100',
				undefined,
				SHELLY_AUTH_USERNAME,
				'secret',
			);
			// Note: getDeviceSettings is no longer called during probe (optimization)
		});

		it('returns authValid=false when auth credentials are invalid', async () => {
			const shellyInfoWithAuth = { ...mockShellyInfo, auth: true };

			httpClient.getDeviceInfo.mockResolvedValue(shellyInfoWithAuth);
			httpClient.getDeviceStatus.mockRejectedValue(
				new DevicesShellyV1Exception('HTTP request failed: 401 Unauthorized'),
			);

			const result = await service.probeDevice({ hostname: '192.168.1.100', password: 'wrong' });

			expect(result.reachable).toBe(true);
			expect(result.authRequired).toBe(true);
			expect(result.authValid).toBe(false);
			expect(result.ip).toBeUndefined();
		});

		it('returns authValid=undefined when auth required but no password provided', async () => {
			const shellyInfoWithAuth = { ...mockShellyInfo, auth: true };

			httpClient.getDeviceInfo.mockResolvedValue(shellyInfoWithAuth);

			const result = await service.probeDevice({ hostname: '192.168.1.100' });

			expect(result.reachable).toBe(true);
			expect(result.authRequired).toBe(true);
			expect(result.authValid).toBeUndefined();

			expect(httpClient.getDeviceStatus).not.toHaveBeenCalled();
			expect(httpClient.getDeviceSettings).not.toHaveBeenCalled();
		});

		it('returns unreachable when device info fetch fails', async () => {
			httpClient.getDeviceInfo.mockRejectedValue(new DevicesShellyV1Exception('Request timeout'));

			const result = await service.probeDevice({ hostname: '192.168.1.200' });

			expect(result.reachable).toBe(false);
			expect(result.authRequired).toBe(false);
			expect(result.host).toBe('192.168.1.200');
			expect(result.mac).toBeUndefined();
			expect(result.model).toBeUndefined();
		});

		it('handles partial failures gracefully (status fetch fails)', async () => {
			httpClient.getDeviceInfo.mockResolvedValue(mockShellyInfo);
			httpClient.getDeviceStatus.mockRejectedValue(new DevicesShellyV1Exception('Connection refused'));
			httpClient.getDeviceSettings.mockResolvedValue(mockSettings);

			const result = await service.probeDevice({ hostname: '192.168.1.100' });

			expect(result.reachable).toBe(true);
			expect(result.ip).toBeUndefined(); // No IP from status
		});

		it('handles partial failures gracefully (settings fetch fails)', async () => {
			httpClient.getDeviceInfo.mockResolvedValue(mockShellyInfo);
			httpClient.getDeviceStatus.mockResolvedValue(mockStatus);
			httpClient.getDeviceSettings.mockRejectedValue(new DevicesShellyV1Exception('Connection refused'));

			const result = await service.probeDevice({ hostname: '192.168.1.100' });

			expect(result.reachable).toBe(true);
			expect(result.ip).toBe('192.168.1.100');
		});

		it('matches device to descriptor by model string', async () => {
			const shellyInfoWithModel = { ...mockShellyInfo, type: 'SHSW-25' };

			httpClient.getDeviceInfo.mockResolvedValue(shellyInfoWithModel);
			httpClient.getDeviceStatus.mockResolvedValue(mockStatus);
			httpClient.getDeviceSettings.mockResolvedValue(mockSettings);

			const result = await service.probeDevice({ hostname: '192.168.1.100' });

			expect(result.deviceType).toBe('Shelly 2.5');
		});

		it('returns no descriptor match for unknown device type', async () => {
			const shellyInfoWithUnknown = { ...mockShellyInfo, type: 'UNKNOWN-DEVICE' };

			httpClient.getDeviceInfo.mockResolvedValue(shellyInfoWithUnknown);
			httpClient.getDeviceStatus.mockResolvedValue(mockStatus);
			httpClient.getDeviceSettings.mockResolvedValue(mockSettings);

			const result = await service.probeDevice({ hostname: '192.168.1.100' });

			expect(result.reachable).toBe(true);
			expect(result.model).toBe('UNKNOWN-DEVICE');
			expect(result.deviceType).toBeUndefined();
		});
	});
});
