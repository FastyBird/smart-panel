/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-assignment
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { DataSource } from 'typeorm';

import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { VirtualChannelPropertyEntity } from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualDependencyGraphService } from '../../../plugins/devices-virtual/services/virtual-dependency-graph.service';
import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../../storage/interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../../storage/models/config.model';
import { CreationStorageDestinations } from '../../storage/services/storage.service';
import { type StorageBackendBinding, StorageService } from '../../storage/services/storage.service';
import { StorageQueryOptions } from '../../storage/storage.types';
import { DataTypeType, EventType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';

import {
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	ReadCacheObservation,
	originalReadCacheApi,
} from './device-creation-context';
import { CreationProducerObservation, PropertyProducerRegistryService } from './property-producer.registry.service';
import { PropertyValueLockService } from './property-value-lock.service';
import {
	IPropertyValueSource,
	PropertyReadSourceCapture,
	PropertyValueSourceRegistryService,
} from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

const nativeObjectEvidence: Readonly<{
	getOwnPropertyDescriptor: (
		receiver: object,
		key: PropertyKey,
	) => (Omit<PropertyDescriptor, 'value'> & { readonly value?: unknown }) | undefined;
}> = Object;

describe('PropertyValueService', () => {
	let module: TestingModule | undefined;
	let service: PropertyValueService;
	let storageService: jest.Mocked<StorageService>;

	beforeEach(async () => {
		const mockStorageService = {
			writePoints: jest.fn(),
			enqueueWritePoint: jest.fn(),
			flushQueuedWrites: jest.fn().mockResolvedValue(undefined),
			writePointsStrict: jest.fn(),
			query: jest.fn(),
			queryStrict: jest.fn(),
			queryActiveStrict: jest.fn(),
			queryActiveStrictBound: jest.fn(),
			isConnected: jest.fn().mockReturnValue(true),
		};

		module = await Test.createTestingModule({
			providers: [
				PropertyValueService,
				PropertyProducerRegistryService,
				{
					provide: PropertyValueLockService,
					useValue: {
						isEnabled: jest.fn().mockReturnValue(false),
						runExclusive: jest.fn(
							<T>(_key: string, operation: (lease: { assertOwned(): Promise<void> }) => Promise<T>) =>
								operation({ assertOwned: jest.fn().mockResolvedValue(undefined) }),
						),
					},
				},
				StorageService,
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: () => Object.assign(new StorageConfigModel(), { primaryStorage: 'read-test-primary' }),
					},
				},
				PropertyValueSourceRegistryService,
			],
		}).compile();

		const actualStorage = module.get(StorageService);
		const plugin: StoragePlugin = {
			name: 'read-test-primary',
			initialize: () => Promise.resolve(),
			destroy: () => Promise.resolve(),
			isAvailable: () => true,
			writePoints: () => Promise.resolve(),
			query: <T>() => Promise.resolve<T[]>([]),
			queryRaw: <T>() => Promise.reject<T>(new Error('Raw query outside fixture')),
			registerSchema: () => undefined,
			dropMeasurement: () => Promise.resolve(),
			getMeasurements: () => Promise.resolve([]),
		};
		actualStorage.registerPlugin(plugin.name, plugin);
		Object.assign(actualStorage, mockStorageService);
		service = module.get<PropertyValueService>(PropertyValueService);
		storageService = module.get<StorageService>(StorageService) as jest.Mocked<StorageService>;

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		const moduleToClose = module;
		module = undefined;
		await moduleToClose?.close();
		jest.clearAllMocks();
	});

	describe('current input freshness diagnostics', () => {
		const property = {
			id: 'freshness-property',
			dataType: DataTypeType.FLOAT,
			invalid: null,
			format: null,
			step: null,
		} as ChannelPropertyEntity;
		it('reports derived expiry and revoked lifecycle without mutating producer admission or emitting expiry', () => {
			const producers = module.get(PropertyProducerRegistryService);
			let current = true;
			const lease = producers.register(property, 3, { isCurrent: () => current, reason: 'graph_validation_pending' });
			const now = Date.now();
			expect(
				producers.commit(
					lease,
					new PropertyValueState(21),
					{
						quality: 'degraded',
						reasons: ['partial'],
						sampledAt: new Date(now - 500),
						evaluatedAt: new Date(now),
						expiresAt: new Date(now + 1000),
					},
					producers.version(lease),
				),
			).toBe(true);
			const version = producers.version(lease);
			expect(service.readSampleFreshness(property, 10000, new Date(now + 2000))).toMatchObject({
				status: 'stale',
				quality: 'degraded',
				age_seconds: 2.5,
				expires_at: new Date(now + 1000).toISOString(),
			});
			expect(producers.version(lease)).toBe(version);
			expect(producers.readDiagnosticState(property.id).producer.quality).toBe('degraded');
			current = false;
			expect(service.readSampleFreshness(property, 10000, new Date(now))).toMatchObject({
				status: 'unavailable',
				sampled_at: null,
				age_seconds: null,
				reasons: ['graph_validation_pending'],
			});
			expect(producers.version(lease)).toBe(version);
		});
		it('never turns a cached/historical value into a live sample', async () => {
			await service.write(property, 21, new Date());
			expect(service.readSampleFreshness(property, 10000)).toMatchObject({
				status: 'unavailable',
				sampled_at: null,
				age_seconds: null,
			});
		});
		it('preserves sample age, accepts equal reports, and removes faulted live authority', async () => {
			const now = Date.now();
			const report = (value: number | null, at: number) =>
				service.writeSampleWithState(property, value, {
					sampledAt: new Date(at),
					receivedAt: new Date(at),
					provenance: 'live',
				});
			await report(21, now - 20000);
			expect(service.readSampleFreshness(property, 10000, new Date(now))).toMatchObject({
				status: 'stale',
				age_seconds: 20,
				sampled_at: new Date(now - 20000).toISOString(),
			});
			await report(21, now);
			expect(service.readSampleFreshness(property, 10000, new Date(now))).toMatchObject({
				status: 'fresh',
				age_seconds: 0,
			});
			await report(null, now);
			expect(service.readSampleFreshness(property, 10000, new Date(now))).toMatchObject({
				status: 'unavailable',
				sampled_at: null,
				age_seconds: null,
			});
		});
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

		it('preserves a provider measurement timestamp in storage and cache', async () => {
			const property = {
				id: 'timestamped-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
				format: null,
				step: null,
			} as ChannelPropertyEntity;
			const measuredAt = new Date('2026-08-24T10:01:02.345Z');

			await expect(service.write(property, 42, measuredAt)).resolves.toBe(true);

			expect(storageService.writePoints).toHaveBeenCalledWith([expect.objectContaining({ timestamp: measuredAt })]);
			expect(await service.readLatest(property)).toEqual(
				expect.objectContaining({
					value: 42,
					lastUpdated: measuredAt.toISOString(),
				}),
			);
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

		it('serializes a normal write behind an in-flight strict write for the same property', async () => {
			const property = {
				id: 'strict-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
				format: null,
				step: null,
			} as ChannelPropertyEntity;
			let enterStrictWrite: () => void = () => {};
			const strictEntered = new Promise<void>((resolve) => {
				enterStrictWrite = resolve;
			});
			let resolveStrictWrite: () => void = () => {};
			storageService.writePointsStrict.mockImplementation(
				() =>
					new Promise<void>((resolve) => {
						resolveStrictWrite = resolve;
						enterStrictWrite();
					}),
			);
			storageService.writePoints.mockResolvedValue();
			const strictWrite = service.writeStrict(property, 42);
			const normalWrite = service.write(property, 200);

			await strictEntered;
			expect(storageService.writePoints).not.toHaveBeenCalled();
			resolveStrictWrite();

			await expect(strictWrite).resolves.toBe(true);
			await expect(normalWrite).resolves.toBe(true);
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 200 }));
			expect(service['recentValuesMap'].get(property.id)).toEqual([42, 200]);
		});

		it('keeps ordinary writers outside the persisted comparison-to-write boundary', async () => {
			const property = {
				id: 'strict-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
				format: null,
				step: null,
			} as ChannelPropertyEntity;
			const storageBinding = {} as StorageBackendBinding;
			storageService.queryActiveStrictBound.mockResolvedValue({
				rows: [{ numberValue: 10 }],
				binding: storageBinding,
			});
			storageService.writePointsStrict.mockResolvedValue();
			storageService.writePoints.mockResolvedValue();
			let enterBeforeWrite: () => void = () => {};
			const beforeWriteEntered = new Promise<void>((resolve) => {
				enterBeforeWrite = resolve;
			});
			let releaseBeforeWrite: () => void = () => {};
			const beforeWrite = jest.fn(
				() =>
					new Promise<void>((resolve) => {
						releaseBeforeWrite = resolve;
						enterBeforeWrite();
					}),
			);
			const reconciliation = service.writeStrictIfPersistedDifferent(
				property,
				42,
				new PropertyValueState(10),
				beforeWrite,
			);
			await beforeWriteEntered;
			const normalWrite = service.write(property, 200);

			await Promise.resolve();
			expect(storageService.writePointsStrict).not.toHaveBeenCalled();
			expect(storageService.writePoints).not.toHaveBeenCalled();
			releaseBeforeWrite();

			await expect(reconciliation).resolves.toEqual({
				changed: true,
				state: expect.objectContaining({ value: 42, lastUpdated: expect.any(String) }),
			});
			await expect(normalWrite).resolves.toBe(true);
			expect(storageService.writePointsStrict).toHaveBeenCalledWith(expect.any(Array), storageBinding);
			expect(storageService.writePoints).toHaveBeenCalledTimes(1);
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 200 }));
		});

		it('does not replace a persisted value that changed after the adoption snapshot', async () => {
			const property = {
				id: 'strict-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
				format: null,
				step: null,
			} as ChannelPropertyEntity;
			storageService.queryActiveStrictBound.mockResolvedValue({
				rows: [{ numberValue: 20 }],
				binding: {} as StorageBackendBinding,
			});
			const assertOwnership = jest.fn().mockResolvedValue(undefined);

			await expect(
				service.writeStrictIfPersistedDifferent(property, 42, new PropertyValueState(10), assertOwnership),
			).resolves.toEqual({
				changed: false,
				state: expect.objectContaining({ value: 20 }),
			});

			expect(assertOwnership).toHaveBeenCalledTimes(1);
			expect(storageService.writePointsStrict).not.toHaveBeenCalled();
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
			const storageBinding = {} as StorageBackendBinding;
			storageService.queryActiveStrictBound.mockResolvedValue({
				rows: [{ numberValue: 100 }],
				binding: storageBinding,
			});

			await expect(service.readLatestPersisted(property)).resolves.toEqual(expect.objectContaining({ value: 100 }));
			expect(storageService.queryActiveStrictBound).toHaveBeenCalledWith(
				expect.stringContaining('SELECT * FROM property_value'),
			);
			expect(storageService.queryStrict).not.toHaveBeenCalled();
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 100 }));
		});

		it('clears stale value and trend caches after an authoritative storage miss', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;
			service['valuesMap'].set(property.id, new PropertyValueState(42));
			service['recentValuesMap'].set(property.id, [40, 42]);
			storageService.queryActiveStrictBound.mockResolvedValue({
				rows: [],
				binding: {} as StorageBackendBinding,
			});

			await expect(service.readLatestPersisted(property)).resolves.toBeNull();
			expect(service['valuesMap'].has(property.id)).toBe(false);
			expect(service['recentValuesMap'].has(property.id)).toBe(false);
		});

		it('does not replace a cache entry published while an authoritative query is in flight', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
			} as ChannelPropertyEntity;
			let resolveQuery: (rows: Array<{ numberValue: number }>) => void = () => {};
			storageService.queryActiveStrictBound.mockImplementation(
				() =>
					new Promise((resolve) => {
						resolveQuery = (rows) => resolve({ rows, binding: {} as StorageBackendBinding });
					}),
			);
			service['valuesMap'].set(property.id, new PropertyValueState(42));
			const persistedRead = service.readLatestPersisted(property);

			await expect(service.write(property, 200)).resolves.toBe(true);
			resolveQuery([{ numberValue: 100 }]);

			await expect(persistedRead).resolves.toEqual(expect.objectContaining({ value: 100 }));
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 200 }));
		});

		it('does not clear a cache entry published while an authoritative miss is in flight', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
				invalid: null,
			} as ChannelPropertyEntity;
			let resolveQuery: (rows: Array<{ numberValue: number }>) => void = () => {};
			storageService.queryActiveStrictBound.mockImplementation(
				() =>
					new Promise((resolve) => {
						resolveQuery = (rows) => resolve({ rows, binding: {} as StorageBackendBinding });
					}),
			);
			service['valuesMap'].set(property.id, new PropertyValueState(42));
			const persistedRead = service.readLatestPersisted(property);

			await expect(service.write(property, 200)).resolves.toBe(true);
			resolveQuery([]);

			await expect(persistedRead).resolves.toBeNull();
			expect(service['valuesMap'].get(property.id)).toEqual(expect.objectContaining({ value: 200 }));
		});

		it('returns the backend binding with an authoritative persisted snapshot', async () => {
			const property = {
				id: 'test-property-id',
				dataType: DataTypeType.INT,
			} as ChannelPropertyEntity;
			const storageBinding = {} as StorageBackendBinding;
			storageService.queryActiveStrictBound.mockResolvedValue({
				rows: [{ numberValue: 100 }],
				binding: storageBinding,
			});

			await expect(service.readLatestPersistedSnapshot(property)).resolves.toEqual({
				state: expect.objectContaining({ value: 100 }),
				storageBinding,
			});
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

	describe('value source resolver failures', () => {
		const registerThrowingSource = (failure: unknown): void => {
			module.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService).register({
				getType: () => 'throwing-source',
				resolve: () => {
					throw failure;
				},
			});
		};
		const projected = (): ChannelPropertyEntity =>
			({
				id: 'projection-property',
				type: 'throwing-source',
				dataType: DataTypeType.FLOAT,
			}) as ChannelPropertyEntity;

		it('contains best-effort writes and never writes under the projection id', async () => {
			registerThrowingSource(new Error('resolver unavailable'));

			await expect(service.write(projected(), 42)).resolves.toBe(false);
			await expect(service.writeWithState(projected(), 43)).resolves.toEqual({ changed: false, state: null });
			await expect(service.writeLiveWithState(projected(), 44)).resolves.toEqual({ changed: false, state: null });
			expect(storageService.writePoints).not.toHaveBeenCalled();
			expect(storageService.enqueueWritePoint).not.toHaveBeenCalled();
		});

		it('contains best-effort reads and deletes without querying or deleting the projection id', async () => {
			registerThrowingSource(new Error('resolver unavailable'));

			await expect(service.readLatest(projected())).resolves.toBeNull();
			await expect(service.delete(projected())).resolves.toBeUndefined();
			const bounded = await service.readLatestManyBounded([projected()]);

			expect(bounded.items[0]).toMatchObject({
				status: 'unprocessed',
				source: null,
				sourcePropertyId: null,
			});
			expect(bounded.storageStatus).toBe('failed');
			expect(storageService.query).not.toHaveBeenCalled();
		});

		it('preserves resolver errors on strict operations', async () => {
			const failure = new Error('resolver unavailable');
			registerThrowingSource(failure);

			await expect(service.writeStrict(projected(), 42)).rejects.toBe(failure);
			await expect(service.readLatestStrict(projected())).rejects.toBe(failure);
			await expect(service.deleteSinceStrict(projected(), new Date())).rejects.toBe(failure);
		});

		it.each([null, undefined, 'resolver unavailable'])(
			'contains non-Error resolver throws (%p)',
			async (failure: unknown) => {
				registerThrowingSource(failure);

				await expect(service.write(projected(), 42)).resolves.toBe(false);
				await expect(service.readLatest(projected())).resolves.toBeNull();
				await expect(service.delete(projected())).resolves.toBeUndefined();
				const bounded = await service.readLatestManyBounded([projected()]);

				expect(bounded.items[0]).toMatchObject({ status: 'unprocessed', sourcePropertyId: null });
				await expect(service.writeStrict(projected(), 43)).rejects.toBe(failure);
				await expect(service.readLatestStrict(projected())).rejects.toBe(failure);
				expect(storageService.writePoints).not.toHaveBeenCalled();
				expect(storageService.enqueueWritePoint).not.toHaveBeenCalled();
				expect(storageService.query).not.toHaveBeenCalled();
				expect(storageService.queryStrict).not.toHaveBeenCalled();
			},
		);
	});
	it('rejects a forged creation value lease before property traversal, queues or backend work', async () => {
		let getters = 0;
		const property = new ChannelPropertyEntity();
		Object.defineProperty(property, 'id', {
			get: () => {
				getters++;
				throw new Error('Business getter must not run');
			},
		});
		await expect(
			service.writeCreatedWithState(
				new DeviceCreationPublicationLease(),
				property,
				1,
				new CreationStorageDestinations(),
			),
		).rejects.toThrow('Original creation publication unavailable');
		expect(getters).toBe(0);
		expect(storageService.writePoints).not.toHaveBeenCalled();
		expect(storageService.query).not.toHaveBeenCalled();
	});
	describe('original read source and finite hydration decisions', () => {
		const property = (id = 'read-source') =>
			Object.assign(new ChannelPropertyEntity(), { id, dataType: DataTypeType.FLOAT, invalid: null, format: [0, 100] });
		it('retains successful registration identity across duplicate false and refuses an original method replacement', () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const input = property();
			const source: IPropertyValueSource = { getType: () => input.type, resolve: () => input.id };
			expect(registry.register(source)).toBe(true);
			const capture = registry.captureReadSource(input);
			try {
				expect(registry.register({ getType: () => input.type, resolve: () => 'foreign' })).toBe(false);
				expect(registry.isReadSourceCurrent(capture)).toBe(true);
				source.resolve = () => input.id;
				expect(registry.isReadSourceCurrent(capture)).toBe(false);
			} finally {
				registry.closeReadSource(capture);
			}
			expect(registry.isReadSourceCurrent(capture)).toBe(false);
		});
		it('records exact source absence without recapturing a newly registered equal-key source', () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const input = property();
			const capture = registry.captureReadSource(input);
			try {
				expect(registry.register({ getType: () => input.type, resolve: () => input.id })).toBe(true);
				expect(registry.isReadSourceCurrent(capture)).toBe(false);
			} finally {
				registry.closeReadSource(capture);
			}
		});
		it('owns primitive format input and detects actual queued input mutation without freezing the caller', () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const input = property();
			const capture = registry.captureReadSource(input);
			try {
				input.format = [0, 200];
				expect(registry.isReadSourceCurrent(capture)).toBe(false);
				expect(registry.readSourceInput(capture).format).toEqual([0, 100]);
				expect(Object.isFrozen(input)).toBe(false);
			} finally {
				registry.closeReadSource(capture);
			}
		});
		it('returns null for a held latest row when the originally absent source appears', async () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const input = property();
			let release: (rows: unknown[]) => void = () => {};
			storageService.query.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
			);
			const pending = service.readLatest(input);
			try {
				registry.register({ getType: () => input.type, resolve: () => input.id });
				release([{ numberValue: 70, time: '2026-10-17T00:00:00.000Z' }]);
				await expect(pending).resolves.toBeNull();
			} finally {
				release([]);
				await pending.catch(() => undefined);
			}
		});
		it('uses a genuine concurrent report and never reinstalls history after its actual deletion', async () => {
			const input = property();
			let release: (rows: unknown[]) => void = () => {};
			storageService.query.mockResolvedValue([]).mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
			);
			const pending = service.readLatest(input);
			try {
				await service.write(input, 80);
				await service.delete(input);
				release([{ numberValue: 10, time: '2026-10-17T00:00:00.000Z' }]);
				await expect(pending).resolves.toBeNull();
			} finally {
				release([]);
				await pending.catch(() => undefined);
			}
		});
		it('refuses a held row after a real same-role registration overwrite even for the same plugin object', async () => {
			const input = property();
			let release: (rows: unknown[]) => void = () => {};
			storageService.query.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
			);
			const plugin: StoragePlugin = {
				name: 'read-test-primary',
				initialize: () => Promise.resolve(),
				destroy: () => Promise.resolve(),
				isAvailable: () => true,
				writePoints: () => Promise.resolve(),
				query: <T>() => Promise.resolve<T[]>([]),
				queryRaw: <T>() => Promise.reject<T>(new Error('Raw query outside fixture')),
				registerSchema: () => undefined,
				dropMeasurement: () => Promise.resolve(),
				getMeasurements: () => Promise.resolve([]),
			};
			storageService.registerPlugin(plugin.name, plugin);
			const pending = service.readLatest(input);
			try {
				storageService.registerPlugin(plugin.name, plugin);
				release([{ numberValue: 70 }]);
				await expect(pending).resolves.toBeNull();
			} finally {
				release([]);
				await pending.catch(() => undefined);
			}
		});
		it('publishes only once for a shared physical strict-batch query while keeping each alias policy original', async () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const a = property('alias-a');
			const b = property('alias-b');
			const source: IPropertyValueSource = { getType: () => a.type, resolve: () => 'physical' };
			registry.register(source);
			storageService.queryStrict.mockResolvedValue([
				{ propertyId: 'physical', numberValue: 20 },
				{ propertyId: 'physical', numberValue: 10 },
			]);
			const values = await service.readLatestManyStrict([a, b]);
			expect(values.get(a.id)?.value).toBe(20);
			expect(values.get(b.id)?.value).toBe(20);
			expect(values.get(a.id)?.trend).toBe('rising');
			expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
		});
		it.each(['strict', 'bounded'])(
			'does not borrow another alias policy in a shared %s physical query',
			async (kind) => {
				const registry = module.get(PropertyValueSourceRegistryService);
				const a = property('policy-a');
				const b = property('policy-b');
				const blocked = new Set<string>();
				registry.register({
					getType: () => a.type,
					resolve: () => 'physical',
					unavailableReason: (input) => (blocked.has(input.id) ? 'graph_source_changed' : null),
				});
				let release: (rows: unknown[]) => void = () => {};
				storageService.queryStrict.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							release = resolve;
						}),
				);
				if (kind === 'strict') {
					const pending = service.readLatestManyStrict([a, b]);
					try {
						blocked.add(a.id);
						release([{ propertyId: 'physical', numberValue: 20 }]);
						const result = await pending;
						expect(result.get(a.id)).toBeNull();
						expect(result.get(b.id)?.value).toBe(20);
					} finally {
						release([]);
						await pending.catch(() => undefined);
					}
				} else {
					const pending = service.readLatestManyBounded([a, b]);
					try {
						blocked.add(a.id);
						release([{ propertyId: 'physical', numberValue: 20 }]);
						const result = await pending;
						expect(result.items.find((item) => item.propertyId === a.id)?.state).toBeNull();
						expect(result.items.find((item) => item.propertyId === a.id)?.source).toBeNull();
						expect(result.items.find((item) => item.propertyId === b.id)?.state?.value).toBe(20);
					} finally {
						release([]);
						await pending.catch(() => undefined);
					}
				}
				expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
			},
		);
		it('calls pinned original cleanup after finish API substitution and can perform a fresh ordinary read', async () => {
			const input = property();
			let release: (rows: unknown[]) => void = () => {};
			storageService.query.mockResolvedValue([{ numberValue: 30 }]).mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
			);
			const pending = service.readLatest(input);
			const replacement = jest.spyOn(DeviceCreationPublicationEngine, 'finishReadCache');
			const cleanup = jest.spyOn(DeviceCreationPublicationEngine, 'closeReadCache');
			try {
				release([{ numberValue: 10 }]);
				await expect(pending).resolves.toBeNull();
				expect(replacement).not.toHaveBeenCalled();
				expect(cleanup).not.toHaveBeenCalled();
			} finally {
				release([]);
				await pending.catch(() => undefined);
				replacement.mockRestore();
				cleanup.mockRestore();
			}
			await expect(service.readLatest(input)).resolves.toEqual(expect.objectContaining({ value: 30 }));
		});
		it('keeps a real bound persisted snapshot historical after a same-value report without republishing its trend', async () => {
			const input = property();
			await service.write(input, 80);
			const original: Readonly<{
				call: (
					receiver: StorageService,
					query: string,
				) => Promise<Readonly<{ rows: unknown[]; binding: StorageBackendBinding }>>;
			}> = StorageService.prototype.queryActiveStrictBound;
			const genuine = await original.call(storageService, 'SELECT * FROM property_value');
			let release: () => void = () => {};
			let enter: () => void = () => {};
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			storageService.queryActiveStrictBound.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						enter();
						release = () => resolve({ rows: [{ numberValue: 10 }, { numberValue: 20 }], binding: genuine.binding });
					}),
			);
			const pending = service.readLatestPersistedSnapshot(input);
			try {
				await entered;
				await service.write(input, 80);
				release();
				const historical = await pending;
				expect(historical.storageBinding).toBe(genuine.binding);
				expect(historical.state?.value).toBe(10);
				expect(historical.state?.trend).toBe('falling');
				await expect(service.readLatest(input)).resolves.toEqual(expect.objectContaining({ value: 80 }));
			} finally {
				release();
				await pending.catch(() => undefined);
			}
		});

		it('keeps changed sticky, consumes once, and leaves unrelated read keys independent', () => {
			const a = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, 'read-a');
			const b = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, 'read-b');
			try {
				DeviceCreationPublicationEngine.invalidateIds(['read-a']);
				expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, a)).toBe('changed');
				expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, b)).toBe('publish');
				expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, b)).toBe('changed');
				expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, new ReadCacheObservation())).toBe(
					'changed',
				);
			} finally {
				originalReadCacheApi.close.call(originalReadCacheApi.receiver, a);
				originalReadCacheApi.close.call(originalReadCacheApi.receiver, b);
			}
		});
	});

	describe('R12 original hydration result and callback-free effect boundaries', () => {
		const input = (id: string) =>
			Object.assign(new ChannelPropertyEntity(), { id, dataType: DataTypeType.FLOAT, invalid: null, format: [0, 100] });

		it.each(['strict', 'bounded'])(
			'prepares a real row getter before any %s original input check or shared cache effect',
			async (kind) => {
				const registry = module.get(PropertyValueSourceRegistryService);
				const property = input('row-getter-alias');
				registry.register({ getType: () => property.type, resolve: () => 'row-getter-physical' });
				const version = service['cacheVersions'].get('row-getter-physical');
				const observer = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, 'row-getter-physical');
				const row = {
					propertyId: 'row-getter-physical',
					get numberValue() {
						property.format = [0, 200];
						return 70;
					},
				};
				storageService.queryStrict.mockResolvedValue([row]);
				try {
					if (kind === 'strict') expect((await service.readLatestManyStrict([property])).get(property.id)).toBeNull();
					else
						expect((await service.readLatestManyBounded([property])).items[0]).toMatchObject({
							state: null,
							source: null,
						});
					expect(service['valuesMap'].has('row-getter-physical')).toBe(false);
					expect(service['recentValuesMap'].has('row-getter-physical')).toBe(false);
					expect(service['cacheVersions'].get('row-getter-physical')).toBe(version);
					expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, observer)).toBe('publish');
					expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
				} finally {
					originalReadCacheApi.close.call(originalReadCacheApi.receiver, observer);
				}
			},
		);

		it.each(['strict', 'bounded'])(
			'finishes all %s alias callbacks before structural checks without trusting an earlier true bit',
			async (kind) => {
				const registry = module.get(PropertyValueSourceRegistryService);
				const a = input('callback-a'),
					b = input('callback-b');
				let armed = false;
				// Deliberately violates the trusted pure-callback contract to test the supported,
				// observable descriptor/input veto; this is not a plugin-private-state sandbox.
				registry.register({
					getType: () => a.type,
					resolve: (property) => {
						if (armed && property.id === b.id) {
							a.format = [0, 200];
							b.format = [0, 200];
						}
						return 'callback-physical';
					},
				});
				storageService.queryStrict.mockResolvedValue([
					{
						propertyId: 'callback-physical',
						get numberValue() {
							armed = true;
							return 20;
						},
					},
				]);
				if (kind === 'strict') expect([...(await service.readLatestManyStrict([a, b])).values()]).toEqual([null, null]);
				else
					expect((await service.readLatestManyBounded([a, b])).items.map((item) => item.state)).toEqual([null, null]);
				expect(service['valuesMap'].has('callback-physical')).toBe(false);
				expect(service['recentValuesMap'].has('callback-physical')).toBe(false);
				expect(service['cacheVersions'].has('callback-physical')).toBe(false);
			},
		);

		it('has a callback-free authentic structural veto and closes it without recapture after method replacement', () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const property = input('structural-only');
			const resolve = jest.fn(() => 'structural-physical');
			const source: IPropertyValueSource = { getType: () => property.type, resolve };
			registry.register(source);
			const captured = registry.captureReadSource(property);
			const calls = resolve.mock.calls.length;
			try {
				expect(registry.isReadSourceStructurallyCurrent(captured)).toBe(true);
				expect(resolve).toHaveBeenCalledTimes(calls);
				source.resolve = () => 'structural-physical';
				expect(registry.isReadSourceStructurallyCurrent(captured)).toBe(false);
				expect(resolve).toHaveBeenCalledTimes(calls);
			} finally {
				registry.closeReadSource(captured);
			}
			expect(registry.isReadSourceStructurallyCurrent(captured)).toBe(false);
		});

		it.each(['disconnected', 'timed_out', 'failed', 'available'])(
			'does not raw-refresh an original vetoed mixed cache hit on the %s return',
			async (mode) => {
				const k = input('protected-k'),
					l = input('unresolved-l');
				storageService.query.mockResolvedValueOnce([{ numberValue: 17 }]);
				expect((await service.readLatest(k))?.value).toBe(17);
				const replacement = jest.spyOn(DeviceCreationPublicationEngine, 'finishReadCache');
				storageService.isConnected.mockReturnValue(mode !== 'disconnected');
				if (mode === 'failed') storageService.queryStrict.mockRejectedValueOnce(new Error('Original query failure'));
				else storageService.queryStrict.mockResolvedValueOnce([]);
				try {
					const result = await service.readLatestManyBounded(
						[k, l],
						mode === 'timed_out' ? { deadlineAt: new Date(0) } : {},
					);
					expect(result.storageStatus).toBe(mode);
					expect(result.items[0]).toMatchObject({ state: null, source: null, status: 'missing' });
					expect(result.cacheCount).toBe(0);
					expect(result.availableCount).toBe(0);
					expect(replacement).not.toHaveBeenCalled();
				} finally {
					replacement.mockRestore();
				}
			},
		);

		it.each(['method', 'input'])(
			'keeps a held persisted A binding away from genuine current B producer data after original %s loss',
			async (loss) => {
				const registry = module.get(PropertyValueSourceRegistryService);
				const producers = module.get(PropertyProducerRegistryService);
				const property = input('bound-alias');
				const source: IPropertyValueSource = {
					getType: () => property.type,
					resolve: (value) => (value.format?.[1] === 200 ? 'bound-b' : 'bound-a'),
				};
				registry.register(source);
				const b = input('bound-b');
				const lease = producers.register(b, 1);
				const now = new Date();
				expect(
					producers.commit(
						lease,
						new PropertyValueState(88),
						{
							quality: 'good',
							reasons: [],
							sampledAt: now,
							evaluatedAt: now,
							expiresAt: new Date(now.getTime() + 60000),
						},
						producers.version(lease),
					),
				).toBe(true);
				const original: Readonly<{
					call: (
						receiver: StorageService,
						query: string,
					) => Promise<Readonly<{ rows: unknown[]; binding: StorageBackendBinding }>>;
				}> = StorageService.prototype.queryActiveStrictBound;
				const genuine = await original.call(storageService, 'SELECT * FROM property_value');
				let enter: () => void = () => {};
				const entered = new Promise<void>((resolve) => {
					enter = resolve;
				});
				let release: () => void = () => {};
				storageService.queryActiveStrictBound.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							enter();
							release = () => resolve({ rows: [{ numberValue: 10 }, { numberValue: 20 }], binding: genuine.binding });
						}),
				);
				const pending = service.readLatestPersistedSnapshot(property);
				try {
					await entered;
					if (loss === 'method') source.resolve = () => 'bound-b';
					else property.format = [0, 200];
					release();
					const snapshot = await pending;
					expect(snapshot.state).toMatchObject({ value: 10, trend: 'falling' });
					expect(snapshot.storageBinding).toBe(genuine.binding);
					expect(snapshot.state?.producer).toBeUndefined();
					expect(producers.read(b.id)?.value).toBe(88);
					expect(service['valuesMap'].has('bound-a')).toBe(false);
					expect(service['recentValuesMap'].has('bound-a')).toBe(false);
					expect(storageService.queryActiveStrictBound).toHaveBeenCalledTimes(1);
				} finally {
					release();
					await pending.catch(() => undefined);
					producers.unregister(lease);
				}
			},
		);
	});

	describe('R13 original policy data and bounded source identity', () => {
		const input = (id: string) =>
			Object.assign(new ChannelPropertyEntity(), { id, dataType: DataTypeType.FLOAT, invalid: null, format: [0, 100] });

		it('reads only authentic captured primitive policy data without callbacks or fresh membership, and refuses foreign or closed tokens', () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const property = input('policy-data');
			const originalReason = jest.fn(() => 'original_unavailable');
			const source: IPropertyValueSource = {
				getType: () => property.type,
				resolve: () => 'policy-key',
				unavailableReason: originalReason,
			};
			registry.register(source);
			const captured = registry.captureReadSource(property);
			const calls = originalReason.mock.calls.length;
			const bReason = jest.fn(() => {
				throw new Error('Substituted B policy must not run');
			});
			source.unavailableReason = bReason;
			const foreignRegistry = new PropertyValueSourceRegistryService();
			const foreign = foreignRegistry.captureReadSource(property);
			try {
				expect(registry.readSourceUnavailableReason(captured)).toBe('original_unavailable');
				expect(registry.isReadSourceCurrent(captured)).toBe(false);
				expect(originalReason).toHaveBeenCalledTimes(calls);
				expect(bReason).not.toHaveBeenCalled();
				expect(() => registry.readSourceUnavailableReason(foreign)).toThrow(
					'Original value source capture unavailable',
				);
				expect(() => registry.readSourceUnavailableReason(new PropertyReadSourceCapture())).toThrow(
					'Original value source capture unavailable',
				);
			} finally {
				registry.closeReadSource(captured);
				foreignRegistry.closeReadSource(foreign);
			}
			expect(() => registry.readSourceUnavailableReason(captured)).toThrow('Original value source capture unavailable');
		});

		it.each(['absent', 'benign'])(
			'retains held historical A rows and real A binding without invoking a newly throwing %s policy',
			async (initial) => {
				const registry = module.get(PropertyValueSourceRegistryService);
				const producers = module.get(PropertyProducerRegistryService);
				const property = input('policy-bound-alias');
				const source: IPropertyValueSource = {
					getType: () => property.type,
					resolve: () => 'policy-bound-a',
					...(initial === 'benign' ? { unavailableReason: () => null } : {}),
				};
				registry.register(source);
				const original: Readonly<{
					call: (
						receiver: StorageService,
						query: string,
					) => Promise<Readonly<{ rows: unknown[]; binding: StorageBackendBinding }>>;
				}> = StorageService.prototype.queryActiveStrictBound;
				const genuine = await original.call(storageService, 'SELECT * FROM property_value');
				let enter: () => void = () => {},
					release: () => void = () => {};
				const entered = new Promise<void>((resolve) => {
					enter = resolve;
				});
				storageService.queryActiveStrictBound.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							enter();
							release = () => resolve({ rows: [{ numberValue: 10 }, { numberValue: 20 }], binding: genuine.binding });
						}),
				);
				const pending = service.readLatestPersistedSnapshot(property);
				const bReason = jest.fn(() => {
					throw new Error('B policy must never be dispatched');
				});
				let bLease: ReturnType<PropertyProducerRegistryService['register']> | undefined;
				try {
					await entered;
					source.unavailableReason = bReason;
					const b = input('policy-bound-a');
					bLease = producers.register(b, 1);
					const now = new Date();
					expect(
						producers.commit(
							bLease,
							new PropertyValueState(88),
							{
								quality: 'good',
								reasons: [],
								sampledAt: now,
								evaluatedAt: now,
								expiresAt: new Date(now.getTime() + 60000),
							},
							producers.version(bLease),
						),
					).toBe(true);
					release();
					const result = await pending;
					expect(result.state).toMatchObject({ value: 10, trend: 'falling' });
					expect(result.state?.producer).toBeUndefined();
					expect(result.storageBinding).toBe(genuine.binding);
					expect(bReason).not.toHaveBeenCalled();
					expect(producers.read(b.id)?.value).toBe(88);
					expect(storageService.queryActiveStrictBound).toHaveBeenCalledTimes(1);
					expect(storageService.queryStrict).not.toHaveBeenCalled();
					expect(service['valuesMap'].has('policy-bound-a')).toBe(false);
					expect(service['recentValuesMap'].has('policy-bound-a')).toBe(false);
				} finally {
					release();
					await pending.catch(() => undefined);
					if (bLease) producers.unregister(bLease);
				}
			},
		);

		it.each([
			['strict', 'absent'],
			['strict', 'benign'],
			['bounded', 'absent'],
			['bounded', 'benign'],
		])('refuses only the affected %s alias after %s policy loss without invoking B', async (kind, initial) => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const a = input('policy-batch-a');
			// Real distinct entity type with no registered source; no fake positive source capability.
			const b = Object.assign(new VirtualChannelPropertyEntity(), {
				id: 'policy-batch-b',
				dataType: DataTypeType.FLOAT,
			});
			const source: IPropertyValueSource = {
				getType: () => a.type,
				resolve: () => 'policy-batch-physical',
				...(initial === 'benign' ? { unavailableReason: () => null } : {}),
			};
			registry.register(source);
			let release: (rows: unknown[]) => void = () => {};
			storageService.queryStrict.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
			);
			const bReason = jest.fn(() => {
				throw new Error('No B callback during original batch');
			});
			const pending = kind === 'strict' ? service.readLatestManyStrict([a, b]) : service.readLatestManyBounded([a, b]);
			try {
				source.unavailableReason = bReason;
				release([
					{ propertyId: 'policy-batch-physical', numberValue: 10 },
					{ propertyId: b.id, numberValue: 30 },
				]);
				const result = await pending;
				if (result instanceof Map) {
					expect(result.get(a.id)).toBeNull();
					expect(result.get(b.id)?.value).toBe(30);
				} else {
					expect(result.items[0]).toMatchObject({
						sourcePropertyId: null,
						state: null,
						source: null,
						status: 'missing',
					});
					expect(result.items[1]).toMatchObject({
						sourcePropertyId: b.id,
						state: { value: 30 },
						source: 'storage',
						status: 'available',
					});
					expect(result).toMatchObject({
						requestedCount: 2,
						availableCount: 1,
						unknownCount: 1,
						missingCount: 1,
						unprocessedCount: 0,
						cacheCount: 0,
						storageCount: 1,
					});
				}
				expect(bReason).not.toHaveBeenCalled();
				expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
				expect(service['valuesMap'].has('policy-batch-physical')).toBe(false);
			} finally {
				release([]);
				await pending.catch(() => undefined);
			}
		});

		it.each(['resolve', 'input', 'role', 'read-method'])(
			'clears bounded source identity after actual original %s loss without a B query',
			async (loss) => {
				const registry = module.get(PropertyValueSourceRegistryService);
				const property = input('identity-alias');
				const bResolve = jest.fn(() => 'identity-b');
				const source: IPropertyValueSource = {
					getType: () => property.type,
					resolve: (value) => (value.format?.[1] === 200 ? 'identity-b' : 'identity-a'),
				};
				registry.register(source);
				let release: (rows: unknown[]) => void = () => {};
				storageService.queryStrict.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							release = resolve;
						}),
				);
				const originalRead = storageService.queryStrict;
				const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(storageService, 'queryStrict');
				if (!descriptor) throw new Error('Original fixture read descriptor required');
				const bRead = jest.fn().mockResolvedValue([]);
				let bQueries = 0;
				const plugin: StoragePlugin = {
					name: 'read-test-primary',
					initialize: () => Promise.resolve(),
					destroy: () => Promise.resolve(),
					isAvailable: () => true,
					writePoints: () => Promise.resolve(),
					query: <T>() => {
						bQueries++;
						return Promise.resolve<T[]>([]);
					},
					queryRaw: <T>() => Promise.reject<T>(new Error('Raw query outside fixture')),
					registerSchema: () => undefined,
					dropMeasurement: () => Promise.resolve(),
					getMeasurements: () => Promise.resolve([]),
				};
				const pending = service.readLatestManyBounded([property]);
				try {
					if (loss === 'resolve') source.resolve = bResolve;
					if (loss === 'input') property.format = [0, 200];
					if (loss === 'role') storageService.registerPlugin(plugin.name, plugin);
					if (loss === 'read-method')
						Object.defineProperty(storageService, 'queryStrict', { ...descriptor, value: bRead });
					release([{ propertyId: 'identity-a', numberValue: 70 }]);
					const result = await pending;
					expect(result.items[0]).toEqual({
						propertyId: property.id,
						sourcePropertyId: null,
						state: null,
						source: null,
						status: 'missing',
					});
					expect(result).toMatchObject({
						requestedCount: 1,
						availableCount: 0,
						unknownCount: 1,
						missingCount: 1,
						unprocessedCount: 0,
						cacheCount: 0,
						storageCount: 0,
						storageStatus: 'available',
					});
					expect(originalRead).toHaveBeenCalledTimes(1);
					expect(bResolve).not.toHaveBeenCalled();
					expect(bRead).not.toHaveBeenCalled();
					expect(bQueries).toBe(0);
					expect(service['valuesMap'].has('identity-a')).toBe(false);
				} finally {
					release([]);
					await pending.catch(() => undefined);
					Object.defineProperty(storageService, 'queryStrict', descriptor);
				}
			},
		);

		it.each(['disconnected', 'timed_out'])(
			'retains the intact original unresolved key on the %s path without claiming a backend binding',
			async (mode) => {
				const registry = module.get(PropertyValueSourceRegistryService);
				const property = input('valid-unresolved-alias');
				registry.register({ getType: () => property.type, resolve: () => 'valid-unresolved-physical' });
				storageService.isConnected.mockReturnValue(mode !== 'disconnected');
				const result = await service.readLatestManyBounded(
					[property],
					mode === 'timed_out' ? { deadlineAt: new Date(0) } : {},
				);
				expect(result.items[0]).toEqual({
					propertyId: property.id,
					sourcePropertyId: 'valid-unresolved-physical',
					state: null,
					source: null,
					status: 'unprocessed',
				});
				expect(result).toMatchObject({
					storageStatus: mode,
					availableCount: 0,
					unknownCount: 1,
					unprocessedCount: 1,
					missingCount: 0,
					cacheCount: 0,
					storageCount: 0,
				});
				expect(storageService.queryStrict).not.toHaveBeenCalled();
			},
		);

		it('clears a lost unresolved source identity after the original held query fails without changing unprocessed accounting', async () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const property = input('failed-unresolved-alias');
			registry.register({ getType: () => property.type, resolve: () => 'failed-unresolved-original' });
			let fail: (reason: unknown) => void = () => {};
			storageService.queryStrict.mockImplementationOnce(
				() =>
					new Promise<unknown[]>((_resolve, reject) => {
						fail = reject;
					}),
			);
			const pending = service.readLatestManyBounded([property]);
			const originalFailure = new Error('Original held query failure');
			property.format = [0, 200];
			fail(originalFailure);
			const result = await pending;
			expect(result.items[0]).toEqual({
				propertyId: property.id,
				sourcePropertyId: null,
				state: null,
				source: null,
				status: 'unprocessed',
			});
			expect(result).toMatchObject({
				storageStatus: 'failed',
				availableCount: 0,
				unknownCount: 1,
				unprocessedCount: 1,
				missingCount: 0,
				cacheCount: 0,
				storageCount: 0,
			});
			expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
		});

		it('never invokes a substituted self verifier during the original policy check', async () => {
			const registry = module.get(PropertyValueSourceRegistryService);
			const property = input('self-verifier-alias');
			const originalOwn = nativeObjectEvidence.getOwnPropertyDescriptor(registry, 'isReadSourceStructurallyCurrent');
			const bVerifier = jest.fn(() => {
				throw new Error('Substituted verifier must not run');
			});
			let armed = false;
			// Observable negative API substitution, not an authority mock or a positive purity claim.
			registry.register({
				getType: () => property.type,
				resolve: () => {
					if (armed)
						Object.defineProperty(registry, 'isReadSourceStructurallyCurrent', {
							value: bVerifier,
							configurable: true,
						});
					return 'self-verifier-physical';
				},
			});
			let release: (rows: unknown[]) => void = () => {};
			storageService.queryStrict.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
			);
			const pending = service.readLatestManyBounded([property]);
			try {
				armed = true;
				release([{ propertyId: 'self-verifier-physical', numberValue: 10 }]);
				const result = await pending;
				expect(result.items[0]).toMatchObject({ sourcePropertyId: null, state: null, source: null });
				expect(bVerifier).not.toHaveBeenCalled();
				expect(service['valuesMap'].has('self-verifier-physical')).toBe(false);
			} finally {
				release([]);
				await pending.catch(() => undefined);
				if (originalOwn) Object.defineProperty(registry, 'isReadSourceStructurallyCurrent', originalOwn);
				else Reflect.deleteProperty(registry, 'isReadSourceStructurallyCurrent');
			}
		});
	});
});

