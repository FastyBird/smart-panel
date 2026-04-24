import { Test, TestingModule } from '@nestjs/testing';

import { DevicesService } from '../../../modules/devices/services/devices.service';
import { INTERVIEW_STATUS } from '../devices-zigbee-herdsman.constants';

import { ZhMappingPreviewService } from './mapping-preview.service';
import { ZigbeeHerdsmanService } from './zigbee-herdsman.service';

describe('ZhMappingPreviewService', () => {
	let service: ZhMappingPreviewService;
	let zigbeeHerdsmanService: jest.Mocked<Partial<ZigbeeHerdsmanService>>;

	const mockDiscoveredDevice = {
		ieeeAddress: '0x00124b002216a490',
		networkAddress: 12345,
		friendlyName: 'WSDCGQ11LM_3039',
		type: 'EndDevice' as const,
		manufacturerName: 'Aqara',
		modelId: 'WSDCGQ11LM',
		dateCode: null,
		softwareBuildId: null,
		interviewStatus: INTERVIEW_STATUS.COMPLETED,
		definition: {
			model: 'WSDCGQ11LM',
			vendor: 'Aqara',
			description: 'Temperature and humidity sensor',
			exposes: [
				{ type: 'numeric', property: 'temperature', name: 'temperature', access: 5, unit: '°C' },
				{ type: 'numeric', property: 'humidity', name: 'humidity', access: 5, unit: '%' },
				{ type: 'numeric', property: 'pressure', name: 'pressure', access: 5, unit: 'hPa' },
				{ type: 'numeric', property: 'battery', name: 'battery', access: 5, unit: '%' },
				{ type: 'numeric', property: 'linkquality', name: 'linkquality', access: 1 },
			],
			fromZigbee: [],
			toZigbee: [],
		},
		powerSource: 'Battery',
		lastSeen: new Date(),
		available: true,
	};

	beforeEach(async () => {
		zigbeeHerdsmanService = {
			isCoordinatorOnline: jest.fn().mockReturnValue(true),
			getDiscoveredDevice: jest.fn().mockReturnValue(mockDiscoveredDevice),
		};

		const mockDevicesService = {
			findAll: jest.fn().mockResolvedValue([]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ZhMappingPreviewService,
				{ provide: ZigbeeHerdsmanService, useValue: zigbeeHerdsmanService },
				{ provide: DevicesService, useValue: mockDevicesService },
			],
		}).compile();

		service = module.get<ZhMappingPreviewService>(ZhMappingPreviewService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('generatePreview', () => {
		it('should generate preview for temperature sensor', async () => {
			const preview = await service.generatePreview('0x00124b002216a490');

			expect(preview).toBeDefined();
			expect(preview.zhDevice.ieeeAddress).toBe('0x00124b002216a490');
			expect(preview.suggestedDevice.category).toBe('sensor');
			expect(preview.exposes.length).toBeGreaterThan(0);
			expect(preview.readyToAdopt).toBe(true);
		});

		it('should map temperature expose correctly', async () => {
			const preview = await service.generatePreview('0x00124b002216a490');

			const tempExpose = preview.exposes.find((e) => e.exposeName === 'temperature');
			expect(tempExpose).toBeDefined();
			expect(tempExpose.status).toBe('mapped');
			expect(tempExpose.suggestedChannel).toBeDefined();
			expect(tempExpose.suggestedChannel.category).toBe('temperature');
		});

		it('should throw when coordinator offline', async () => {
			zigbeeHerdsmanService.isCoordinatorOnline.mockReturnValue(false);

			await expect(service.generatePreview('0x00124b002216a490')).rejects.toThrow();
		});

		it('should throw when device not found', async () => {
			zigbeeHerdsmanService.getDiscoveredDevice.mockReturnValue(undefined);

			await expect(service.generatePreview('0xNONEXISTENT')).rejects.toThrow();
		});

		it('should handle expose override to skip', async () => {
			const preview = await service.generatePreview('0x00124b002216a490', {
				exposeOverrides: [{ exposeName: 'linkquality', skip: true }],
			});

			const lqExpose = preview.exposes.find((e) => e.exposeName === 'linkquality');
			expect(lqExpose).toBeDefined();
			expect(lqExpose.status).toBe('skipped');
		});
	});
});
