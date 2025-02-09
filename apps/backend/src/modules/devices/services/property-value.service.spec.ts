/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-assignment
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Cache } from 'cache-manager';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DataTypeEnum } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { PropertyValueService } from './property-value.service';

describe('PropertyValueService', () => {
	let service: PropertyValueService;
	let influxDbService: jest.Mocked<InfluxDbService>;
	let cacheManager: jest.Mocked<Cache>;

	beforeEach(async () => {
		const mockInfluxDbService = {
			writePoints: jest.fn(),
			query: jest.fn(),
		};

		const mockCacheManager = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PropertyValueService,
				{
					provide: InfluxDbService,
					useValue: mockInfluxDbService,
				},
				{
					provide: CACHE_MANAGER,
					useValue: mockCacheManager,
				},
			],
		}).compile();

		service = module.get<PropertyValueService>(PropertyValueService);
		influxDbService = module.get<InfluxDbService>(InfluxDbService) as jest.Mocked<InfluxDbService>;
		cacheManager = module.get<Cache>(CACHE_MANAGER) as jest.Mocked<Cache>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('write', () => {
		it('should write a string value to InfluxDB and cache', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeEnum.STRING,
			} as ChannelPropertyEntity;

			await service.write(property, 'test-value');

			expect(influxDbService.writePoints).toHaveBeenCalledWith([
				{
					measurement: 'property_value',
					tags: { propertyId: property.id },
					fields: { stringValue: 'test-value' },
					timestamp: expect.any(Date),
				},
			]);

			expect(cacheManager.set).toHaveBeenCalledWith('property:test-property-id:value', 'test-value', 30000);
		});

		it('should log an error when an unsupported data type is used', async () => {
			const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: 'unsupported_type' as DataTypeEnum,
			} as ChannelPropertyEntity;

			await service.write(property, 'value');

			expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[PROPERTY] Unsupported data type'));
		});
	});

	describe('readLatest', () => {
		it('should return cached value if available', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeEnum.INT,
			} as ChannelPropertyEntity;

			cacheManager.get.mockResolvedValue(42);

			const result = await service.readLatest(property);

			expect(result).toBe(42);
			expect(cacheManager.get).toHaveBeenCalledWith('property:test-property-id:value');
			expect(influxDbService.query).not.toHaveBeenCalled();
		});

		it('should query InfluxDB if cached value is missing', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeEnum.INT,
			} as ChannelPropertyEntity;

			cacheManager.get.mockResolvedValue(null);
			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([{ numberValue: 100 }]);

			const result = await service.readLatest(property);

			expect(result).toBe(100);
			expect(influxDbService.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM property_value'));
			expect(cacheManager.set).toHaveBeenCalledWith('property:test-property-id:value', 100, 30000);
		});

		it('should return null if no value is found in InfluxDB', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeEnum.STRING,
			} as ChannelPropertyEntity;

			cacheManager.get.mockResolvedValue(null);
			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([]);

			const result = await service.readLatest(property);

			expect(result).toBeNull();
			expect(influxDbService.query).toHaveBeenCalled();
		});
	});

	describe('delete', () => {
		it('should delete property data from InfluxDB and cache', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
			} as ChannelPropertyEntity;

			await service.delete(property);

			expect(influxDbService.query).toHaveBeenCalledWith(
				"DELETE FROM property_value WHERE propertyId = 'test-property-id'",
			);
			expect(cacheManager.del).toHaveBeenCalledWith('property:test-property-id:value');
		});
	});
});
