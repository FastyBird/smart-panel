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
import { PropertyValueState } from '../models/property-value-state.model';

import { PropertyValueService } from './property-value.service';

describe('PropertyValueService', () => {
	let service: PropertyValueService;
	let influxDbService: jest.Mocked<InfluxDbService>;

	beforeEach(async () => {
		const mockInfluxDbService = {
			writePoints: jest.fn(),
			query: jest.fn(),
			isConnected: jest.fn().mockReturnValue(true),
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
				expect.objectContaining({ tag: 'devices-module' }),
			);
		});
	});

	describe('readLatest', () => {
		it('should return cached value if available', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;

			service['valuesMap'].set('test-property-id', new PropertyValueState(42));

			const result = await service.readLatest(property);

			expect(result?.value).toBe(42);
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

			expect(result?.value).toBe(100);
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

	describe('validation', () => {
		it('should reject enum value not in allowed list', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-enum-property',
				dataType: DataTypeType.ENUM,
				format: ['on', 'off', 'auto'],
			} as ChannelPropertyEntity;

			const result = await service.write(property, 'invalid');

			expect(result).toBe(false);
			expect(influxDbService.writePoints).not.toHaveBeenCalled();
		});

		it('should accept enum value in allowed list', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-enum-property',
				dataType: DataTypeType.ENUM,
				format: ['on', 'off', 'auto'],
			} as ChannelPropertyEntity;

			const result = await service.write(property, 'on');

			expect(result).toBe(true);
			expect(influxDbService.writePoints).toHaveBeenCalled();
		});

		it('should reject numeric value below minimum', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-numeric-property',
				dataType: DataTypeType.INT,
				format: [0, 100],
			} as ChannelPropertyEntity;

			const result = await service.write(property, -5);

			expect(result).toBe(false);
			expect(influxDbService.writePoints).not.toHaveBeenCalled();
		});

		it('should reject numeric value above maximum', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-numeric-property',
				dataType: DataTypeType.INT,
				format: [0, 100],
			} as ChannelPropertyEntity;

			const result = await service.write(property, 150);

			expect(result).toBe(false);
			expect(influxDbService.writePoints).not.toHaveBeenCalled();
		});

		it('should accept numeric value within range', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-numeric-property',
				dataType: DataTypeType.INT,
				format: [0, 100],
			} as ChannelPropertyEntity;

			const result = await service.write(property, 50);

			expect(result).toBe(true);
			expect(influxDbService.writePoints).toHaveBeenCalled();
		});

		it('should accept any value when format is null', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-no-format-property',
				dataType: DataTypeType.STRING,
				format: null,
			} as ChannelPropertyEntity;

			const result = await service.write(property, 'any-value');

			expect(result).toBe(true);
			expect(influxDbService.writePoints).toHaveBeenCalled();
		});

		it('should accept boundary values for numeric range', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-boundary-property',
				dataType: DataTypeType.FLOAT,
				format: [0, 100],
			} as ChannelPropertyEntity;

			// Test min boundary
			const resultMin = await service.write(property, 0);
			expect(resultMin).toBe(true);

			// Clear cache for next test
			service['valuesMap'].clear();

			// Test max boundary
			const resultMax = await service.write(property, 100);
			expect(resultMax).toBe(true);
		});

		it('should validate with only minimum defined [min, null]', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-min-only-property',
				dataType: DataTypeType.INT,
				format: [0, null] as unknown as number[],
			} as ChannelPropertyEntity;

			// Should reject below min
			const resultBelow = await service.write(property, -5);
			expect(resultBelow).toBe(false);

			// Should accept at min
			const resultAtMin = await service.write(property, 0);
			expect(resultAtMin).toBe(true);

			// Clear cache
			service['valuesMap'].clear();

			// Should accept above min (no max constraint)
			const resultAbove = await service.write(property, 999999);
			expect(resultAbove).toBe(true);
		});

		it('should validate with only maximum defined [null, max]', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-max-only-property',
				dataType: DataTypeType.INT,
				format: [null, 100] as unknown as number[],
			} as ChannelPropertyEntity;

			// Should accept below max (no min constraint)
			const resultBelow = await service.write(property, -999999);
			expect(resultBelow).toBe(true);

			// Clear cache
			service['valuesMap'].clear();

			// Should accept at max
			const resultAtMax = await service.write(property, 100);
			expect(resultAtMax).toBe(true);

			// Clear cache
			service['valuesMap'].clear();

			// Should reject above max
			const resultAbove = await service.write(property, 101);
			expect(resultAbove).toBe(false);
		});

		it('should validate with single element format [min]', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-single-element-property',
				dataType: DataTypeType.INT,
				format: [10],
			} as ChannelPropertyEntity;

			// Should reject below min
			const resultBelow = await service.write(property, 5);
			expect(resultBelow).toBe(false);

			// Should accept at min
			const resultAtMin = await service.write(property, 10);
			expect(resultAtMin).toBe(true);

			// Clear cache
			service['valuesMap'].clear();

			// Should accept above min (no max constraint)
			const resultAbove = await service.write(property, 1000);
			expect(resultAbove).toBe(true);
		});
	});
});
