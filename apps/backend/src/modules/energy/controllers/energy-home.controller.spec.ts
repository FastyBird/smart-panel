import { Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { DEFAULT_CACHE_TTL_SECONDS } from '../energy.constants';
import { EnergyCacheService } from '../services/energy-cache.service';
import { EnergyDataService, SpaceEnergySummary, TimeseriesPoint } from '../services/energy-data.service';

import { EnergyHomeController } from './energy-home.controller';

describe('EnergyHomeController', () => {
	let controller: EnergyHomeController;
	let dataService: Partial<EnergyDataService>;
	let cacheService: EnergyCacheService;
	let configService: Partial<ConfigService>;

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({ cacheTtlSeconds: DEFAULT_CACHE_TTL_SECONDS }),
		};
		cacheService = new EnergyCacheService(configService as ConfigService);

		dataService = {
			getSpaceSummary: jest.fn(),
			getSpaceTimeseries: jest.fn(),
			getSpaceBreakdown: jest.fn(),
		};

		controller = new EnergyHomeController(dataService as EnergyDataService, cacheService);

		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		cacheService.clear();
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	describe('getHomeSummary', () => {
		const mockSummary: SpaceEnergySummary = {
			totalConsumptionKwh: 12.5,
			totalProductionKwh: 3.0,
			totalGridImportKwh: 8.0,
			totalGridExportKwh: 1.5,
			netKwh: 9.5,
			netGridKwh: 6.5,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-02-09T12:05:00.000Z',
		};

		it('should return home summary with correct fields', async () => {
			(dataService.getSpaceSummary as jest.Mock).mockResolvedValue(mockSummary);

			const response = await controller.getHomeSummary('today');

			expect(response.data.totalConsumptionKwh).toBe(12.5);
			expect(response.data.totalProductionKwh).toBe(3.0);
			expect(response.data.totalGridImportKwh).toBe(8.0);
			expect(response.data.totalGridExportKwh).toBe(1.5);
			expect(response.data.netKwh).toBe(9.5);
			expect(response.data.netGridKwh).toBe(6.5);
			expect(response.data.hasGridMetrics).toBe(true);
			expect(response.data.range).toBe('today');
			expect(response.data.lastUpdatedAt).toBe('2026-02-09T12:05:00.000Z');
		});

		it('should call data service with spaceId "home"', async () => {
			(dataService.getSpaceSummary as jest.Mock).mockResolvedValue(mockSummary);

			await controller.getHomeSummary('today');

			expect(dataService.getSpaceSummary).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'home');
		});

		it('should cache the result and return cached on second call', async () => {
			(dataService.getSpaceSummary as jest.Mock).mockResolvedValue(mockSummary);

			const result1 = await controller.getHomeSummary('today');
			const result2 = await controller.getHomeSummary('today');

			expect(result1.data.totalConsumptionKwh).toBe(12.5);
			expect(result2.data.totalConsumptionKwh).toBe(12.5);
			expect(dataService.getSpaceSummary).toHaveBeenCalledTimes(1);
		});

		it('should use separate cache keys for different ranges', async () => {
			const todaySummary = { ...mockSummary, totalConsumptionKwh: 10.0 };
			const weekSummary = { ...mockSummary, totalConsumptionKwh: 70.0 };

			(dataService.getSpaceSummary as jest.Mock).mockResolvedValueOnce(todaySummary).mockResolvedValueOnce(weekSummary);

			const todayResult = await controller.getHomeSummary('today');
			const weekResult = await controller.getHomeSummary('week');

			expect(todayResult.data.totalConsumptionKwh).toBe(10.0);
			expect(weekResult.data.totalConsumptionKwh).toBe(70.0);
			expect(dataService.getSpaceSummary).toHaveBeenCalledTimes(2);
		});

		it('should default to "today" when no range is provided', async () => {
			(dataService.getSpaceSummary as jest.Mock).mockResolvedValue(mockSummary);

			const response = await controller.getHomeSummary();

			expect(response.data.range).toBe('today');
		});

		it('should throw BadRequestException for invalid range', async () => {
			await expect(controller.getHomeSummary('invalid')).rejects.toThrow('Invalid range "invalid"');
		});
	});

	describe('getHomeTimeseries', () => {
		const mockPoints: TimeseriesPoint[] = [
			{
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T11:00:00.000Z',
				consumptionDeltaKwh: 1.5,
				productionDeltaKwh: 0.5,
				gridImportDeltaKwh: 1.0,
				gridExportDeltaKwh: 0.2,
			},
			{
				intervalStart: '2026-02-09T11:00:00.000Z',
				intervalEnd: '2026-02-09T12:00:00.000Z',
				consumptionDeltaKwh: 2.0,
				productionDeltaKwh: 0.8,
				gridImportDeltaKwh: 1.2,
				gridExportDeltaKwh: 0.3,
			},
		];

		it('should return timeseries data points', async () => {
			(dataService.getSpaceTimeseries as jest.Mock).mockResolvedValue(mockPoints);

			const response = await controller.getHomeTimeseries('today', '1h');

			expect(response.data).toHaveLength(2);
			expect(response.data[0].consumptionDeltaKwh).toBe(1.5);
			expect(response.data[1].consumptionDeltaKwh).toBe(2.0);
		});

		it('should cache timeseries results', async () => {
			(dataService.getSpaceTimeseries as jest.Mock).mockResolvedValue(mockPoints);

			await controller.getHomeTimeseries('today', '1h');
			await controller.getHomeTimeseries('today', '1h');

			expect(dataService.getSpaceTimeseries).toHaveBeenCalledTimes(1);
		});

		it('should use different cache keys for different intervals', async () => {
			(dataService.getSpaceTimeseries as jest.Mock).mockResolvedValue(mockPoints);

			await controller.getHomeTimeseries('today', '1h');
			await controller.getHomeTimeseries('today', '5m');

			expect(dataService.getSpaceTimeseries).toHaveBeenCalledTimes(2);
		});
	});

	describe('getHomeBreakdown', () => {
		it('should return breakdown items', async () => {
			const mockBreakdown = [
				{ deviceId: 'dev-1', deviceName: 'Oven', roomId: 'room-1', roomName: 'Kitchen', consumptionKwh: 5.0 },
				{ deviceId: 'dev-2', deviceName: 'TV', roomId: 'room-2', roomName: 'Living Room', consumptionKwh: 3.0 },
			];

			(dataService.getSpaceBreakdown as jest.Mock).mockResolvedValue(mockBreakdown);

			const response = await controller.getHomeBreakdown('today');

			expect(response.data).toHaveLength(2);
			expect(response.data[0].deviceName).toBe('Oven');
			expect(response.data[0].consumptionKwh).toBe(5.0);
		});

		it('should call data service with spaceId "home"', async () => {
			(dataService.getSpaceBreakdown as jest.Mock).mockResolvedValue([]);

			await controller.getHomeBreakdown('today', '5');

			expect(dataService.getSpaceBreakdown).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'home', 5);
		});

		it('should default limit to 10', async () => {
			(dataService.getSpaceBreakdown as jest.Mock).mockResolvedValue([]);

			await controller.getHomeBreakdown('today');

			expect(dataService.getSpaceBreakdown).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'home', 10);
		});

		it('should clamp limit to valid range', async () => {
			(dataService.getSpaceBreakdown as jest.Mock).mockResolvedValue([]);

			await controller.getHomeBreakdown('today', '0');

			expect(dataService.getSpaceBreakdown).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'home', 1);
		});
	});
});
