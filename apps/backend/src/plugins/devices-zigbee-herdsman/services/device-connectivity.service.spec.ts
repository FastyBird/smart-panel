import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DeviceConnectivityService as CoreDeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';

import { ZhDeviceConnectivityService } from './device-connectivity.service';
import { ZigbeeHerdsmanAdapterService } from './zigbee-herdsman-adapter.service';

describe('ZhDeviceConnectivityService', () => {
	let service: ZhDeviceConnectivityService;
	let adapterService: jest.Mocked<ZigbeeHerdsmanAdapterService>;

	beforeEach(async () => {
		const mockAdapterService = {
			getDiscoveredDevices: jest.fn().mockReturnValue([]),
		};

		const mockDevicesService = {
			findAll: jest.fn().mockResolvedValue([]),
			updateConnectionState: jest.fn().mockResolvedValue(undefined),
		};

		const mockConfigService = {
			getPluginConfig: jest.fn().mockResolvedValue({
				discovery: {
					mainsDeviceTimeout: 3600,
					batteryDeviceTimeout: 7200,
				},
			}),
		};

		const mockCoreConnectivityService = {
			setConnectionState: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ZhDeviceConnectivityService,
				{ provide: ZigbeeHerdsmanAdapterService, useValue: mockAdapterService },
				{ provide: DevicesService, useValue: mockDevicesService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: CoreDeviceConnectivityService, useValue: mockCoreConnectivityService },
			],
		}).compile();

		service = module.get<ZhDeviceConnectivityService>(ZhDeviceConnectivityService);
		adapterService = module.get(ZigbeeHerdsmanAdapterService);
	});

	afterEach(() => {
		service.stopMonitoring();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('checkConnectivity', () => {
		it('should handle empty device list', async () => {
			adapterService.getDiscoveredDevices.mockReturnValue([]);
			await expect(service.checkConnectivity()).resolves.toBeUndefined();
		});

		it('should skip devices without lastSeen', async () => {
			adapterService.getDiscoveredDevices.mockReturnValue([
				{
					ieeeAddress: '0x001',
					networkAddress: 1,
					friendlyName: 'Test',
					type: 'EndDevice',
					manufacturerName: null,
					modelId: null,
					dateCode: null,
					softwareBuildId: null,
					interviewStatus: 'completed',
					definition: null,
					powerSource: null,
					lastSeen: null,
					available: true,
				},
			]);

			await service.checkConnectivity();
			// Should not throw, device skipped
		});
	});

	describe('monitoring lifecycle', () => {
		it('should start and stop monitoring without error', () => {
			service.startMonitoring();
			expect(() => service.stopMonitoring()).not.toThrow();
		});

		it('should handle multiple start calls', () => {
			service.startMonitoring();
			service.startMonitoring(); // Should not create duplicate intervals
			service.stopMonitoring();
		});
	});
});