/** Real registry observation only; this does not manufacture a creation/publication lease. */
describe('finite read-only creation producer observations', () => {
	const property = (id: string): ChannelPropertyEntity =>
		Object.assign(new ChannelPropertyEntity(), { id, dataType: DataTypeType.FLOAT });

	it('remembers absent B absent during a held continuation without owning or restoring B', async () => {
		const registry = new PropertyProducerRegistryService();
		const original = registry.beginCreationObservation(['p']);
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const resumed = held.then(() => registry.isCreationObservationCurrent(original));
		const b = registry.register(property('p'), 1);
		expect(registry.isCurrent(b)).toBe(true);
		registry.remove('p');
		expect(registry.owns('p')).toBe(false);
		release();
		expect(await resumed).toBe(false);
		expect(registry.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
		registry.closeCreationObservation(original);
		registry.closeCreationObservation(original);
		registry.onModuleDestroy();
	});

	it('refuses forged foreign closed and destroyed tokens and preserves unrelated identities', () => {
		const registry = new PropertyProducerRegistryService();
		const foreign = new PropertyProducerRegistryService();
		const original = registry.beginCreationObservation(['p']);
		expect(registry.isCreationObservationCurrent(new CreationProducerObservation())).toBe(false);
		expect(foreign.isCreationObservationCurrent(original)).toBe(false);
		registry.register(property('unrelated'), 1);
		expect(registry.isCreationObservationCurrent(original)).toBe(true);
		registry.closeCreationObservation(original);
		expect(registry.isCreationObservationCurrent(original)).toBe(false);
		const next = registry.beginCreationObservation(['p']);
		registry.onModuleDestroy();
		expect(registry.isCreationObservationCurrent(next)).toBe(false);
		expect(registry.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
		foreign.onModuleDestroy();
	});

	it('keeps original occupied identity false after same-object registration and leaves B untouched on close', () => {
		const registry = new PropertyProducerRegistryService();
		const row = property('p');
		const a = registry.register(row, 1);
		const original = registry.beginCreationObservation(['p']);
		const b = registry.register(row, 1);
		expect(registry.isCurrent(a)).toBe(false);
		expect(registry.isCreationObservationCurrent(original)).toBe(false);
		const state = registry.readDiagnosticState('p');
		registry.closeCreationObservation(original);
		expect(registry.isCurrent(b)).toBe(true);
		expect(registry.readDiagnosticState('p')).toEqual(state);
		registry.onModuleDestroy();
	});

	it('closes every fixed-ID membership on evaluation and validator replacement without publishing', () => {
		const registry = new PropertyProducerRegistryService();
		const lease = registry.register(property('p'), 1);
		const original = registry.beginCreationObservation(['p', 'absent']);
		registry.beginEvaluation(lease);
		expect(registry.isCreationObservationCurrent(original)).toBe(false);
		expect(registry.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
		const next = registry.beginCreationObservation(['absent']);
		registry.setEvidenceValidator(() => false);
		expect(registry.isCreationObservationCurrent(next)).toBe(false);
		expect(registry.isCurrent(lease)).toBe(true);
		registry.onModuleDestroy();
	});
	it('preserves original absence on a real no-entry metadata hint without creating a producer', () => {
		const events = new EventEmitter2();
		const registry = new PropertyProducerRegistryService(events);
		registry.onModuleInit();
		try {
			const original = registry.beginCreationObservation(['p']);
			expect(registry.owns('p')).toBe(false);
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, property('p'));
			expect(registry.isCreationObservationCurrent(original)).toBe(true);
			expect(registry.owns('p')).toBe(false);
			expect(registry.readCreationObservationCounts()).toEqual({ active: 1, observedIds: 1 });
			registry.closeCreationObservation(original);
			expect(registry.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
		} finally {
			registry.onModuleDestroy();
		}
	});

	it('still dirties an occupied observation before same-object metadata assignment and never revives it after removal or hints', () => {
		const events = new EventEmitter2();
		const registry = new PropertyProducerRegistryService(events);
		registry.onModuleInit();
		try {
			const row = property('p');
			const originalLease = registry.register(row, 1);
			const original = registry.beginCreationObservation(['p']);
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, row);
			expect(registry.isCreationObservationCurrent(original)).toBe(false);
			expect(registry.isCurrent(originalLease)).toBe(true);
			registry.remove('p');
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, row);
			expect(registry.isCreationObservationCurrent(original)).toBe(false);
			expect(registry.owns('p')).toBe(false);
			const absent = registry.beginCreationObservation(['p']);
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, property('unrelated'));
			expect(registry.isCreationObservationCurrent(absent)).toBe(true);
			const successor = registry.register(row, 1);
			registry.remove('p');
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, row);
			expect(registry.isCreationObservationCurrent(absent)).toBe(false);
			expect(registry.isCurrent(successor)).toBe(false);
			expect(registry.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
		} finally {
			registry.onModuleDestroy();
		}
	});

	it('keeps accepted publisher batch invalidation on absent hints while creation absence remains independent', () => {
		const events = new EventEmitter2();
		const registry = new PropertyProducerRegistryService(events);
		const source = new SqliteDataSource({ type: 'sqlite', database: ':memory:' });
		const graph = new VirtualDependencyGraphService(source);
		registry.onModuleInit();
		try {
			const publisher = registry.acquireOwnedPublisher('virtual-producer-state:v1', events);
			if (!publisher) throw new Error('Missing actual publisher owner');
			const lifecycle = graph.captureOwnedPublicationLifecycle();
			const batch = registry.beginObservedBatch(publisher, ['p'], lifecycle.guard);
			const original = registry.beginCreationObservation(['p']);
			expect(registry.isObservedBatchCurrent(batch)).toBe(true);
			expect(lifecycle.guard.isCurrent()).toBe(false); // Staging identity is not runtime readiness.
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, property('unrelated'));
			expect(registry.isObservedBatchCurrent(batch)).toBe(true);
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, property('p'));
			expect(registry.isObservedBatchCurrent(batch)).toBe(false);
			expect(registry.isCreationObservationCurrent(original)).toBe(true);
			expect(registry.owns('p')).toBe(false);
			expect(source.isInitialized).toBe(false);
			registry.closeCreationObservation(original);
			registry.disposeOwnedPublisher(publisher);
		} finally {
			registry.onModuleDestroy();
		}
	});

	it('forwards real ordinary commit and invalidation mutations without borrowing their synthetic unit-test quality as creation authority', () => {
		const registry = new PropertyProducerRegistryService();
		try {
			const lease = registry.register(property('p'), 1);
			const evaluation = registry.beginEvaluation(lease);
			if (!evaluation) throw new Error('Missing actual evaluation');
			const original = registry.beginCreationObservation(['p']);
			const now = new Date();
			expect(
				registry.commit(
					lease,
					new PropertyValueState(1, now.toISOString()),
					{
						quality: 'good',
						reasons: [],
						sampledAt: now,
						evaluatedAt: now,
						expiresAt: new Date(now.getTime() + 60000),
					},
					evaluation.epoch,
					evaluation.generation,
				),
			).toBe(true);
			expect(registry.isCreationObservationCurrent(original)).toBe(false);
			const next = registry.beginCreationObservation(['p']);
			expect(registry.invalidate(lease, ['unit-negative'])).toBe(true);
			expect(registry.isCreationObservationCurrent(next)).toBe(false);
			expect(registry.isCurrent(lease)).toBe(true);
		} finally {
			registry.onModuleDestroy();
		}
	});

	it('never gives creation the accepted publisher self-exemption during a real event-free owned install', () => {
		const events = new EventEmitter2();
		const registry = new PropertyProducerRegistryService(events);
		const source = new SqliteDataSource({ type: 'sqlite', database: ':memory:' });
		const graph = new VirtualDependencyGraphService(source);
		registry.onModuleInit();
		try {
			const publisher = registry.acquireOwnedPublisher('virtual-producer-state:v1', events);
			if (!publisher) throw new Error('Missing actual publisher owner');
			const lifecycle = graph.captureOwnedPublicationLifecycle();
			const batch = registry.beginObservedBatch(publisher, ['p'], lifecycle.guard);
			const expected = registry.captureExpectedSlot(batch, 'p');
			const original = registry.beginCreationObservation(['p']);
			const prepared = registry.prepareOwnedBatch(batch, {
				revision: 0,
				configurationRevisions: [],
				operations: [
					{
						kind: 'unavailable',
						propertyId: 'p',
						property: property('p'),
						expected,
						revision: 1,
						reason: 'runtime_unavailable',
					},
				],
			});
			expect(registry.installPreparedNoEvents(prepared)).toBe(true);
			expect(registry.isObservedBatchCurrent(batch)).toBe(true);
			expect(registry.isCreationObservationCurrent(original)).toBe(false);
			const state = registry.readDiagnosticState('p');
			registry.closeCreationObservation(original);
			expect(registry.readDiagnosticState('p')).toEqual(state);
			expect(lifecycle.guard.isCurrent()).toBe(false); // No ready/installed/physical authority is claimed.
		} finally {
			registry.onModuleDestroy();
		}
	});
});

