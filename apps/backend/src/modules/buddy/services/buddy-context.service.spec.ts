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

	const mockSunrise = new Date('2025-01-16T07:15:00Z');
	const mockSunset = new Date('2025-01-16T16:30:00Z');

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
			findAll: jest
				.fn()
				.mockResolvedValue([{ id: 'scene-1', name: 'Movie Night', primarySpaceId: 'space-1', enabled: true }]),
			findBySpace: jest
				.fn()
				.mockResolvedValue([{ id: 'scene-1', name: 'Movie Night', primarySpaceId: 'space-1', enabled: true }]),
		};

		weatherService = {
			getPrimaryWeather: jest.fn().mockResolvedValue({
				current: {
					temperature: 22.5,
					feelsLike: 21.0,
					humidity: 55,
					pressure: 1013,
					weather: { description: 'Partly cloudy' },
					wind: { speed: 3.5, deg: 250, gust: 5.2 },
					clouds: 40,
					rain: null,
					snow: null,
					sunrise: mockSunrise,
					sunset: mockSunset,
				},
				forecast: [
					{
						dayTime: new Date('2025-01-17T12:00:00Z'),
						temperature: { day: 12, min: 8, max: 15 },
						weather: { description: 'partly cloudy' },
						humidity: 60,
						wind: { speed: 4.2, deg: 180, gust: null },
						rain: null,
						snow: null,
					},
					{
						dayTime: new Date('2025-01-18T12:00:00Z'),
						temperature: { day: 10, min: 6, max: 12 },
						weather: { description: 'rain' },
						humidity: 75,
						wind: { speed: 5.1, deg: 200, gust: 7.0 },
						rain: 4.5,
						snow: null,
					},
					{
						dayTime: new Date('2025-01-19T12:00:00Z'),
						temperature: { day: 9, min: 5, max: 11 },
						weather: { description: 'cloudy' },
						humidity: 70,
						wind: { speed: 3.0, deg: 220, gust: null },
						rain: null,
						snow: null,
					},
					{
						dayTime: new Date('2025-01-20T12:00:00Z'),
						temperature: { day: 14, min: 8, max: 16 },
						weather: { description: 'clear' },
						humidity: 50,
						wind: { speed: 2.0, deg: 90, gust: null },
						rain: null,
						snow: null,
					},
				],
			}),
			getPrimaryLocationId: jest.fn().mockReturnValue('loc-1'),
			checkAlertsSupported: jest.fn().mockResolvedValue(false),
			getAlerts: jest.fn().mockResolvedValue([]),
		};

		energyDataService = {
			getDeltas: jest.fn().mockResolvedValue([
				{
					intervalStart: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
					intervalEnd: new Date().toISOString(),
					productionDeltaKwh: 0.4,
					gridImportDeltaKwh: 0.2,
					gridExportDeltaKwh: 0.1,
					consumptionDeltaKwh: 0.5,
				},
			]),
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
			expect(ctx.scenes[0]).toEqual(expect.objectContaining({ id: 'scene-1', name: 'Movie Night', enabled: true }));
		});

		it('should include weather with enriched current data', async () => {
			const ctx = await service.buildContext();

			expect(ctx.weather).not.toBeNull();
			expect(ctx.weather!.current).toEqual(
				expect.objectContaining({
					temperature: 22.5,
					feelsLike: 21.0,
					conditions: 'Partly cloudy',
					humidity: 55,
					pressure: 1013,
					clouds: 40,
				}),
			);
			expect(ctx.weather!.current.wind).toEqual({ speed: 3.5, deg: 250, gust: 5.2 });
			expect(ctx.weather!.current.sunrise).toBe(mockSunrise.toISOString());
			expect(ctx.weather!.current.sunset).toBe(mockSunset.toISOString());
		});

		it('should include energy in context with approximate kW rates from recent deltas', async () => {
			const ctx = await service.buildContext();

			// 5-min delta kWh × 12 = approximate kW
			expect(ctx.energy).toEqual({
				solarProduction: 0.4 * 12,
				gridConsumption: 0.2 * 12,
				gridExport: 0.1 * 12,
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

	describe('weather forecast', () => {
		it('should limit forecast to 3 days', async () => {
			const ctx = await service.buildContext();

			expect(ctx.weather!.forecast).toHaveLength(3);
		});

		it('should map forecast fields correctly', async () => {
			const ctx = await service.buildContext();

			expect(ctx.weather!.forecast[0]).toEqual(
				expect.objectContaining({
					tempDay: 12,
					tempMin: 8,
					tempMax: 15,
					conditions: 'partly cloudy',
					humidity: 60,
					wind: 4.2,
					rain: null,
				}),
			);
		});

		it('should include rain values in forecast when present', async () => {
			const ctx = await service.buildContext();

			expect(ctx.weather!.forecast[1].rain).toBe(4.5);
		});
	});

	describe('weather alerts', () => {
		it('should include alerts when supported', async () => {
			weatherService.checkAlertsSupported.mockResolvedValue(true);
			weatherService.getAlerts.mockResolvedValue([
				{
					event: 'Heat Advisory',
					start: new Date('2025-01-16T12:00:00Z'),
					end: new Date('2025-01-17T00:00:00Z'),
					description: 'High temperatures expected',
				},
			]);

			const ctx = await service.buildContext();

			expect(ctx.weather!.alerts).toHaveLength(1);
			expect(ctx.weather!.alerts[0]).toEqual(
				expect.objectContaining({
					event: 'Heat Advisory',
					description: 'High temperatures expected',
				}),
			);
		});

		it('should return empty alerts when not supported', async () => {
			weatherService.checkAlertsSupported.mockResolvedValue(false);

			const ctx = await service.buildContext();

			expect(ctx.weather!.alerts).toEqual([]);
			expect(weatherService.getAlerts).not.toHaveBeenCalled();
		});

		it('should truncate alert descriptions over 200 characters', async () => {
			weatherService.checkAlertsSupported.mockResolvedValue(true);

			const longDesc = 'A'.repeat(250);

			weatherService.getAlerts.mockResolvedValue([
				{
					event: 'Warning',
					start: new Date('2025-01-16T12:00:00Z'),
					end: new Date('2025-01-17T00:00:00Z'),
					description: longDesc,
				},
			]);

			const ctx = await service.buildContext();

			expect(ctx.weather!.alerts[0].description).toHaveLength(200);
			expect(ctx.weather!.alerts[0].description).toMatch(/\.\.\.$/);
		});

		it('should return empty alerts when getPrimaryLocationId returns null', async () => {
			weatherService.getPrimaryLocationId.mockReturnValue(null);

			const ctx = await service.buildContext();

			expect(ctx.weather!.alerts).toEqual([]);
		});

		it('should return empty alerts when getAlerts throws', async () => {
			weatherService.checkAlertsSupported.mockResolvedValue(true);
			weatherService.getAlerts.mockRejectedValue(new Error('Alerts failed'));

			const ctx = await service.buildContext();

			expect(ctx.weather!.alerts).toEqual([]);
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

		it('should return null energy when no recent deltas exist', async () => {
			energyDataService.getDeltas.mockResolvedValue([]);

			const ctx = await service.buildContext();

			expect(ctx.energy).toBeNull();
		});

		it('should return null energy when energy service throws', async () => {
			energyDataService.getDeltas.mockRejectedValue(new Error('No energy data'));

			const ctx = await service.buildContext();

			expect(ctx.energy).toBeNull();
		});

		it('should still return spaces and devices when weather/energy fail', async () => {
			weatherService.getPrimaryWeather.mockRejectedValue(new Error('fail'));
			energyDataService.getDeltas.mockRejectedValue(new Error('fail'));

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

	describe('context caching', () => {
		it('should return cached context on second call', async () => {
			const ctx1 = await service.buildContext();
			const ctx2 = await service.buildContext();

			expect(ctx1).toBe(ctx2);
			expect(spacesService.findAll).toHaveBeenCalledTimes(1);
		});

		it('should return fresh context after invalidateCache', async () => {
			const ctx1 = await service.buildContext();

			service.invalidateCache();

			const ctx2 = await service.buildContext();

			expect(ctx1).not.toBe(ctx2);
			expect(spacesService.findAll).toHaveBeenCalledTimes(2);
		});

		it('should cache separately per spaceId', async () => {
			spacesService.findDevicesBySpace.mockResolvedValue([]);

			await service.buildContext('space-1');
			await service.buildContext('space-2');

			expect(spacesService.findOne).toHaveBeenCalledTimes(2);
		});

		it('should not share cache between global and space-scoped calls', async () => {
			spacesService.findDevicesBySpace.mockResolvedValue([]);

			await service.buildContext();
			await service.buildContext('space-1');

			expect(spacesService.findAll).toHaveBeenCalledTimes(1);
			expect(spacesService.findOne).toHaveBeenCalledTimes(1);
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
