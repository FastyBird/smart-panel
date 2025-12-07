import { useContainer } from 'class-validator';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { AdoptDeviceRequestDto } from '../dto/mapping-preview.dto';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';

import { DeviceAdoptionService } from './device-adoption.service';
import { HomeAssistantWsService } from './home-assistant.ws.service';

describe('DeviceAdoptionService', () => {
	let service: DeviceAdoptionService;
	let homeAssistantWsService: jest.Mocked<HomeAssistantWsService>;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;

	const mockDeviceRegistry = [
		{
			id: 'device123',
			name: 'Test Light',
			nameByUser: null,
			manufacturer: 'Test Manufacturer',
			model: 'Test Model',
			serialNumber: 'SN123',
			swVersion: '1.0.0',
			hwVersion: '1.0',
			modelId: null,
			areaId: null,
			connections: [['mac', 'aa:bb:cc:dd:ee:ff']] as [string, string][],
			createdAt: new Date(),
			modifiedAt: new Date(),
		},
	];

	const mockCreatedDevice: Partial<HomeAssistantDeviceEntity> = {
		id: 'uuid-device-123',
		type: 'devices-home-assistant',
		category: DeviceCategory.LIGHTING,
		name: 'Test Light',
		haDeviceId: 'device123',
	};

	beforeEach(async () => {
		const homeAssistantWsServiceMock: Partial<jest.Mocked<HomeAssistantWsService>> = {
			getDevicesRegistry: jest.fn(),
		};

		const devicesServiceMock: Partial<jest.Mocked<DevicesService>> = {
			findAll: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			remove: jest.fn(),
		};

		const channelsServiceMock: Partial<jest.Mocked<ChannelsService>> = {
			create: jest.fn(),
		};

		// Mock the device exists validator
		const deviceExistsValidatorMock: Partial<jest.Mocked<DeviceExistsConstraintValidator>> = {
			validate: jest.fn().mockResolvedValue(true),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DeviceAdoptionService,
				{ provide: HomeAssistantWsService, useValue: homeAssistantWsServiceMock },
				{ provide: DevicesService, useValue: devicesServiceMock },
				{ provide: ChannelsService, useValue: channelsServiceMock },
				{ provide: DeviceExistsConstraintValidator, useValue: deviceExistsValidatorMock },
			],
		}).compile();

		// Use container so validators can access module's DI
		useContainer(module, { fallbackOnErrors: true });

		service = module.get(DeviceAdoptionService);
		homeAssistantWsService = module.get(HomeAssistantWsService);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);

		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('adoptDevice', () => {
		it('should adopt a Home Assistant device successfully', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDeviceRegistry);
			devicesService.findAll.mockResolvedValue([]);
			devicesService.create.mockResolvedValue(mockCreatedDevice as HomeAssistantDeviceEntity);
			devicesService.findOne.mockResolvedValue(mockCreatedDevice as HomeAssistantDeviceEntity);
			channelsService.create.mockResolvedValue({} as never);

			// Empty channels to avoid validation complexity in unit test
			// The createChannel validation is tested separately
			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'device123',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [],
			};

			const result = await service.adoptDevice(request);

			expect(result).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(devicesService.create).toHaveBeenCalled();
			// Only device_information channel (auto-created)
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(channelsService.create).toHaveBeenCalledTimes(1);
		});

		it('should throw DevicesHomeAssistantNotFoundException if HA device not found', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue([]);

			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'nonexistent',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [],
			};

			await expect(service.adoptDevice(request)).rejects.toThrow(DevicesHomeAssistantNotFoundException);
		});

		it('should throw DevicesHomeAssistantValidationException if device already adopted', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDeviceRegistry);
			devicesService.findAll.mockResolvedValue([
				{
					...mockCreatedDevice,
					haDeviceId: 'device123',
				} as HomeAssistantDeviceEntity,
			]);

			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'device123',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [],
			};

			await expect(service.adoptDevice(request)).rejects.toThrow(DevicesHomeAssistantValidationException);
		});

		it('should cleanup device if channel creation fails', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDeviceRegistry);
			devicesService.findAll.mockResolvedValue([]);
			devicesService.create.mockResolvedValue(mockCreatedDevice as HomeAssistantDeviceEntity);
			devicesService.remove.mockResolvedValue(undefined);
			channelsService.create.mockRejectedValue(new Error('Channel creation failed'));

			const request: AdoptDeviceRequestDto = {
				haDeviceId: 'device123',
				name: 'Test Light',
				category: DeviceCategory.LIGHTING,
				channels: [],
			};

			await expect(service.adoptDevice(request)).rejects.toThrow();
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(devicesService.remove).toHaveBeenCalledWith('uuid-device-123');
		});
	});
});
