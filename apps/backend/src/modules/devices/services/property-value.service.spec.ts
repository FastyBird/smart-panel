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
import { StorageQueryOptions } from '../../storage/storage.types';
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
			writePointsStrict: jest.fn(),
			query: jest.fn(),
			queryStrict: jest.fn(),
			queryActiveStrict: jest.fn(),
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

		it('does not cache a strict value until storage persists it', async () => {
			const property = {
				id: 'strict-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
				format: null,
				step: null,
			} as ChannelPropertyEntity;
			storageService.writePointsStrict
				.mockRejectedValueOnce(new Error('storage unavailable'))
				.mockResolvedValueOnce(undefined);

			await expect(service.writeStrict(property, 42)).rejects.toThrow('storage unavailable');
			expect(service['valuesMap'].has(property.id)).toBe(false);

			await expect(service.writeStrict(property, 42)).resolves.toBe(true);
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 42 }));
			expect(storageService.writePointsStrict).toHaveBeenCalledTimes(2);
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
			storageService.queryStrict.mockRejectedValue(new Error('database detail'));

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

		it('should bypass and refresh a stale process cache for an authoritative persisted read', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;
			service['valuesMap'].set(property.id, new PropertyValueState(42));
			storageService.queryActiveStrict.mockResolvedValue([{ numberValue: 100 }]);

			await expect(service.readLatestPersisted(property)).resolves.toEqual(expect.objectContaining({ value: 100 }));
			expect(storageService.queryActiveStrict).toHaveBeenCalledWith(
				expect.stringContaining('SELECT * FROM property_value'),
			);
			expect(storageService.queryStrict).not.toHaveBeenCalled();
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 100 }));
		});

		it('does not replace a cache entry published while an authoritative query is in flight', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
			} as ChannelPropertyEntity;
			let resolveQuery: (rows: Array<{ numberValue: number }>) => void = () => {};
			storageService.queryActiveStrict.mockImplementation(
				() =>
					new Promise((resolve) => {
						resolveQuery = resolve;
					}),
			);
			service['valuesMap'].set(property.id, new PropertyValueState(42));
			const persistedRead = service.readLatestPersisted(property);

			await expect(service.write(property, 200)).resolves.toBe(true);
			resolveQuery([{ numberValue: 100 }]);

			await expect(persistedRead).resolves.toEqual(expect.objectContaining({ value: 100 }));
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 200 }));
		});

		it('should batch strict reads for every uncached property', async () => {
			const properties = [
				{ id: 'property-a', dataType: DataTypeType.INT },
				{ id: 'property-b', dataType: DataTypeType.BOOL },
			] as ChannelPropertyEntity[];
			storageService.queryStrict.mockResolvedValue([
				{ propertyId: 'property-a', numberValue: 12, time: '2026-08-06T12:00:00Z' },
				{ propertyId: 'property-a', numberValue: 10, time: '2026-08-06T11:59:00Z' },
				{ propertyId: 'property-b', stringValue: 'true', time: '2026-08-06T12:01:00Z' },
			]);

			const result = await service.readLatestManyStrict(properties);

			expect(result.get('property-a')).toEqual(expect.objectContaining({ value: 12, trend: 'rising' }));
			expect(result.get('property-b')).toEqual(expect.objectContaining({ value: true }));
			expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
			expect(storageService.queryStrict).toHaveBeenCalledWith(expect.stringContaining('GROUP BY "propertyId"'));
		});

		it('should only batch uncached source keys', async () => {
			const properties = [
				{ id: 'property-a', dataType: DataTypeType.INT },
				{ id: 'property-b', dataType: DataTypeType.INT },
			] as ChannelPropertyEntity[];
			service['valuesMap'].set('property-a', new PropertyValueState(5));
			storageService.queryStrict.mockResolvedValue([{ propertyId: 'property-b', numberValue: 7 }]);

			const result = await service.readLatestManyStrict(properties);

			expect(result.get('property-a')?.value).toBe(5);
			expect(result.get('property-b')?.value).toBe(7);
			expect(storageService.queryStrict).toHaveBeenCalledWith(expect.not.stringContaining("propertyId = 'property-a'"));
		});
	});

	describe('readLatestManyBounded', () => {
		const makeProperties = (count: number): ChannelPropertyEntity[] =>
			Array.from(
				{ length: count },
				(_, index) =>
					({
						id: `property-${index}`,
						dataType: DataTypeType.INT,
					}) as ChannelPropertyEntity,
			);
		const waitForAbort = (_query: string, options?: StorageQueryOptions): Promise<never> =>
			new Promise((_, reject) => {
				const signal = options?.signal;

				if (!signal) {
					reject(new Error('Expected a storage abort signal'));
					return;
				}
				if (signal.aborted) {
					reject(signal.reason instanceof Error ? signal.reason : new Error('Storage query aborted'));
					return;
				}

				signal.addEventListener(
					'abort',
					() => reject(signal.reason instanceof Error ? signal.reason : new Error('Storage query aborted')),
					{ once: true },
				);
			});

		it('returns an empty complete result without consulting storage', async () => {
			await expect(service.readLatestManyBounded([])).resolves.toEqual({
				items: [],
				requestedCount: 0,
				availableCount: 0,
				unknownCount: 0,
				complete: true,
				storageStatus: 'not_needed',
				cacheCount: 0,
				storageCount: 0,
				missingCount: 0,
				unprocessedCount: 0,
				oldestLastUpdated: null,
				newestLastUpdated: null,
				freshnessUnknownCount: 0,
			});
			expect(storageService.isConnected).not.toHaveBeenCalled();
		});

		it('preserves complete cache-only values while storage is disconnected', async () => {
			const properties = makeProperties(2);
			service['valuesMap'].set(properties[0].id, new PropertyValueState(10, '2026-08-15T10:00:00.000Z'));
			service['valuesMap'].set(properties[1].id, new PropertyValueState(20, null));
			storageService.isConnected.mockReturnValue(false);

			const result = await service.readLatestManyBounded(properties);

			expect(result).toMatchObject({
				requestedCount: 2,
				availableCount: 2,
				unknownCount: 0,
				complete: true,
				storageStatus: 'not_needed',
				cacheCount: 2,
				storageCount: 0,
				freshnessUnknownCount: 1,
			});
			expect(result.items.map((item) => [item.propertyId, item.status, item.source])).toEqual([
				['property-0', 'available', 'cache'],
				['property-1', 'available', 'cache'],
			]);
			expect(storageService.isConnected).not.toHaveBeenCalled();
		});

		it('keeps cached coverage and marks only unresolved values when storage is disconnected', async () => {
			const properties = makeProperties(2);
			service['valuesMap'].set(properties[0].id, new PropertyValueState(10, '2026-08-15T10:00:00.000Z'));
			storageService.isConnected.mockReturnValue(false);

			const result = await service.readLatestManyBounded(properties);

			expect(result).toMatchObject({
				availableCount: 1,
				unknownCount: 1,
				complete: false,
				storageStatus: 'disconnected',
				cacheCount: 1,
				unprocessedCount: 1,
			});
			expect(result.items[1]).toEqual({
				propertyId: 'property-1',
				sourcePropertyId: 'property-1',
				status: 'unprocessed',
				source: null,
				state: null,
			});
			expect(storageService.queryStrict).not.toHaveBeenCalled();
		});

		it('treats a cached null value as missing rather than a false scalar', async () => {
			const [property] = makeProperties(1);
			service['valuesMap'].set(property.id, new PropertyValueState(null, '2026-08-15T10:00:00.000Z'));

			const result = await service.readLatestManyBounded([property]);

			expect(result).toMatchObject({
				availableCount: 0,
				unknownCount: 1,
				complete: false,
				storageStatus: 'not_needed',
				cacheCount: 1,
				missingCount: 1,
			});
			expect(result.items[0]).toMatchObject({ status: 'missing', source: 'cache', state: { value: null } });
		});

		it('rechecks the cache before reporting an unresolved disconnected value', async () => {
			const [property] = makeProperties(1);
			storageService.isConnected.mockImplementation(() => {
				service['valuesMap'].set(property.id, new PropertyValueState(9, '2026-08-15T10:00:00.000Z'));

				return false;
			});

			const result = await service.readLatestManyBounded([property]);

			expect(result.items[0]).toMatchObject({ status: 'available', source: 'cache', state: { value: 9 } });
			expect(result).toMatchObject({
				availableCount: 1,
				unknownCount: 0,
				storageStatus: 'disconnected',
				complete: true,
			});
		});

		it('distinguishes a completed storage miss from an unprocessed value', async () => {
			const [property] = makeProperties(1);
			storageService.queryStrict.mockResolvedValue([]);

			const result = await service.readLatestManyBounded([property]);

			expect(result).toMatchObject({
				availableCount: 0,
				unknownCount: 1,
				complete: false,
				storageStatus: 'available',
				storageCount: 1,
				missingCount: 1,
				unprocessedCount: 0,
			});
			expect(result.items[0]).toEqual({
				propertyId: property.id,
				sourcePropertyId: property.id,
				status: 'missing',
				source: 'storage',
				state: null,
			});
		});

		it('keeps a newer concurrent cache value instead of an older storage row', async () => {
			const [property] = makeProperties(1);
			storageService.queryStrict.mockImplementation(() => {
				service['valuesMap'].set(property.id, new PropertyValueState(42, '2026-08-15T12:00:00.000Z'));

				return Promise.resolve([{ propertyId: property.id, numberValue: 10, time: '2026-08-15T11:00:00.000Z' }]);
			});

			const result = await service.readLatestManyBounded([property]);

			expect(result.items[0]).toMatchObject({ status: 'available', source: 'cache', state: { value: 42 } });
			expect(service['valuesMap'].get(property.id)?.value).toBe(42);
		});

		it('uses a newer storage row and computes its numeric trend before caching', async () => {
			const [property] = makeProperties(1);
			storageService.queryStrict.mockImplementation(() => {
				service['valuesMap'].set(property.id, new PropertyValueState(5, '2026-08-15T10:00:00.000Z'));

				return Promise.resolve([
					{ propertyId: property.id, numberValue: 12, time: '2026-08-15T12:00:00.000Z' },
					{ propertyId: property.id, numberValue: 10, time: '2026-08-15T11:00:00.000Z' },
				]);
			});

			const result = await service.readLatestManyBounded([property]);

			expect(result.items[0]).toMatchObject({
				status: 'available',
				source: 'storage',
				state: { value: 12, trend: 'rising' },
			});
			expect(service['valuesMap'].get(property.id)).toMatchObject({ value: 12, trend: 'rising' });
		});

		it('refreshes a completed chunk when a later chunk observes a newer cache write', async () => {
			const properties = makeProperties(51);
			storageService.queryStrict.mockResolvedValueOnce([]).mockImplementationOnce(() => {
				service['valuesMap'].set(properties[0].id, new PropertyValueState(99, '2026-08-15T12:00:00.000Z'));

				return Promise.resolve([]);
			});

			const result = await service.readLatestManyBounded(properties);

			expect(storageService.queryStrict).toHaveBeenCalledTimes(2);
			expect(result.items[0]).toMatchObject({ status: 'available', source: 'cache', state: { value: 99 } });
			expect(result).toMatchObject({
				availableCount: 1,
				missingCount: 50,
				cacheCount: 1,
				storageCount: 50,
			});
		});

		it('deduplicates projected source keys and preserves logical property order', async () => {
			const registry = module.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);
			registry.register({
				getType: () => 'virtual',
				resolve: (property) => (property.type === 'virtual' ? 'source-property' : null),
			});
			const properties = [
				{ id: 'projection-a', type: 'virtual', dataType: DataTypeType.INT },
				{ id: 'projection-b', type: 'virtual', dataType: DataTypeType.INT },
			] as ChannelPropertyEntity[];
			storageService.queryStrict.mockResolvedValue([
				{ propertyId: 'source-property', numberValue: 7, time: '2026-08-15T12:00:00.000Z' },
			]);

			const result = await service.readLatestManyBounded(properties);

			expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
			expect(storageService.queryStrict).toHaveBeenCalledWith(
				expect.stringContaining("propertyId = 'source-property'"),
				expect.objectContaining({ signal: expect.any(AbortSignal) }),
			);
			expect((storageService.queryStrict.mock.calls[0][0].match(/propertyId =/g) ?? []).length).toBe(1);
			expect(result.items.map((item) => [item.propertyId, item.sourcePropertyId, item.state?.value])).toEqual([
				['projection-a', 'source-property', 7],
				['projection-b', 'source-property', 7],
			]);
		});

		it('accepts exactly 500 properties and reads distinct sources in sequential chunks of at most 50', async () => {
			const properties = makeProperties(500);
			storageService.queryStrict.mockResolvedValue([]);

			const result = await service.readLatestManyBounded(properties);

			expect(result.requestedCount).toBe(500);
			expect(storageService.queryStrict).toHaveBeenCalledTimes(10);
			for (const [query] of storageService.queryStrict.mock.calls) {
				expect((query.match(/propertyId =/g) ?? []).length).toBe(50);
			}
		});

		it('rejects 501 properties before consulting storage', async () => {
			await expect(service.readLatestManyBounded(makeProperties(501))).rejects.toThrow(
				'At most 500 property values may be read at once',
			);
			expect(storageService.isConnected).not.toHaveBeenCalled();
			expect(storageService.queryStrict).not.toHaveBeenCalled();
		});

		it('retains completed chunks and marks the remainder when a later storage chunk fails', async () => {
			const properties = makeProperties(51);
			storageService.queryStrict
				.mockResolvedValueOnce(properties.slice(0, 50).map((property) => ({ propertyId: property.id, numberValue: 1 })))
				.mockRejectedValueOnce(new Error('storage failed'));

			const result = await service.readLatestManyBounded(properties);

			expect(result).toMatchObject({
				availableCount: 50,
				unknownCount: 1,
				storageStatus: 'failed',
				storageCount: 50,
				unprocessedCount: 1,
				complete: false,
			});
			expect(result.items[50].status).toBe('unprocessed');
		});

		it('retains completed chunks and stops scheduling after a later chunk times out', async () => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
			try {
				const properties = makeProperties(101);
				storageService.queryStrict
					.mockResolvedValueOnce(
						properties.slice(0, 50).map((property) => ({ propertyId: property.id, numberValue: 1 })),
					)
					.mockImplementationOnce(waitForAbort);
				const read = service.readLatestManyBounded(properties);

				await jest.advanceTimersByTimeAsync(750);

				await expect(read).resolves.toMatchObject({
					availableCount: 50,
					unknownCount: 51,
					storageStatus: 'timed_out',
					storageCount: 50,
					unprocessedCount: 51,
					complete: false,
				});
				expect(storageService.queryStrict).toHaveBeenCalledTimes(2);
			} finally {
				jest.useRealTimers();
			}
		});

		it('enforces the hard 750 ms ceiling even when a caller supplies a later deadline', async () => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
			try {
				const [property] = makeProperties(1);
				let receivedSignal: AbortSignal | undefined;
				storageService.queryStrict.mockImplementation((query, options) => {
					receivedSignal = options?.signal;

					return waitForAbort(query, options);
				});
				const read = service.readLatestManyBounded([property], {
					deadlineAt: new Date('2026-08-15T13:00:00.000Z'),
				});

				await jest.advanceTimersByTimeAsync(750);

				await expect(read).resolves.toMatchObject({
					storageStatus: 'timed_out',
					availableCount: 0,
					unprocessedCount: 1,
					complete: false,
				});
				expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
				expect(receivedSignal?.aborted).toBe(true);
			} finally {
				jest.useRealTimers();
			}
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

		it('strictly deletes only measurements written since a rollback snapshot and clears caches', async () => {
			const property = { id: 'test-property-id' } as ChannelPropertyEntity;
			const since = new Date('2026-08-12T20:00:00.000Z');
			service['valuesMap'].set(property.id, new PropertyValueState(42));
			service['recentValuesMap'].set(property.id, [40, 42]);

			await service.deleteSinceStrict(property, since);

			expect(storageService.queryStrict).toHaveBeenCalledWith(
				"DELETE FROM property_value WHERE propertyId = 'test-property-id' AND time >= '2026-08-12T20:00:00.001Z'",
			);
			expect(service['valuesMap'].has(property.id)).toBe(false);
			expect(service['recentValuesMap'].has(property.id)).toBe(false);
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
