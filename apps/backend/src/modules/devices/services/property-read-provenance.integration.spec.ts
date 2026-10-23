import { randomUUID } from 'node:crypto';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	VirtualChannelPropertyEntity,
	VirtualValueOrigin,
} from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualDependencyGraphService } from '../../../plugins/devices-virtual/services/virtual-dependency-graph.service';
import { VirtualValueSourceService } from '../../../plugins/devices-virtual/services/virtual-value-source.service';
import { type StorageBackendBinding, StorageService } from '../../storage/services/storage.service';
import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';

import { PropertyProducerRegistryService } from './property-producer.registry.service';
import { PropertyValueLockService } from './property-value-lock.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

interface Row {
	propertyId: string;
	numberValue?: number;
	stringValue?: string;
	time?: Date;
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

describe('single-property read provenance with hydrated entities', () => {
	let database: SqliteDataSource;
	let physicalId: string, projectionId: string;
	let physical: ChannelPropertyEntity, projection: VirtualChannelPropertyEntity;
	let registry: PropertyValueSourceRegistryService;
	let source: VirtualValueSourceService;
	let graph: VirtualDependencyGraphService;
	let producers: PropertyProducerRegistryService;
	let values: PropertyValueService;
	const binding = {} as StorageBackendBinding;
	let storage: {
		isConnected: jest.Mock<boolean, []>;
		query: jest.Mock<Promise<Row[]>, [string]>;
		queryStrict: jest.Mock<Promise<Row[]>, [string]>;
		queryActiveStrictBound: jest.Mock<Promise<{ rows: Row[]; binding: StorageBackendBinding }>, [string]>;
		flushQueuedWrites: jest.Mock<Promise<void>, []>;
		writePoints: jest.Mock;
	};

	beforeAll(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		const deviceId = randomUUID(),
			channelId = randomUUID();
		physicalId = randomUUID();
		projectionId = randomUUID();
		await database
			.getRepository(DeviceEntity)
			.insert({ id: deviceId, name: 'Sensor', category: DeviceCategory.SENSOR });
		await database.getRepository(ChannelEntity).insert({
			id: channelId,
			device: deviceId,
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
		});
		const metadata = {
			channel: channelId,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			format: [0, 100],
		};
		await database.getRepository(ChannelPropertyEntity).insert({ ...metadata, id: physicalId });
		await database.getRepository(VirtualChannelPropertyEntity).insert({
			...metadata,
			id: projectionId,
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: physicalId,
		});
	});

	beforeEach(async () => {
		physical = await database.getRepository(ChannelPropertyEntity).findOneOrFail({
			where: { id: physicalId },
			relations: ['channel', 'channel.device'],
		});
		projection = await database.getRepository(VirtualChannelPropertyEntity).findOneOrFail({
			where: { id: projectionId },
			relations: ['channel', 'channel.device', 'sourceProperty'],
		});
		registry = new PropertyValueSourceRegistryService();
		graph = new VirtualDependencyGraphService(database);
		await graph.refreshQuarantine();
		source = new VirtualValueSourceService(graph);
		registry.register(source);
		storage = {
			isConnected: jest.fn(() => true),
			query: jest.fn<Promise<Row[]>, [string]>().mockResolvedValue([]),
			queryStrict: jest.fn<Promise<Row[]>, [string]>().mockResolvedValue([]),
			queryActiveStrictBound: jest
				.fn<Promise<{ rows: Row[]; binding: StorageBackendBinding }>, [string]>()
				.mockResolvedValue({ rows: [], binding }),
			flushQueuedWrites: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
			writePoints: jest.fn().mockResolvedValue(undefined),
		};
		producers = new PropertyProducerRegistryService();
		values = new PropertyValueService(
			storage as unknown as StorageService,
			registry,
			new PropertyValueLockService({} as never),
			producers,
		);
	});

	afterEach(() => {
		producers.onModuleDestroy();
		jest.restoreAllMocks();
	});
	afterAll(async () => {
		if (database?.isInitialized) await database.destroy();
	});

	const rows = (): Row[] => [
		{ propertyId: physicalId, numberValue: 21, time: new Date('2026-10-23T12:00:00Z') },
		{ propertyId: physicalId, numberValue: 19 },
	];
	const assertClosed = () => {
		const captures = jest.spyOn(registry, 'captureReadSource');
		const closes = jest.spyOn(registry, 'closeReadSource');
		return () => {
			expect(captures).toHaveBeenCalled();
			for (const result of captures.mock.results) {
				if (result.type !== 'return') continue;
				expect(closes).toHaveBeenCalledWith(result.value);
				expect(registry.isReadSourceCurrent(result.value)).toBe(false);
			}
		};
	};

	it('loads real ordinary and projected entities, retains cold/cache/durable routes and closes captures', async () => {
		expect(physical).toBeInstanceOf(ChannelPropertyEntity);
		expect(projection).toBeInstanceOf(VirtualChannelPropertyEntity);
		expect(projection.sourceProperty).toBeInstanceOf(ChannelPropertyEntity);
		const closed = assertClosed();
		storage.query.mockResolvedValue(rows());
		await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 21, trend: 'rising' });
		await expect(values.readLatestStrict(projection)).resolves.toMatchObject({ value: 21 });
		expect(storage.query).toHaveBeenCalledTimes(1);
		expect(storage.queryStrict).not.toHaveBeenCalled();
		storage.queryActiveStrictBound.mockResolvedValue({ rows: rows(), binding });
		await expect(values.readLatestPersistedSnapshot(projection)).resolves.toMatchObject({
			state: { value: 21 },
			storageBinding: binding,
		});
		expect(storage.queryActiveStrictBound).toHaveBeenCalledWith(expect.stringContaining(physicalId));
		closed();
	});

	it.each(['remap', 'data type', 'array', 'policy', 'method'] as const)(
		'rejects held strict rows after %s changes without inserting stale cache',
		async (change) => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestStrict(projection);
			expect(storage.queryStrict).toHaveBeenCalledTimes(1);
			const rejection = expect(pending).rejects.toThrow('source changed during read');
			if (change === 'remap') projection.sourcePropertyId = randomUUID();
			if (change === 'data type') projection.dataType = DataTypeType.STRING;
			if (change === 'array') (projection.format as number[])[1] = 1000;
			if (change === 'policy') graph.invalidateValidation();
			if (change === 'method') source.resolve = () => physicalId;
			held.resolve(rows());
			await rejection;
			storage.query.mockResolvedValue([]);
			await expect(values.readLatest(physical)).resolves.toBeNull();
			expect(storage.query).toHaveBeenCalledTimes(1);
			await values.write(physical, 22);
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 22, trend: null });
			closed();
		},
	);

	it.each(['rows', 'error'])('does not overlay a successor producer on old %s', async (settlement) => {
		const held = deferred<Row[]>();
		storage.queryStrict.mockReturnValueOnce(held.promise);
		const pending = values.readLatestStrict(projection);
		const primary = new Error('original storage failure');
		const rejection =
			settlement === 'error'
				? expect(pending).rejects.toBe(primary)
				: expect(pending).rejects.toThrow('source changed during read');
		projection.sourcePropertyId = 'successor';
		const successor = Object.assign(new ChannelPropertyEntity(), { id: 'successor' });
		const lease = producers.register(successor, 1);
		producers.commit(
			lease,
			new PropertyValueState(99),
			{
				quality: 'good',
				reasons: [],
				sampledAt: new Date(),
				evaluatedAt: new Date(),
				expiresAt: new Date(Date.now() + 60000),
			},
			producers.version(lease),
		);
		expect(producers.read('successor')).toMatchObject({ value: 99 });
		if (settlement === 'error') held.reject(primary);
		else held.resolve(rows());
		await rejection;
	});

	it('returns null for stale best-effort settlement and closes its capture', async () => {
		const closed = assertClosed();
		const held = deferred<Row[]>();
		storage.query.mockReturnValueOnce(held.promise);
		const pending = values.readLatest(physical);
		physical.dataType = DataTypeType.BOOL;
		held.resolve(rows());
		await expect(pending).resolves.toBeNull();
		closed();
	});

	it.each([false, true])(
		'does not clear existing cache after stale empty durable result (new write=%s)',
		async (write) => {
			await values.write(physical, 10);
			const entered = deferred<void>();
			const held = deferred<{ rows: Row[]; binding: StorageBackendBinding }>();
			storage.queryActiveStrictBound.mockImplementationOnce(() => {
				entered.resolve();
				return held.promise;
			});
			const pending = values.readLatestPersisted(projection);
			const rejection = expect(pending).rejects.toThrow('source changed during read');
			await entered.promise;
			if (write) await values.write(physical, 42);
			projection.sourcePropertyId = randomUUID();
			held.resolve({ rows: [], binding });
			await rejection;
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: write ? 42 : 10 });
			expect(storage.query).not.toHaveBeenCalled();
		},
	);

	it.each([[], 'rows'] as const)(
		'preserves a newer cache write after unchanged durable settlement (%s)',
		async (result) => {
			const entered = deferred<void>();
			const held = deferred<{ rows: Row[]; binding: StorageBackendBinding }>();
			storage.queryActiveStrictBound.mockImplementationOnce(() => {
				entered.resolve();
				return held.promise;
			});
			const pending = values.readLatestPersisted(physical);
			await entered.promise;
			await values.write(physical, 42);
			held.resolve({ rows: result === 'rows' ? rows() : [], binding });
			await expect(pending).resolves.toEqual(result === 'rows' ? expect.objectContaining({ value: 21 }) : null);
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 42 });
		},
	);

	it('captures before durable flush and refuses to query a remapped route afterwards', async () => {
		const closed = assertClosed();
		const held = deferred<void>();
		storage.flushQueuedWrites.mockReturnValueOnce(held.promise);
		const pending = values.readLatestPersistedSnapshot(projection);
		const rejection = expect(pending).rejects.toThrow('source changed during read');
		projection.sourcePropertyId = randomUUID();
		held.resolve();
		await rejection;
		expect(storage.queryActiveStrictBound).not.toHaveBeenCalled();
		closed();
	});

	it.each([new Error('storage primary'), null, undefined, false, 0, 'storage primary'])(
		'preserves primary strict rejection and cleanup when routing also changes (%p)',
		async (error: unknown) => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestStrict(projection);
			const rejection = expect(pending).rejects.toBe(error);
			projection.dataType = DataTypeType.BOOL;
			held.reject(error);
			await rejection;
			closed();
		},
	);

	it('keeps best-effort storage errors contained and closes captures on disconnected/cache paths', async () => {
		const closed = assertClosed();
		storage.query.mockRejectedValueOnce(null);
		await expect(values.readLatest(physical)).resolves.toBeNull();
		storage.isConnected.mockReturnValue(false);
		await expect(values.readLatest(physical)).resolves.toBeNull();
		await expect(values.readLatestStrict(physical)).rejects.toThrow('storage is unavailable');
		closed();
	});

	it('preserves a falsy history-drain rejection, closes capture and never queries storage', async () => {
		const closed = assertClosed();
		storage.flushQueuedWrites.mockRejectedValueOnce(null);
		await expect(values.readLatestPersistedSnapshot(projection)).rejects.toBeNull();
		expect(storage.queryActiveStrictBound).not.toHaveBeenCalled();
		closed();
	});

	it('retains unavailable policy for unchanged projections without treating history as live authority', async () => {
		const closed = assertClosed();
		graph.invalidateValidation();
		await expect(values.readLatestStrict(projection)).resolves.toMatchObject({
			value: null,
			producer: { quality: 'unavailable', reasons: ['graph_validation_pending'] },
		});
		expect(storage.queryStrict).not.toHaveBeenCalled();
		closed();
	});

	it('retains current-route concurrent producer fallback on strict query failure', async () => {
		const closed = assertClosed();
		const held = deferred<Row[]>();
		storage.queryStrict.mockReturnValueOnce(held.promise);
		const pending = values.readLatestStrict(physical);
		const lease = producers.register(physical, 1);
		producers.commit(
			lease,
			new PropertyValueState(88),
			{
				quality: 'good',
				reasons: [],
				sampledAt: new Date(),
				evaluatedAt: new Date(),
				expiresAt: new Date(Date.now() + 60000),
			},
			producers.version(lease),
		);
		held.reject(new Error('storage failed'));
		await expect(pending).resolves.toMatchObject({ value: 88 });
		await expect(values.readLatestStrict(physical)).resolves.toMatchObject({ value: 88 });
		expect(storage.queryStrict).toHaveBeenCalledTimes(1);
		closed();
	});
});
