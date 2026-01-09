import { Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

import { HomeAssistantStatesController } from './home-assistant-states.controller';

describe('HomeAssistantStatesController', () => {
	let controller: HomeAssistantStatesController;
	let homeAssistantHttpService: jest.Mocked<HomeAssistantHttpService>;

	beforeEach(async () => {
		const homeAssistantHttpServiceMock: Partial<jest.Mocked<HomeAssistantHttpService>> = {
			getStates: jest.fn(),
			getState: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [HomeAssistantStatesController],
			providers: [{ provide: HomeAssistantHttpService, useValue: homeAssistantHttpServiceMock }],
		}).compile();

		controller = module.get(HomeAssistantStatesController);
		homeAssistantHttpService = module.get(HomeAssistantHttpService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('findAll', () => {
		it('should return list of states', async () => {
			const mockStates = [
				{
					entityId: 'sensor.temp',
					state: '21',
					attributes: {},
					lastChanged: new Date('2025-05-01'),
					lastUpdated: new Date('2025-05-01'),
					lastReported: new Date('2025-05-01'),
				},
			];
			homeAssistantHttpService.getStates.mockResolvedValue(mockStates);

			const result = await controller.findAll();
			expect(result.data).toEqual(mockStates);
		});

		it('should throw UnprocessableEntityException on validation error', async () => {
			homeAssistantHttpService.getStates.mockRejectedValue(new DevicesHomeAssistantValidationException('bad config'));

			await expect(controller.findAll()).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException on not found error', async () => {
			homeAssistantHttpService.getStates.mockRejectedValue(new DevicesHomeAssistantNotFoundException('not found'));

			await expect(controller.findAll()).rejects.toThrow(NotFoundException);
		});
	});

	describe('findOne', () => {
		it('should return single state', async () => {
			const mockState = {
				entityId: 'sensor.temp',
				state: '21',
				attributes: {},
				lastChanged: new Date('2025-05-01'),
				lastUpdated: new Date('2025-05-01'),
				lastReported: new Date('2025-05-01'),
			};
			homeAssistantHttpService.getState.mockResolvedValue(mockState);

			const result = await controller.findOne('sensor.temp');
			expect(result.data).toEqual(mockState);
		});

		it('should throw UnprocessableEntityException on validation error', async () => {
			homeAssistantHttpService.getState.mockRejectedValue(new DevicesHomeAssistantValidationException('bad config'));

			await expect(controller.findOne('sensor.temp')).rejects.toThrow(UnprocessableEntityException);
		});

		it('should throw NotFoundException on not found error', async () => {
			homeAssistantHttpService.getState.mockRejectedValue(new DevicesHomeAssistantNotFoundException('not found'));

			await expect(controller.findOne('sensor.temp')).rejects.toThrow(NotFoundException);
		});
	});
});
