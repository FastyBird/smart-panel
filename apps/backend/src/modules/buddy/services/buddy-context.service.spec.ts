/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { IntentType } from '../../intents/intents.constants';

import { ActionObserverService } from './action-observer.service';
import { BuddyContextService } from './buddy-context.service';

describe('BuddyContextService', () => {
	let service: BuddyContextService;
	let spacesService: Record<string, jest.Mock>;
	let devicesService: Record<string, jest.Mock>;
	let scenesService: Record<string, jest.Mock>;
	let weatherService: Record<string, jest.Mock>;
	let energyDataService: Record<string, jest.Mock>;
	let actionObserver: ActionObserverService;

	beforeEach(() => {
		spacesService = {
			findAll: jest.fn().mockResolvedValue([
				{ id: 'space-1', name: 'Living Room', category: 'living_room' },
				{ id: 'space-2', name: 'Bedroom', category: 'bedroom' },
			]),
			findOne: jest.fn().mockResolvedValue({ id: 'space-1', name: 'Living Room', category: 'living_room' }),
			findDevicesBySpace: jest.fn().mockResolvedValue([]),
		};

		devicesService = {
			findAll: jest.fn().mockResolvedValue([
				{
					id: 'dev-1',
					name: 'Main Light',
					category: 'light',
					roomId: 'space-1',
					channels: [
						{
							id: 'ch-1',
							identifier: 'main',
							name: 'Main',
							properties: [
								{
									category: 'brightness',
									value: { value: 80 },
								},
							],
						},
					],
				},
			]),
		};

		scenesService = {
			findAll: jest.fn().mockResolvedValue([
				{ id: 'scene-1', name: 'Movie Night', primarySpaceId: 'space-1', enabled: true },
			]),
			findBySpace: jest.fn().mockResolvedValue([
				{ id: 'scene-1', name: 'Movie Night', primarySpaceId: 'space-1', enabled: true },
			]),
		};

		weatherService = {
			getPrimaryWeather: jest.fn().mockResolvedValue({
				current: {
					temperature: 22.5,
					humidity: 55,
					weather: { description: 'Partly cloudy' },
				},
			}),
		};

		energyDataService = {
			getSummary: jest.fn().mockResolvedValue({
				totalProductionKwh: 3.2,
				totalGridImportKwh: 1.5,
			}),
		};

		actionObserver = new ActionObserverService();

		service = new BuddyContextService(
			spacesService as any,
			devicesService as any,
			scenesService as any,
			weatherService as any,
			energyDataService as any,
			actionObserver,
		);
	});

	describe('buildContext', () => {
		it('should include spaces in context', async () => {
			const ctx = await service.buildContext();

			expect(ctx.spaces).toHaveLength(2);
			expect(ctx.spaces[0]).toEqual(
				expect.objectContaining({ id: 'space-1', name: 'Living Room', category: 'living_room' }),
			);
		});

		it('should include devices with state in context', async () => {
			const ctx = await service.buildContext();

			expect(ctx.devices).toHaveLength(1);
			expect(ctx.devices[0].name).toBe('Main Light');
			expect(ctx.devices[0].state['main.brightness']).toBe(80);
		});

		it('should include scenes in context', async () => {
			const ctx = await service.buildContext();

			expect(ctx.scenes).toHaveLength(1);
			expect(ctx.scenes[0]).toEqual(
				expect.objectContaining({ id: 'scene-1', name: 'Movie Night', enabled: true }),
			);
		});

		it('should include weather in context', async () => {
			const ctx = await service.buildContext();

			expect(ctx.weather).toEqual({
				temperature: 22.5,
				conditions: 'Partly cloudy',
				humidity: 55,
			});
		});

		it('should include energy in context', async () => {
			const ctx = await service.buildContext();

			expect(ctx.energy).toEqual({
				solarProduction: 3.2,
				gridConsumption: 1.5,
				batteryLevel: 0,
			});
		});

		it('should include recent intents in context', async () => {
			actionObserver.recordAction({
				intentId: 'i1',
				type: IntentType.LIGHT_TOGGLE,
				spaceId: 'space-1',
				deviceIds: ['dev-1'],
				timestamp: new Date(),
			});

			const ctx = await service.buildContext();

			expect(ctx.recentIntents).toHaveLength(1);
			expect(ctx.recentIntents[0].type).toBe(IntentType.LIGHT_TOGGLE);
			expect(ctx.recentIntents[0].space).toBe('space-1');
		});

		it('should include a timestamp', async () => {
			const ctx = await service.buildContext();

			expect(ctx.timestamp).toBeDefined();
			// Should be a valid ISO string
			expect(new Date(ctx.timestamp).toISOString()).toBe(ctx.timestamp);
		});
	});

	describe('buildContext with missing weather/energy', () => {
		it('should return null weather when weather service throws', async () => {
			weatherService.getPrimaryWeather.mockRejectedValue(new Error('No location configured'));

			const ctx = await service.buildContext();

			expect(ctx.weather).toBeNull();
		});

		it('should return null weather when weather service returns no current data', async () => {
			weatherService.getPrimaryWeather.mockResolvedValue({ current: null });

			const ctx = await service.buildContext();

			expect(ctx.weather).toBeNull();
		});

		it('should return null energy when energy service throws', async () => {
			energyDataService.getSummary.mockRejectedValue(new Error('No energy data'));

			const ctx = await service.buildContext();

			expect(ctx.energy).toBeNull();
		});

		it('should still return spaces and devices when weather/energy fail', async () => {
			weatherService.getPrimaryWeather.mockRejectedValue(new Error('fail'));
			energyDataService.getSummary.mockRejectedValue(new Error('fail'));

			const ctx = await service.buildContext();

			expect(ctx.spaces).toHaveLength(2);
			expect(ctx.devices).toHaveLength(1);
			expect(ctx.scenes).toHaveLength(1);
		});
	});

	describe('buildContext with space filter', () => {
		it('should return only the specified space when spaceId is provided', async () => {
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'dev-1',
					name: 'Main Light',
					category: 'light',
					roomId: 'space-1',
					channels: [],
				},
			]);

			const ctx = await service.buildContext('space-1');

			expect(ctx.spaces).toHaveLength(1);
			expect(ctx.spaces[0].id).toBe('space-1');
			expect(spacesService.findOne).toHaveBeenCalledWith('space-1');
		});

		it('should return only actions from the specified space', async () => {
			actionObserver.recordAction({
				intentId: 'i1',
				type: IntentType.LIGHT_TOGGLE,
				spaceId: 'space-1',
				deviceIds: ['dev-1'],
				timestamp: new Date(),
			});
			actionObserver.recordAction({
				intentId: 'i2',
				type: IntentType.LIGHT_TOGGLE,
				spaceId: 'space-2',
				deviceIds: ['dev-2'],
				timestamp: new Date(),
			});

			spacesService.findDevicesBySpace.mockResolvedValue([]);

			const ctx = await service.buildContext('space-1');

			expect(ctx.recentIntents).toHaveLength(1);
			expect(ctx.recentIntents[0].space).toBe('space-1');
		});

		it('should return empty spaces array when space not found', async () => {
			spacesService.findOne.mockResolvedValue(null);
			spacesService.findDevicesBySpace.mockResolvedValue([]);

			const ctx = await service.buildContext('nonexistent');

			expect(ctx.spaces).toHaveLength(0);
		});
	});

	describe('graceful error handling', () => {
		it('should return empty spaces when spaces service throws', async () => {
			spacesService.findAll.mockRejectedValue(new Error('DB error'));

			const ctx = await service.buildContext();

			expect(ctx.spaces).toEqual([]);
		});

		it('should return empty devices when devices service throws', async () => {
			devicesService.findAll.mockRejectedValue(new Error('DB error'));

			const ctx = await service.buildContext();

			expect(ctx.devices).toEqual([]);
		});

		it('should return empty scenes when scenes service throws', async () => {
			scenesService.findAll.mockRejectedValue(new Error('DB error'));

			const ctx = await service.buildContext();

			expect(ctx.scenes).toEqual([]);
		});
	});
});
