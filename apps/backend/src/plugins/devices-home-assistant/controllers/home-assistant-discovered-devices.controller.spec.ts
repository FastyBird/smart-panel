import { Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { AdoptDeviceRequestDto, MappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';
import { MappingPreviewModel } from '../models/mapping-preview.model';
import { DeviceAdoptionService } from '../services/device-adoption.service';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';
import { MappingPreviewService } from '../services/mapping-preview.service';

import { HomeAssistantDiscoveredDevicesController } from './home-assistant-discovered-devices.controller';

describe('HomeAssistantDiscoveredDevicesController', () => {
	let controller: HomeAssistantDiscoveredDevicesController;
	let homeAssistantHttpService: jest.Mocked<HomeAssistantHttpService>;
	let mappingPreviewService: jest.Mocked<MappingPreviewService>;
	let deviceAdoptionService: jest.Mocked<DeviceAdoptionService>;

	const mockMappingPreviewResponse: MappingPreviewModel = {
		haDevice: {
			id: 'device123',
			name: 'Test Light',
			manufacturer: 'Test',
			model: 'Test Model',
		},
		suggestedDevice: {
			category: DeviceCategory.LIGHTING,
			name: 'Test Light',
			confidence: 'high',
		},
		entities: [],
		warnings: [],
		readyToAdopt: true,
	};

	const mockAdoptedDevice: Partial<HomeAssistantDeviceEntity> = {
		id: 'uuid-device-123',
		type: 'devices-home-assistant',
		category: DeviceCategory.LIGHTING,
		name: 'Test Light',
		haDeviceId: 'device123',
	};

	beforeEach(async () => {
		const homeAssistantHttpServiceMock: Partial<jest.Mocked<HomeAssistantHttpService>> = {
			getDiscoveredDevices: jest.fn(),
			getDiscoveredDevice: jest.fn(),
		};

		const mappingPreviewServiceMock: Partial<jest.Mocked<MappingPreviewService>> = {
			generatePreview: jest.fn(),
		};

		const deviceAdoptionServiceMock: Partial<jest.Mocked<DeviceAdoptionService>> = {
			adoptDevice: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [HomeAssistantDiscoveredDevicesController],
			providers: [
				{ provide: HomeAssistantHttpService, useValue: homeAssistantHttpServiceMock },
				{ provide: MappingPreviewService, useValue: mappingPreviewServiceMock },
				{ provide: DeviceAdoptionService, useValue: deviceAdoptionServiceMock },
			],
		}).compile();

		controller = module.get(HomeAssistantDiscoveredDevicesController);
		homeAssistantHttpService = module.get(HomeAssistantHttpService);
		mappingPreviewService = module.get(MappingPreviewService);
		deviceAdoptionService = module.get(DeviceAdoptionService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('findAll', () => {
		it('should return a list of devices', async () => {
			const mockDevices = [{ id: 'device1', name: 'Device 1', entities: [], states: [], adoptedDeviceId: null }];
			homeAssistantHttpService.getDiscoveredDevices.mockResolvedValue(mockDevices);

			const result = await controller.findAll();
			expect(result.data).toEqual(mockDevices);
		});

		it('should throw UnprocessableEntityException if plugin misconfigured', async () => {
			homeAssistantHttpService.getDiscoveredDevices.mockRejectedValue(
				new DevicesHomeAssistantValidationException('bad config'),
			);

			await expect(controller.findAll()).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException if data not found', async () => {
			homeAssistantHttpService.getDiscoveredDevices.mockRejectedValue(
				new DevicesHomeAssistantNotFoundException('not found'),
			);

			await expect(controller.findAll()).rejects.toThrow(NotFoundException);
		});
	});

	describe('findOne', () => {
		it('should return a single device', async () => {
			const mockDevice = { id: 'device1', name: 'Device 1', entities: [], states: [], adoptedDeviceId: null };
			homeAssistantHttpService.getDiscoveredDevice.mockResolvedValue(mockDevice);

			const result = await controller.findOne('device1');
			expect(result.data).toEqual(mockDevice);
		});

		it('should throw UnprocessableEntityException if plugin misconfigured', async () => {
			homeAssistantHttpService.getDiscoveredDevice.mockRejectedValue(
				new DevicesHomeAssistantValidationException('bad config'),
			);

			await expect(controller.findOne('device1')).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException if device not found', async () => {
			homeAssistantHttpService.getDiscoveredDevice.mockRejectedValue(
				new DevicesHomeAssistantNotFoundException('not found'),
			);

			await expect(controller.findOne('device1')).rejects.toThrow(NotFoundException);
		});
	});

	describe('previewMapping', () => {
		it('should return a mapping preview', async () => {
			mappingPreviewService.generatePreview.mockResolvedValue(mockMappingPreviewResponse);

			const result = await controller.previewMapping('device123');

			expect(result.data).toEqual(mockMappingPreviewResponse);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mappingPreviewService.generatePreview).toHaveBeenCalledWith('device123', undefined);
		});

		it('should pass request options to the service', async () => {
			mappingPreviewService.generatePreview.mockResolvedValue(mockMappingPreviewResponse);

			const request: MappingPreviewRequestDto = {
				deviceCategory: DeviceCategory.GENERIC,
			};

			await controller.previewMapping('device123', request);

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mappingPreviewService.generatePreview).toHaveBeenCalledWith('device123', expect.any(Object));
		});

		it('should throw UnprocessableEntityException if plugin misconfigured', async () => {
			mappingPreviewService.generatePreview.mockRejectedValue(
				new DevicesHomeAssistantValidationException('bad config'),
			);

			await expect(controller.previewMapping('device123')).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException if device not found', async () => {
			mappingPreviewService.generatePreview.mockRejectedValue(new DevicesHomeAssistantNotFoundException('not found'));

			await expect(controller.previewMapping('device123')).rejects.toThrow(NotFoundException);
		});
	});

	describe('adoptDevice', () => {
		it('should adopt a device successfully', async () => {
			deviceAdoptionService.adoptDevice.mockResolvedValue(mockAdoptedDevice as HomeAssistantDeviceEntity);

			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'device123',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [
					{
						entityId: 'light.test',
						category: ChannelCategory.LIGHT,
						name: 'Light',
						properties: [
							{
								category: PropertyCategory.ON,
								haAttribute: 'fb.main_state',
								dataType: DataTypeType.BOOL,
								permissions: [PermissionType.READ_WRITE],
							},
						],
					},
				],
			};

			const result = await controller.adoptDevice(request);

			expect(result.data).toEqual(mockAdoptedDevice);
		});

		it('should throw UnprocessableEntityException if validation fails', async () => {
			deviceAdoptionService.adoptDevice.mockRejectedValue(
				new DevicesHomeAssistantValidationException('validation error'),
			);

			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'device123',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [],
			};

			await expect(controller.adoptDevice(request)).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException if HA device not found', async () => {
			deviceAdoptionService.adoptDevice.mockRejectedValue(new DevicesHomeAssistantNotFoundException('not found'));

			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'nonexistent',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [],
			};

			await expect(controller.adoptDevice(request)).rejects.toThrow(NotFoundException);
		});

		it('should throw UnprocessableEntityException for general HA exceptions', async () => {
			deviceAdoptionService.adoptDevice.mockRejectedValue(new DevicesHomeAssistantException('general error'));

			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'device123',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [],
			};

			await expect(controller.adoptDevice(request)).rejects.toThrow(UnprocessableEntityException);
		});
	});
});