describe('finite readonly existing-controller diagnostic observations', () => {
	const fixture = async () => {
		const database = new SqliteDataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		const events = new EventEmitter2();
		const module = await Test.createTestingModule({
			providers: [
				PropertyValueService,
				PropertyValueLockService,
				PropertyValueSourceRegistryService,
				PropertyProducerRegistryService,
				StorageService,
				{ provide: DataSource, useValue: database },
				{ provide: EventEmitter2, useValue: events },
				{ provide: NestConfigService, useValue: new NestConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }) },
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: () =>
							Object.assign(new StorageConfigModel(), { primaryStorage: 'finite-diagnostic-storage' }),
					},
				},
			],
		}).compile();
		const storage = module.get(StorageService);
		let queries = 0,
			writes = 0;
		const plugin: StoragePlugin = {
			name: 'finite-diagnostic-storage',
			initialize: () => Promise.resolve(),
			destroy: () => Promise.resolve(),
			isAvailable: () => true,
			writePoints: () => {
				writes++;
				return Promise.resolve();
			},
			query: <T>() => {
				queries++;
				return Promise.resolve<T[]>([]);
			},
			queryRaw: <T>() => {
				queries++;
				return Promise.reject<T>(new Error('No raw diagnostic history'));
			},
			registerSchema: () => undefined,
			dropMeasurement: () => Promise.resolve(),
			getMeasurements: () => Promise.resolve([]),
		};
		storage.registerPlugin(plugin.name, plugin);
		const property = Object.assign(new ChannelPropertyEntity(), {
			id: 'finite-diagnostic-input',
			dataType: DataTypeType.FLOAT,
			invalid: null,
			format: null,
			step: null,
		});
		return {
			module,
			property,
			events,
			values: module.get(PropertyValueService),
			producers: module.get(PropertyProducerRegistryService),
			counts: () => ({ queries, writes }),
		};
	};
	it('keeps an initially absent original sample unavailable without history, writes or producer correction', async () => {
		const f = await fixture();
		const capture = f.values.captureDiagnosticSamples([f.property]);
		const event = jest.spyOn(f.events, 'emit');
		try {
			expect(f.values.evaluateDiagnosticSample(capture, f.property.id, 1000, 1000)).toEqual({
				sample: null,
				evidence: null,
			});
			expect(f.values.finishDiagnosticSamples(capture)).toBe(true);
			expect(f.counts()).toEqual({ queries: 0, writes: 0 });
			expect(event).not.toHaveBeenCalled();
		} finally {
			f.values.closeDiagnosticSamples(capture);
			event.mockRestore();
			await f.module.close();
		}
	});
	it('retains absent producer ABA loss while a finite observation lives, then drops only its own observation', async () => {
		const f = await fixture();
		const capture = f.values.captureDiagnosticSamples([f.property]);
		try {
			const lease = f.producers.register(f.property, 1);
			expect(f.producers.unregister(lease)).toBe(true);
			expect(f.values.diagnosticSamplesCurrent(capture)).toBe(false);
			expect(() => f.values.evaluateDiagnosticSample(capture, f.property.id, 1000, 1000)).toThrow();
			f.values.closeDiagnosticSamples(capture);
			const next = f.values.captureDiagnosticSamples([f.property]);
			try {
				expect(f.values.finishDiagnosticSamples(next)).toBe(true);
			} finally {
				f.values.closeDiagnosticSamples(next);
			}
			expect(f.counts()).toEqual({ queries: 0, writes: 0 });
		} finally {
			f.values.closeDiagnosticSamples(capture);
			await f.module.close();
		}
	});
	it('does not turn a retained unavailable producer into a cached physical report or emit an expiry correction', async () => {
		const f = await fixture();
		const lease = f.producers.register(f.property, 1);
		const capture = f.values.captureDiagnosticSamples([f.property]);
		const emit = jest.spyOn(f.events, 'emit');
		try {
			const version = f.producers.version(lease);
			expect(f.values.evaluateDiagnosticSample(capture, f.property.id, 1000, 1000)).toEqual({
				sample: null,
				evidence: null,
			});
			expect(f.producers.version(lease)).toBe(version);
			expect(emit).not.toHaveBeenCalled();
			expect(f.values.finishDiagnosticSamples(capture)).toBe(true);
		} finally {
			f.values.closeDiagnosticSamples(capture);
			emit.mockRestore();
			await f.module.close();
		}
	});
	it('observes an actual accepted provider report without further backend work and refuses a later accepted report as original A', async () => {
		const f = await fixture(),
			now = Date.now();
		// Synthetic provider packets are data for this real value service; this is not installed/send authority.
		await f.values.writeSampleWithState(f.property, 21, {
			sampledAt: new Date(now - 2),
			receivedAt: new Date(now - 1),
			provenance: 'live',
		});
		const capture = f.values.captureDiagnosticSamples([f.property]),
			before = f.counts();
		try {
			const observed = f.values.evaluateDiagnosticSample(capture, f.property.id, 1000, now);
			expect(observed.sample).toMatchObject({
				propertyId: f.property.id,
				value: 21,
				provenance: 'live',
				quality: 'good',
			});
			expect(observed.evidence?.acceptanceGeneration).toBeGreaterThan(0);
			expect(f.counts()).toEqual(before);
			await f.values.writeSampleWithState(f.property, 22, {
				sampledAt: new Date(now - 1),
				receivedAt: new Date(now),
				provenance: 'live',
			});
			expect(f.values.diagnosticSamplesCurrent(capture)).toBe(false);
			expect(() => f.values.evaluateDiagnosticSample(capture, f.property.id, 1000, now)).toThrow('lost');
			expect(f.values.finishDiagnosticSamples(capture)).toBe(false);
			expect(f.counts().queries).toBe(0);
		} finally {
			f.values.closeDiagnosticSamples(capture);
			await f.module.close();
		}
	});
	it('refuses an original absent source after genuine registration without invoking the successor policy', async () => {
		const f = await fixture(),
			registry = f.module.get(PropertyValueSourceRegistryService);
		const capture = f.values.captureDiagnosticSamples([f.property]);
		let successorCalls = 0;
		const source: IPropertyValueSource = {
			getType: () => f.property.type,
			resolve: (row) => row.id,
			unavailableReason: () => {
				successorCalls++;
				return null;
			},
		};
		try {
			expect(registry.register(source)).toBe(true);
			expect(f.values.diagnosticSamplesCurrent(capture)).toBe(false);
			expect(() => f.values.evaluateDiagnosticSample(capture, f.property.id, 1000, Date.now())).toThrow('lost');
			expect(successorCalls).toBe(0);
			expect(f.counts()).toEqual({ queries: 0, writes: 0 });
		} finally {
			f.values.closeDiagnosticSamples(capture);
			await f.module.close();
		}
	});
	it('pins the original source policy method and never dispatches a held A observation to a same-object replacement', async () => {
		const f = await fixture(),
			registry = f.module.get(PropertyValueSourceRegistryService);
		const source: IPropertyValueSource = {
			getType: () => f.property.type,
			resolve: (row) => row.id,
			unavailableReason: () => null,
		};
		expect(registry.register(source)).toBe(true);
		const capture = f.values.captureDiagnosticSamples([f.property]);
		let replacementCalls = 0;
		try {
			source.unavailableReason = () => {
				replacementCalls++;
				return null;
			};
			expect(() => f.values.evaluateDiagnosticSample(capture, f.property.id, 1000, Date.now())).toThrow('lost');
			expect(replacementCalls).toBe(0);
			expect(f.values.finishDiagnosticSamples(capture)).toBe(false);
			expect(f.counts()).toEqual({ queries: 0, writes: 0 });
		} finally {
			f.values.closeDiagnosticSamples(capture);
			await f.module.close();
		}
	});

	it('bounds a LOCAL publication observation to its original absent producer slot and remembers register/remove ABA without touching B', async () => {
		const f = await fixture(),
			before = f.producers.readCreationObservationCounts();
		const observation = f.values.captureMutationPropertyObservation([f.property]);
		try {
			expect(observation.isCurrent()).toBe(true);
			expect(() => observation.check()).not.toThrow();
			const successor = f.producers.register(f.property, 1);
			expect(f.producers.unregister(successor)).toBe(true);
			expect(observation.isCurrent()).toBe(false);
			expect(() => observation.check()).toThrow('lost');
			observation.close();
			expect(f.producers.readCreationObservationCounts()).toEqual(before);
			expect(f.counts()).toEqual({ queries: 0, writes: 0 });
		} finally {
			observation.close();
			await f.module.close();
		}
	});
	it('checks only the original source policy before effects and permanently closes on a changed key without a replacement callback', async () => {
		const f = await fixture(),
			registry = f.module.get(PropertyValueSourceRegistryService);
		let key = f.property.id,
			replacementCalls = 0;
		const source: IPropertyValueSource = {
			getType: () => f.property.type,
			resolve: () => key,
			unavailableReason: () => null,
		};
		expect(registry.register(source)).toBe(true);
		const before = f.producers.readCreationObservationCounts(),
			observation = f.values.captureMutationPropertyObservation([f.property]);
		try {
			key = 'changed canonical series';
			expect(() => observation.check()).toThrow('lost');
			key = f.property.id;
			expect(observation.isCurrent()).toBe(false);
			source.resolve = () => {
				replacementCalls++;
				return key;
			};
			expect(() => observation.check()).toThrow('lost');
			expect(replacementCalls).toBe(0);
			observation.close();
			expect(f.producers.readCreationObservationCounts()).toEqual(before);
			expect(f.counts()).toEqual({ queries: 0, writes: 0 });
		} finally {
			observation.close();
			await f.module.close();
		}
	});
});
