/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import {
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantEntityRegistryResultModel,
} from '../models/home-assistant.model';
import { HomeAssistantWsService } from '../services/home-assistant.ws.service';

import { HomeAssistantRegistryController } from './home-assistant-registry.controller';

describe('HomeAssistantRegistryController', () => {
	let controller: HomeAssistantRegistryController;
	let homeAssistantWsService: jest.Mocked<HomeAssistantWsService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [HomeAssistantRegistryController],
			providers: [
				{
					provide: HomeAssistantWsService,
					useValue: {
						getDevicesRegistry: jest.fn(),
						getEntitiesRegistry: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<HomeAssistantRegistryController>(HomeAssistantRegistryController);
		homeAssistantWsService = module.get(HomeAssistantWsService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('findAllDevices', () => {
		it('should return devices from the registry', async () => {
			const mockDevices: HomeAssistantDeviceRegistryResultModel[] = [
				{
					id: 'device1',
					name: 'Mock Device',
					manufacturer: 'Test',
					areaId: null,
				} as unknown as HomeAssistantDeviceRegistryResultModel,
			];

			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDevices);

			const result = await controller.findAllDevices();
			expect(result.data).toEqual(mockDevices);
			expect(homeAssistantWsService.getDevicesRegistry).toHaveBeenCalled();
		});

		it('should throw UnprocessableEntityException if plugin is misconfigured', async () => {
			homeAssistantWsService.getDevicesRegistry.mockRejectedValue(
				new DevicesHomeAssistantValidationException('Invalid config'),
			);

			await expect(controller.findAllDevices()).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException if data not found', async () => {
			homeAssistantWsService.getDevicesRegistry.mockRejectedValue(
				new DevicesHomeAssistantNotFoundException('Not found'),
			);

			await expect(controller.findAllDevices()).rejects.toThrow(NotFoundException);
		});

		it('should rethrow unexpected errors', async () => {
			homeAssistantWsService.getDevicesRegistry.mockRejectedValue(new Error('Unexpected'));

			await expect(controller.findAllDevices()).rejects.toThrow('Unexpected');
		});
	});

	describe('findAllEntities', () => {
		it('should return entities from the registry', async () => {
			const mockEntities: HomeAssistantEntityRegistryResultModel[] = [
				{
					id: 'entity1',
					entityId: 'sensor.temp',
					deviceId: 'device1',
					entityCategory: 'config',
					hasEntityName: true,
				} as unknown as HomeAssistantEntityRegistryResultModel,
			];

			homeAssistantWsService.getEntitiesRegistry.mockResolvedValue(mockEntities);

			const result = await controller.findAllEntities();
			expect(result.data).toEqual(mockEntities);
			expect(homeAssistantWsService.getEntitiesRegistry).toHaveBeenCalled();
		});

		it('should throw UnprocessableEntityException if plugin is misconfigured', async () => {
			homeAssistantWsService.getEntitiesRegistry.mockRejectedValue(
				new DevicesHomeAssistantValidationException('Invalid config'),
			);

			await expect(controller.findAllEntities()).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException if data not found', async () => {
			homeAssistantWsService.getEntitiesRegistry.mockRejectedValue(
				new DevicesHomeAssistantNotFoundException('Not found'),
			);

			await expect(controller.findAllEntities()).rejects.toThrow(NotFoundException);
		});

		it('should rethrow unexpected errors', async () => {
			homeAssistantWsService.getEntitiesRegistry.mockRejectedValue(new Error('Unexpected'));

			await expect(controller.findAllEntities()).rejects.toThrow('Unexpected');
		});
	});
});
