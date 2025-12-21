/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-assignment
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { PropertyValueService } from './property-value.service';

describe('PropertyValueService', () => {
	let service: PropertyValueService;
	let influxDbService: jest.Mocked<InfluxDbService>;

	beforeEach(async () => {
		const mockInfluxDbService = {
			writePoints: jest.fn(),
			query: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PropertyValueService,
				{
					provide: InfluxDbService,
					useValue: mockInfluxDbService,
				},
			],
		}).compile();

		service = module.get<PropertyValueService>(PropertyValueService);
		influxDbService = module.get<InfluxDbService>(InfluxDbService) as jest.Mocked<InfluxDbService>;

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('write', () => {
		it('should write a string value to InfluxDB and cache', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.STRING,
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
		});

		it('should log an error when an unsupported data type is used', async () => {
			const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: 'unsupported_type' as DataTypeType,
			} as ChannelPropertyEntity;

			await service.write(property, 'value');

			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[PropertyValueService] Unsupported data type'),
				undefined,
				'devices-module',
			);
		});
	});

	describe('readLatest', () => {
		it('should return cached value if available', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;

			service['valuesMap'].set('test-property-id', 42);

			const result = await service.readLatest(property);

			expect(result).toBe(42);
			expect(influxDbService.query).not.toHaveBeenCalled();
		});

		it('should query InfluxDB if cached value is missing', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;

			// @ts-expect-error Expected query to return a resolved value, mocking for test
			influxDbService.query.mockResolvedValue([{ numberValue: 100 }]);

			const result = await service.readLatest(property);

			expect(result).toBe(100);
			expect(influxDbService.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM property_value'));
		});

		it('should return null if no value is found in InfluxDB', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.STRING,
			} as ChannelPropertyEntity;

			// @ts-expect-error an Expected query to return a resolved value, mocking for test
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
		});
	});
});
