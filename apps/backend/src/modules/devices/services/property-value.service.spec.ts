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

import { StorageService } from '../../storage/services/storage.service';
import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';

import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

describe('PropertyValueService', () => {
	let module: TestingModule;
	let service: PropertyValueService;
	let storageService: jest.Mocked<StorageService>;

	beforeEach(async () => {
		const mockStorageService = {
			writePoints: jest.fn(),
			query: jest.fn(),
			isConnected: jest.fn().mockReturnValue(true),
		};

		module = await Test.createTestingModule({
			providers: [
				PropertyValueService,
				{
					provide: StorageService,
					useValue: mockStorageService,
				},
				PropertyValueSourceRegistryService,
			],
		}).compile();

		service = module.get<PropertyValueService>(PropertyValueService);
		storageService = module.get<StorageService>(StorageService) as jest.Mocked<StorageService>;

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('write', () => {
		it('should write a string value to storage and cache', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.STRING,
			} as ChannelPropertyEntity;

			await service.write(property, 'test-value');

			expect(storageService.writePoints).toHaveBeenCalledWith([
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
			expect(storageService.query).not.toHaveBeenCalled();
		});

		it('should query storage if cached value is missing', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;

			storageService.query.mockResolvedValue([{ numberValue: 100 }]);

			const result = await service.readLatest(property);

			expect(result?.value).toBe(100);
			expect(storageService.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM property_value'));
		});

		it('should return null if no value is found in storage', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
				dataType: DataTypeType.STRING,
			} as ChannelPropertyEntity;

			storageService.query.mockResolvedValue([]);

			const result = await service.readLatest(property);

			expect(result).toBeNull();
			expect(storageService.query).toHaveBeenCalled();
		});

		it('should reject a strict read when storage is disconnected', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.STRING,
			} as ChannelPropertyEntity;
			storageService.isConnected.mockReturnValue(false);

			await expect(service.readLatestStrict(property)).rejects.toThrow('storage is unavailable');
		});

		it('should reject a strict read when the storage query fails', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.STRING,
			} as ChannelPropertyEntity;
			storageService.query.mockRejectedValue(new Error('database detail'));

			await expect(service.readLatestStrict(property)).rejects.toThrow('database detail');
		});

		it('should use a cached value for a strict read while storage is disconnected', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;
			service['valuesMap'].set(property.id, new PropertyValueState(42));
			storageService.isConnected.mockReturnValue(false);

			await expect(service.readLatestStrict(property)).resolves.toEqual(expect.objectContaining({ value: 42 }));
		});
	});

	describe('delete', () => {
		it('should delete property data from storage and cache', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-property-id',
			} as ChannelPropertyEntity;

			await service.delete(property);

			expect(storageService.query).toHaveBeenCalledWith(
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
			expect(storageService.writePoints).not.toHaveBeenCalled();
		});

		it('should accept enum value in allowed list', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-enum-property',
				dataType: DataTypeType.ENUM,
				format: ['on', 'off', 'auto'],
			} as ChannelPropertyEntity;

			const result = await service.write(property, 'on');

			expect(result).toBe(true);
			expect(storageService.writePoints).toHaveBeenCalled();
		});

		it('should reject numeric value below minimum', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-numeric-property',
				dataType: DataTypeType.INT,
				format: [0, 100],
			} as ChannelPropertyEntity;

			const result = await service.write(property, -5);

			expect(result).toBe(false);
			expect(storageService.writePoints).not.toHaveBeenCalled();
		});

		it('should reject numeric value above maximum', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-numeric-property',
				dataType: DataTypeType.INT,
				format: [0, 100],
			} as ChannelPropertyEntity;

			const result = await service.write(property, 150);

			expect(result).toBe(false);
			expect(storageService.writePoints).not.toHaveBeenCalled();
		});

		it('should accept numeric value within range', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-numeric-property',
				dataType: DataTypeType.INT,
				format: [0, 100],
			} as ChannelPropertyEntity;

			const result = await service.write(property, 50);

			expect(result).toBe(true);
			expect(storageService.writePoints).toHaveBeenCalled();
		});

		it('should accept any value when format is null', async () => {
			const property: ChannelPropertyEntity = {
				id: 'test-no-format-property',
				dataType: DataTypeType.STRING,
				format: null,
			} as ChannelPropertyEntity;

			const result = await service.write(property, 'any-value');

			expect(result).toBe(true);
			expect(storageService.writePoints).toHaveBeenCalled();
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

	describe('value source dereferencing', () => {
		const linked = (): ChannelPropertyEntity =>
			({
				id: 'virtual-prop',
				type: 'virtual',
				dataType: DataTypeType.FLOAT,
				format: null,
				invalid: null,
			}) as unknown as ChannelPropertyEntity;

		const source = (): ChannelPropertyEntity =>
			({
				id: 'source-prop',
				type: 'shelly-ng',
				dataType: DataTypeType.FLOAT,
				format: null,
				invalid: null,
			}) as unknown as ChannelPropertyEntity;

		beforeEach(() => {
			const registry = module.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);

			registry.register({
				getType: () => 'virtual',
				resolve: (p) => (p.id === 'virtual-prop' ? 'source-prop' : null),
			});
		});

		// The mirror of the delete() guard covered further down, and the reason it has to exist: the
		// source's series is the *source device's* history, and a write pushed through a projection
		// would be persisted into it as a real measurement the hardware never reported.
		//
		// Asserted against what the source's series actually holds afterwards, not merely against the
		// return value: the failure mode is silent corruption of another device's data — its latest
		// value, its trend and everything derived from them — which a boolean says nothing about.
		it('refuses to write through a projected property, leaving the source series untouched', async () => {
			// A genuine reading from the source device, which is what its series legitimately holds.
			await service.write(source(), 21.5);

			storageService.writePoints.mockClear();

			const written = await service.write(linked(), 40);

			expect(written).toBe(false);
			expect(storageService.writePoints).not.toHaveBeenCalled();

			// Latest value and trend cache both still describe the source's own reading.
			const state = await service.readLatest(linked());

			expect(state?.value).toBe(21.5);
			expect(service['recentValuesMap'].get('source-prop')).toEqual([21.5]);
			expect(storageService.query).not.toHaveBeenCalled();
		});

		it('still writes its own series for a non-projected property of the same type', async () => {
			const owned = {
				id: 'owned-virtual-prop',
				type: 'virtual',
				dataType: DataTypeType.FLOAT,
				format: null,
				invalid: null,
			} as unknown as ChannelPropertyEntity;

			// The registered source resolves only `virtual-prop`, so this one falls back to its own id —
			// the owned / orphaned states, which do store a value of their own.
			await expect(service.write(owned, 12.5)).resolves.toBe(true);

			expect(storageService.writePoints).toHaveBeenCalledWith([
				expect.objectContaining({ tags: { propertyId: 'owned-virtual-prop' } }),
			]);
		});

		it('reads the value written by the source property', async () => {
			const sourceProperty = source();

			await service.write(sourceProperty, 21.5);

			const state = await service.readLatest(linked());

			expect(state?.value).toBe(21.5);
			// served from the shared cache, so storage is never queried
			expect(storageService.query).not.toHaveBeenCalled();
		});

		// The post-restart path, and the only one that actually proves readLatest() dereferences.
		// Every other test in this block is served from the shared in-memory `valuesMap` before
		// storage is ever reached, so reverting readLatest()'s storage query from the resolved key back
		// to `property.id` would leave them all green while breaking the thing the design promises: a
		// linked property must see the source's *persisted* history once the process has restarted and
		// the cache is cold.
		it('queries the source key, not its own id, when the cache is cold', async () => {
			service['valuesMap'].clear();

			storageService.query.mockResolvedValue([{ numberValue: 21.5, time: '2026-07-31T12:00:00.000Z' }]);

			const state = await service.readLatest(linked());

			expect(state?.value).toBe(21.5);
			expect(storageService.query).toHaveBeenCalledTimes(1);
			expect(storageService.query).toHaveBeenCalledWith(expect.stringContaining("propertyId = 'source-prop'"));
			expect(storageService.query).not.toHaveBeenCalledWith(expect.stringContaining("propertyId = 'virtual-prop'"));
		});

		it('caches a cold storage read under the source key, so a sibling projection reuses it', async () => {
			service['valuesMap'].clear();

			storageService.query.mockResolvedValue([{ numberValue: 21.5, time: '2026-07-31T12:00:00.000Z' }]);

			await service.readLatest(linked());

			// A second projection of the same source — or the source itself — must hit the cache the
			// first read populated, rather than re-querying under a different key.
			const again = await service.readLatest(linked());

			expect(again?.value).toBe(21.5);
			expect(storageService.query).toHaveBeenCalledTimes(1);
		});

		it('does not delete the source series when a projected property is deleted', async () => {
			await service.delete(linked());

			expect(storageService.query).not.toHaveBeenCalled();
		});

		it('deletes its own series for a non-projected property', async () => {
			const own = {
				id: 'own-prop',
				type: 'shelly-ng',
				dataType: DataTypeType.FLOAT,
			} as unknown as ChannelPropertyEntity;

			await service.delete(own);

			expect(storageService.query).toHaveBeenCalledWith(
				expect.stringContaining("DELETE FROM property_value WHERE propertyId = 'own-prop'"),
			);
		});
	});
});
