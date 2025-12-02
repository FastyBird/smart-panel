import { Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

import { HomeAssistantDiscoveredDevicesController } from './home-assistant-discovered-devices.controller';

describe('HomeAssistantDiscoveredDevicesController', () => {
	let controller: HomeAssistantDiscoveredDevicesController;
	let homeAssistantHttpService: jest.Mocked<HomeAssistantHttpService>;

	beforeEach(async () => {
		const homeAssistantHttpServiceMock: Partial<jest.Mocked<HomeAssistantHttpService>> = {
			getDiscoveredDevices: jest.fn(),
			getDiscoveredDevice: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [HomeAssistantDiscoveredDevicesController],
			providers: [{ provide: HomeAssistantHttpService, useValue: homeAssistantHttpServiceMock }],
		}).compile();

		controller = module.get(HomeAssistantDiscoveredDevicesController);
		homeAssistantHttpService = module.get(HomeAssistantHttpService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
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
});
