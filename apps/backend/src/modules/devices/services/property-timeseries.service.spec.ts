import { Test, TestingModule } from '@nestjs/testing';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { PropertyTimeseriesService } from './property-timeseries.service';

describe('PropertyTimeseriesService', () => {
	let service: PropertyTimeseriesService;
	let influxDbService: jest.Mocked<InfluxDbService>;

	const mockProperty: ChannelPropertyEntity = {
		id: 'prop-123',
		dataType: DataTypeType.FLOAT,
	} as ChannelPropertyEntity;

	beforeEach(async () => {
		jest.useFakeTimers().setSystemTime(new Date('2025-01-02T00:00:00Z'));

		const mockInfluxDb = {
			query: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PropertyTimeseriesService,
				{
					provide: InfluxDbService,
					useValue: mockInfluxDb,
				},
			],
		}).compile();

		service = module.get<PropertyTimeseriesService>(PropertyTimeseriesService);
		influxDbService = module.get(InfluxDbService);
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
	});

	describe('queryTimeseries', () => {
		it('should return timeseries data with points', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T22:00:00Z');

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([
				{
					time: { _nanoISO: '2025-01-01T10:00:00Z' },
					numberValue: 21.4,
					propertyId: 'prop-123',
				},
				{
					time: { _nanoISO: '2025-01-01T10:05:00Z' },
					numberValue: 21.6,
					propertyId: 'prop-123',
				},
			]);

			const result = await service.queryTimeseries(mockProperty, from, to, '5m');

			expect(result).toEqual({
				property: 'prop-123',
				from: '2025-01-01T10:00:00.000Z',
				to: '2025-01-01T22:00:00.000Z',
				bucket: '5m',
				points: [
					{ time: '2025-01-01T10:00:00Z', value: 21.4 },
					{ time: '2025-01-01T10:05:00Z', value: 21.6 },
				],
			});

			expect(influxDbService.query).toHaveBeenCalledWith(expect.stringContaining('property_value'));
			expect(influxDbService.query).toHaveBeenCalledWith(expect.stringContaining("propertyId = 'prop-123'"));
		});

		it('should return empty points array when no data exists', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T22:00:00Z');

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.queryTimeseries(mockProperty, from, to);

			expect(result.points).toEqual([]);
			expect(result.property).toBe('prop-123');
		});

		it('should use default bucket when not specified', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T22:00:00Z'); // 12 hour range

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.queryTimeseries(mockProperty, from, to);

			// 12 hours should default to '5m' bucket
			expect(result.bucket).toBe('5m');
		});

		it('should handle boolean data type', async () => {
			const boolProperty: ChannelPropertyEntity = {
				id: 'prop-bool',
				dataType: DataTypeType.BOOL,
			} as ChannelPropertyEntity;

			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T11:00:00Z');

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([
				{
					time: { _nanoISO: '2025-01-01T10:00:00Z' },
					stringValue: 'true',
					propertyId: 'prop-bool',
				},
				{
					time: { _nanoISO: '2025-01-01T10:30:00Z' },
					stringValue: 'false',
					propertyId: 'prop-bool',
				},
			]);

			const result = await service.queryTimeseries(boolProperty, from, to);

			expect(result.points).toEqual([
				{ time: '2025-01-01T10:00:00Z', value: true },
				{ time: '2025-01-01T10:30:00Z', value: false },
			]);
		});

		it('should handle string data type', async () => {
			const stringProperty: ChannelPropertyEntity = {
				id: 'prop-string',
				dataType: DataTypeType.STRING,
			} as ChannelPropertyEntity;

			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T11:00:00Z');

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([
				{
					time: { _nanoISO: '2025-01-01T10:00:00Z' },
					stringValue: 'active',
					propertyId: 'prop-string',
				},
			]);

			const result = await service.queryTimeseries(stringProperty, from, to);

			expect(result.points).toEqual([{ time: '2025-01-01T10:00:00Z', value: 'active' }]);
		});

		it('should handle integer data type with rounding', async () => {
			const intProperty: ChannelPropertyEntity = {
				id: 'prop-int',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;

			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T11:00:00Z');

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([
				{
					time: { _nanoISO: '2025-01-01T10:00:00Z' },
					numberValue: 42.7,
					propertyId: 'prop-int',
				},
			]);

			const result = await service.queryTimeseries(intProperty, from, to);

			expect(result.points).toEqual([{ time: '2025-01-01T10:00:00Z', value: 43 }]);
		});

		it('should return empty points on query error', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T22:00:00Z');

			influxDbService.query.mockRejectedValue(new Error('InfluxDB connection failed'));

			const result = await service.queryTimeseries(mockProperty, from, to);

			expect(result.points).toEqual([]);
			expect(result.property).toBe('prop-123');
		});

		it('should use raw data for short time ranges (< 1 hour)', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T10:30:00Z'); // 30 minutes

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			await service.queryTimeseries(mockProperty, from, to);

			const query = influxDbService.query.mock.calls[0][0];

			expect(query).toContain('SELECT stringValue, numberValue');
			expect(query).not.toContain('GROUP BY');
		});

		it('should use 1m bucket for ranges up to 6 hours', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T14:00:00Z'); // 4 hours

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.queryTimeseries(mockProperty, from, to);

			expect(result.bucket).toBe('1m');

			const query = influxDbService.query.mock.calls[0][0];

			expect(query).toContain('GROUP BY time(1m)');
		});

		it('should use 5m bucket for ranges up to 24 hours', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T22:00:00Z'); // 12 hours

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.queryTimeseries(mockProperty, from, to);

			expect(result.bucket).toBe('5m');
		});

		it('should use 15m bucket for ranges up to 7 days', async () => {
			const from = new Date('2025-01-01T00:00:00Z');
			const to = new Date('2025-01-03T00:00:00Z'); // 2 days

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.queryTimeseries(mockProperty, from, to);

			expect(result.bucket).toBe('15m');
		});

		it('should use 1h bucket for ranges longer than 7 days', async () => {
			const from = new Date('2025-01-01T00:00:00Z');
			const to = new Date('2025-01-15T00:00:00Z'); // 14 days

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.queryTimeseries(mockProperty, from, to);

			expect(result.bucket).toBe('1h');
		});

		it('should override default bucket when explicitly provided', async () => {
			const from = new Date('2025-01-01T10:00:00Z');
			const to = new Date('2025-01-01T22:00:00Z'); // would default to 5m

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.queryTimeseries(mockProperty, from, to, '15m');

			expect(result.bucket).toBe('15m');

			const query = influxDbService.query.mock.calls[0][0];

			expect(query).toContain('GROUP BY time(15m)');
		});
	});
});
