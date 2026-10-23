import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	VirtualChannelPropertyEntity,
	VirtualValueOrigin,
} from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualDependencyGraphService } from '../../../plugins/devices-virtual/services/virtual-dependency-graph.service';
import { VirtualValueSourceService } from '../../../plugins/devices-virtual/services/virtual-value-source.service';
import { ConfigService } from '../../config/services/config.service';
import { HOME_CURRENT_STATE_PROFILE_BUDDY_V1 } from '../../home-context/home-context.constants';
import { HomeCurrentStateQueryService } from '../../home-context/services/home-current-state-query.service';
import { StoragePlugin } from '../../storage/interfaces/storage-plugin.interface';
import { type StorageBackendBinding, StorageService } from '../../storage/services/storage.service';
import { StorageQueryOptions } from '../../storage/storage.types';
import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';

import { ChannelsPropertiesService } from './channels.properties.service';
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

describe('property read provenance with hydrated entities', () => {
	let database: SqliteDataSource;
	let physicalId: string, projectionId: string, coldId: string;
	let physical: ChannelPropertyEntity, cold: ChannelPropertyEntity, projection: VirtualChannelPropertyEntity;
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
		coldId = randomUUID();
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
		await database.getRepository(ChannelPropertyEntity).insert([
			{ ...metadata, id: physicalId },
			{ ...metadata, id: coldId },
		]);
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
		cold = await database.getRepository(ChannelPropertyEntity).findOneByOrFail({ id: coldId });
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
				expect(closes.mock.calls.filter(([capture]) => capture === result.value)).toHaveLength(1);
				expect(registry.isReadSourceCurrent(result.value)).toBe(false);
			}
		};
	};

	it('loads real ordinary and projected entities, retains cold/cache/durable routes and closes captures', async () => {
		expect(physical).toBeInstanceOf(ChannelPropertyEntity);
		expect(projection).toBeInstanceOf(VirtualChannelPropertyEntity);
		expect(projection.sourceProperty).toBeInstanceOf(ChannelPropertyEntity);
		const closed = assertClosed();
		const coldValues = new PropertyValueService(
			storage as unknown as StorageService,
			registry,
			new PropertyValueLockService({} as never),
		);
		storage.queryStrict.mockResolvedValueOnce(rows());
		await expect(coldValues.readLatestStrict(projection)).resolves.toMatchObject({ value: 21, trend: 'rising' });
		expect(storage.queryStrict).toHaveBeenCalledTimes(1);
		expect(storage.queryStrict).toHaveBeenCalledWith(expect.stringContaining(physicalId));
		expect(storage.queryStrict).not.toHaveBeenCalledWith(expect.stringContaining(projectionId));
		storage.queryStrict.mockClear();
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
		storage.query.mockResolvedValue([]);
		await expect(values.readLatest(physical)).resolves.toBeNull();
		expect(storage.query).toHaveBeenCalledTimes(2);
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

	it('retains existing cache after nonempty durable rows settle on a remapped projection', async () => {
		const closed = assertClosed();
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
		projection.sourcePropertyId = randomUUID();
		held.resolve({ rows: rows(), binding });
		await rejection;
		await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 10 });
		expect(storage.queryActiveStrictBound).toHaveBeenCalledTimes(1);
		expect(storage.query).not.toHaveBeenCalled();
		closed();
	});

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

	it.each<[unknown, string]>([
		[new Error('source capture failed'), 'source capture failed'],
		[null, 'null'],
		[undefined, 'undefined'],
		[false, 'false'],
		[0, '0'],
		['source capture failed', 'source capture failed'],
	])('logs best-effort source capture failures and preserves strict rejection (%p)', async (failure, message) => {
		registry.register({
			getType: () => physical.type,
			resolve: () => {
				throw failure;
			},
		});
		const log = jest.spyOn(Logger.prototype, 'error').mockClear();
		const produced = jest.spyOn(producers, 'read');
		await expect(values.readLatest(physical)).resolves.toBeNull();
		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining(`Failed to capture property value source error=${message}`),
			undefined,
			expect.objectContaining({ tag: 'devices-module' }),
		);
		log.mockClear();
		await expect(values.readLatestStrict(physical)).rejects.toBe(failure);
		expect(log).not.toHaveBeenCalled();
		expect(produced).not.toHaveBeenCalled();
		expect(storage.query).not.toHaveBeenCalled();
		expect(storage.queryStrict).not.toHaveBeenCalled();
	});

	it.each(['id', 'type'])('does not read refused own %s accessors when logging capture failure', async (field) => {
		const getter = jest.fn(() => {
			throw new Error('refused getter must not run');
		});
		Object.defineProperty(physical, field, { configurable: true, get: getter });
		const log = jest.spyOn(Logger.prototype, 'error').mockClear();
		const produced = jest.spyOn(producers, 'read');
		await expect(values.readLatest(physical)).resolves.toBeNull();
		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining('Value source input must have data fields'),
			undefined,
			expect.objectContaining({ tag: 'devices-module' }),
		);
		log.mockClear();
		await expect(values.readLatestStrict(physical)).rejects.toThrow('Value source input must have data fields');
		expect(log).not.toHaveBeenCalled();
		expect(getter).not.toHaveBeenCalled();
		expect(produced).not.toHaveBeenCalled();
		expect(storage.query).not.toHaveBeenCalled();
		expect(storage.queryStrict).not.toHaveBeenCalled();
	});

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

	describe('strict bulk source continuity', () => {
		it('deduplicates queried series while retaining each captured projection conversion and result key', async () => {
			const closed = assertClosed();
			projection.dataType = DataTypeType.INT;
			storage.queryStrict.mockResolvedValue([
				{ propertyId: physicalId, numberValue: 21.6, time: new Date('2026-10-23T12:00:00Z') },
				{ propertyId: physicalId, numberValue: 19 },
			]);
			const result = await values.readLatestManyStrict([physical, projection, projection, cold]);
			expect([...result.keys()]).toEqual([physicalId, projectionId, coldId]);
			expect(result.get(physicalId)).toMatchObject({ value: 21.6, trend: 'rising' });
			expect(result.get(projectionId)).toMatchObject({ value: 22, trend: 'rising' });
			expect(result.get(coldId)).toBeNull();
			expect(storage.queryStrict).toHaveBeenCalledTimes(1);
			const query = storage.queryStrict.mock.calls[0][0];
			expect(query.split(physicalId)).toHaveLength(2);
			expect(query).toContain(coldId);
			expect(query).not.toContain(projectionId);
			closed();
		});

		it('hydrates the real strict channel caller from loaded ordinary and virtual entities in one query', async () => {
			const closed = assertClosed();
			const repository = database.getRepository(ChannelPropertyEntity);
			const channels = new ChannelsPropertiesService(
				repository,
				{} as never,
				values,
				registry,
				{} as never,
				{} as never,
				{} as never,
				database,
				new EventEmitter2(),
			);
			storage.queryStrict.mockResolvedValue(rows());
			const channelId = (physical.channel as ChannelEntity).id;
			const result = await channels.findBoundedForChannels([channelId], 10, true);
			expect(result.totals[channelId]).toBe(3);
			expect(result.properties.find(({ id }) => id === physicalId)?.value).toMatchObject({ value: 21 });
			expect(result.properties.find(({ id }) => id === projectionId)).toBeInstanceOf(VirtualChannelPropertyEntity);
			expect(result.properties.find(({ id }) => id === projectionId)?.value).toMatchObject({ value: 21 });
			expect(result.properties.find(({ id }) => id === coldId)?.value).toBeNull();
			expect(storage.queryStrict).toHaveBeenCalledTimes(1);
			closed();
		});

		it.each(['remap', 'id', 'data type', 'array', 'descriptor', 'registration', 'policy', 'method'] as const)(
			'rejects the entire held batch after %s changes before any cache or trend admission',
			async (change) => {
				const closed = assertClosed();
				const held = deferred<Row[]>();
				storage.queryStrict.mockReturnValueOnce(held.promise);
				const pending = values.readLatestManyStrict([physical, projection, cold]);
				const rejection = expect(pending).rejects.toThrow('source changed during read');
				if (change === 'remap') projection.sourcePropertyId = randomUUID();
				if (change === 'id') projection.id = randomUUID();
				if (change === 'data type') projection.dataType = DataTypeType.STRING;
				if (change === 'array') (projection.format as number[])[1] = 1000;
				if (change === 'descriptor') Object.defineProperty(projection, 'dataType', { writable: false });
				if (change === 'registration') {
					expect(registry.register({ getType: () => physical.type, resolve: (input) => input.id })).toBe(true);
				}
				if (change === 'policy') graph.invalidateValidation();
				if (change === 'method') source.resolve = () => physicalId;
				held.resolve([...rows(), { propertyId: coldId, numberValue: 55 }]);
				await rejection;
				await expect(values.readLatest(physical)).resolves.toBeNull();
				await expect(values.readLatest(cold)).resolves.toBeNull();
				expect(storage.query).toHaveBeenCalledTimes(2);
				await values.write(physical, 22);
				await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 22, trend: null });
				closed();
			},
		);

		it('keeps the original route when duplicate provider registration is refused', async () => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyStrict([projection]);
			expect(registry.register(new VirtualValueSourceService(graph))).toBe(false);
			held.resolve(rows());
			expect((await pending).get(projectionId)).toMatchObject({ value: 21 });
			closed();
		});

		it.each([false, true])('fences an earlier cache hit on nonempty/empty settlement (empty=%s)', async (empty) => {
			const closed = assertClosed();
			await values.write(physical, 10);
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyStrict([projection, cold]);
			const rejection = expect(pending).rejects.toThrow('source changed during read');
			projection.sourcePropertyId = coldId;
			held.resolve(empty ? [] : [{ propertyId: coldId, numberValue: 55 }]);
			await rejection;
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 10 });
			await expect(values.readLatest(cold)).resolves.toBeNull();
			expect(storage.query).toHaveBeenCalledTimes(1);
			closed();
		});

		it.each([false, true])('keeps a concurrent write on nonempty/empty settlement (empty=%s)', async (empty) => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyStrict([physical, projection]);
			await values.write(physical, 25);
			held.resolve(empty ? [] : rows());
			const result = await pending;
			expect(result.get(physicalId)).toMatchObject({ value: 25, trend: null });
			expect(result.get(projectionId)).toMatchObject({ value: 25, trend: null });
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 25, trend: null });
			closed();
		});

		it('does not resurrect a series deleted while its query is pending', async () => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyStrict([physical, projection]);
			await values.delete(physical);
			held.resolve(rows());
			const result = await pending;
			expect(result.get(physicalId)).toBeNull();
			expect(result.get(projectionId)).toBeNull();
			await expect(values.readLatest(physical)).resolves.toBeNull();
			await values.write(physical, 22);
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 22, trend: null });
			closed();
		});

		it.each([new Error('primary storage error'), null, undefined, false, 0, ''])(
			'preserves the exact primary rejection %p after remap and closes every capture',
			async (primary) => {
				const closed = assertClosed();
				const held = deferred<Row[]>();
				storage.queryStrict.mockReturnValueOnce(held.promise);
				const pending = values.readLatestManyStrict([projection, cold]);
				const rejection = expect(pending).rejects.toBe(primary);
				projection.sourcePropertyId = coldId;
				producers.register(cold, 1);
				const read = jest.spyOn(producers, 'read');
				read.mockClear();
				held.reject(primary);
				await rejection;
				expect(read).not.toHaveBeenCalled();
				closed();
			},
		);

		it('never overlays a successor producer on a stale successful batch', async () => {
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyStrict([projection]);
			const rejection = expect(pending).rejects.toThrow('source changed during read');
			projection.sourcePropertyId = coldId;
			producers.register(cold, 1);
			const read = jest.spyOn(producers, 'read');
			read.mockClear();
			held.resolve(rows());
			await rejection;
			expect(read).not.toHaveBeenCalled();
		});

		it('rechecks current-route producer state after query success', async () => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyStrict([projection]);
			producers.register(physical, 2);
			held.resolve(rows());
			expect((await pending).get(projectionId)).toMatchObject({
				value: null,
				producer: { quality: 'unavailable', revision: 2 },
			});
			closed();
		});

		it('closes captures for cache, unavailable policy, disconnected storage and partial capture failure', async () => {
			const closed = assertClosed();
			await expect(values.readLatestManyStrict([])).resolves.toEqual(new Map());
			await values.write(physical, 10);
			await expect(values.readLatestManyStrict([projection])).resolves.toMatchObject(
				new Map([[projectionId, { value: 10 }]]),
			);
			graph.invalidateValidation();
			expect((await values.readLatestManyStrict([projection])).get(projectionId)).toMatchObject({
				value: null,
				producer: { reasons: ['graph_validation_pending'] },
			});
			storage.isConnected.mockReturnValue(false);
			await expect(values.readLatestManyStrict([physical, cold])).rejects.toThrow('storage is unavailable');
			const getter = jest.fn(() => coldId);
			Object.defineProperty(cold, 'id', { configurable: true, get: getter });
			await expect(values.readLatestManyStrict([physical, cold])).rejects.toThrow('data fields');
			expect(getter).not.toHaveBeenCalled();
			expect(storage.queryStrict).not.toHaveBeenCalled();
			closed();
		});
	});
	describe('bounded source continuity', () => {
		const unprocessed = (id: string, key: string | null) => ({
			propertyId: id,
			sourcePropertyId: key,
			status: 'unprocessed',
			source: null,
			state: null,
		});
		const mutate = (change: string) => {
			if (change === 'remap') projection.sourcePropertyId = coldId;
			if (change === 'id') projection.id = randomUUID();
			if (change === 'data type') projection.dataType = DataTypeType.STRING;
			if (change === 'array') (projection.format as number[])[1] = 1000;
			if (change === 'descriptor') Object.defineProperty(projection, 'dataType', { writable: false });
			if (change === 'policy') graph.invalidateValidation();
			if (change === 'method') source.resolve = () => physicalId;
			if (change === 'registration') registry.register({ getType: () => physical.type, resolve: (input) => input.id });
		};

		describe('bounded R1 refusal and final veto', () => {
			const commitColdProducer = (isCurrent: () => boolean) => {
				const lease = producers.register(cold, 3, { isCurrent, reason: 'owner_closed' });
				expect(
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
					),
				).toBe(true);
			};

			it('contains descriptor-throwing Proxy refusal between valid hydrated siblings', async () => {
				const closed = assertClosed();
				const opaque = new Proxy(projection, {
					getOwnPropertyDescriptor(target, key) {
						if (key === 'id') throw new Error('opaque ID descriptor');
						return Reflect.getOwnPropertyDescriptor(target, key);
					},
				});
				expect(opaque.id).toBe(projectionId);
				expect(opaque.type).toBe(projection.type);
				expect(opaque.dataType).toBe(projection.dataType);
				storage.queryStrict.mockResolvedValue([...rows(), { propertyId: coldId, numberValue: 55 }]);
				const result = await values.readLatestManyBounded([physical, opaque, cold]);
				expect(result.items[0]).toMatchObject({
					propertyId: physicalId,
					sourcePropertyId: physicalId,
					status: 'available',
					source: 'storage',
					state: { value: 21 },
				});
				expect(result.items[1]).toEqual(unprocessed('', null));
				expect(result.items[2]).toMatchObject({
					propertyId: coldId,
					sourcePropertyId: coldId,
					status: 'available',
					source: 'storage',
					state: { value: 55 },
				});
				expect(result).toMatchObject({
					requestedCount: 3,
					availableCount: 2,
					unknownCount: 1,
					unprocessedCount: 1,
					missingCount: 0,
					cacheCount: 0,
					storageCount: 2,
					storageStatus: 'failed',
					complete: false,
				});
				expect(storage.queryStrict).toHaveBeenCalledTimes(1);
				closed();
			});

			it.each(['sparse', 'undefined', 'null'] as const)(
				'contains a pre-existing malformed %s entry between valid siblings',
				async (kind) => {
					const closed = assertClosed();
					const properties = [physical, cold, cold];
					if (kind === 'sparse') Reflect.deleteProperty(properties, '1');
					else properties[1] = kind === 'null' ? null : undefined;
					storage.queryStrict.mockResolvedValue([...rows(), { propertyId: coldId, numberValue: 55 }]);
					const result = await values.readLatestManyBounded(properties);
					expect(result.items.map((item) => item.propertyId)).toEqual([physicalId, '', coldId]);
					expect(result.items[0]).toMatchObject({ status: 'available', state: { value: 21 } });
					expect(result.items[1]).toEqual(unprocessed('', null));
					expect(result.items[2]).toMatchObject({ status: 'available', state: { value: 55 } });
					expect(result).toMatchObject({
						requestedCount: 3,
						availableCount: 2,
						unknownCount: 1,
						unprocessedCount: 1,
						missingCount: 0,
						storageCount: 2,
						storageStatus: 'failed',
						complete: false,
					});
					closed();
				},
			);

			it('revalidates earlier cached A after B final real producer guard remaps A', async () => {
				const closed = assertClosed();
				await values.write(physical, 10);
				let armed = false,
					reads = 0;
				commitColdProducer(() => {
					if (armed && ++reads === 2) projection.sourcePropertyId = coldId;
					return true;
				});
				armed = true;
				const result = await values.readLatestManyBounded([projection, cold]);
				expect(projection.sourcePropertyId).toBe(coldId);
				expect(reads).toBe(2);
				expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
				expect(result.items[1]).toMatchObject({
					propertyId: coldId,
					sourcePropertyId: coldId,
					status: 'available',
					source: 'cache',
					state: { value: 99, producer: { quality: 'good', revision: 3 } },
				});
				expect(result).toMatchObject({
					requestedCount: 2,
					availableCount: 1,
					unknownCount: 1,
					unprocessedCount: 1,
					missingCount: 0,
					cacheCount: 1,
					storageCount: 0,
					storageStatus: 'not_needed',
					complete: false,
				});
				expect(storage.queryStrict).not.toHaveBeenCalled();
				await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 10 });
				closed();
			});

			it('structurally vetoes A remapped by a later B provider-currentness callback', async () => {
				const closed = assertClosed();
				await values.write(physical, 10);
				let armed = false,
					reads = 0,
					providerChecksAfterFinalProducer = 0;
				expect(
					registry.register({
						getType: () => cold.type,
						resolve: (input) => {
							if (input.id === coldId && reads === 2 && ++providerChecksAfterFinalProducer === 2)
								projection.sourcePropertyId = coldId;
							return input.id;
						},
					}),
				).toBe(true);
				commitColdProducer(() => {
					if (armed) reads++;
					return true;
				});
				armed = true;
				const result = await values.readLatestManyBounded([projection, cold]);
				expect(projection.sourcePropertyId).toBe(coldId);
				expect(providerChecksAfterFinalProducer).toBe(2);
				expect(reads).toBe(2);
				expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
				expect(result.items[1]).toMatchObject({
					propertyId: coldId,
					status: 'available',
					source: 'cache',
					state: { value: 99 },
				});
				expect(result).toMatchObject({
					requestedCount: 2,
					availableCount: 1,
					unprocessedCount: 1,
					complete: false,
					storageStatus: 'not_needed',
				});
				expect(storage.queryStrict).not.toHaveBeenCalled();
				closed();
			});
		});

		it('deduplicates real projections while retaining ordered duplicates and captured conversions', async () => {
			const closed = assertClosed();
			projection.dataType = DataTypeType.INT;
			storage.queryStrict.mockResolvedValue([{ propertyId: physicalId, numberValue: 21.6, time: new Date() }]);
			const result = await values.readLatestManyBounded([physical, projection, projection, cold]);
			expect(result.items.map((item) => [item.propertyId, item.sourcePropertyId, item.state?.value])).toEqual([
				[physicalId, physicalId, 21.6],
				[projectionId, physicalId, 22],
				[projectionId, physicalId, 22],
				[coldId, coldId, undefined],
			]);
			expect(result).toMatchObject({
				requestedCount: 4,
				availableCount: 3,
				missingCount: 1,
				storageCount: 4,
				storageStatus: 'available',
			});
			expect(storage.queryStrict).toHaveBeenCalledTimes(1);
			expect(storage.queryStrict.mock.calls[0][0].split(physicalId)).toHaveLength(2);
			expect(storage.queryStrict.mock.calls[0][0]).not.toContain(projectionId);
			closed();
		});

		it.each(['remap', 'id', 'data type', 'array', 'descriptor', 'policy', 'method'])(
			'refuses a held uncached %s route and preserves valid sibling results',
			async (change) => {
				const closed = assertClosed();
				const held = deferred<Row[]>();
				storage.queryStrict.mockReturnValueOnce(held.promise);
				const pending = values.readLatestManyBounded([projection, cold]);
				mutate(change);
				held.resolve([...rows(), { propertyId: coldId, numberValue: 55 }]);
				const result = await pending;
				expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
				expect(result.items[1]).toMatchObject({ propertyId: coldId, state: { value: 55 }, source: 'storage' });
				expect(result).toMatchObject({
					storageStatus: 'available',
					complete: false,
					availableCount: 1,
					unprocessedCount: 1,
					storageCount: 1,
				});
				await expect(values.readLatest(physical)).resolves.toBeNull();
				expect(storage.query).toHaveBeenCalledTimes(1);
				await values.write(physical, 22);
				await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 22, trend: null });
				closed();
			},
		);

		it.each(['remap', 'id', 'data type', 'array', 'descriptor', 'policy', 'method'])(
			'fences an earlier cache hit after held %s change without adopting a successor',
			async (change) => {
				const closed = assertClosed();
				await values.write(physical, 10);
				const held = deferred<Row[]>();
				storage.queryStrict.mockReturnValueOnce(held.promise);
				const pending = values.readLatestManyBounded([projection, cold]);
				mutate(change);
				producers.register(cold, 4);
				const read = jest.spyOn(producers, 'read');
				read.mockClear();
				held.resolve([]);
				const result = await pending;
				expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
				expect(result.items[1]).toMatchObject({
					propertyId: coldId,
					status: 'missing',
					state: { producer: { revision: 4 } },
				});
				expect(read.mock.calls.every(([key]) => key === coldId)).toBe(true);
				await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 10 });
				closed();
			},
		);

		it('fences an ordinary route when a provider claims its previously implicit registration', async () => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyBounded([physical, projection]);
			expect(registry.register({ getType: () => physical.type, resolve: () => coldId })).toBe(true);
			held.resolve(rows());
			const result = await pending;
			expect(result.items[0]).toEqual(unprocessed(physicalId, physicalId));
			expect(result.items[1]).toMatchObject({
				propertyId: projectionId,
				sourcePropertyId: physicalId,
				state: { value: 21 },
			});
			closed();
		});

		it('admits a shared source only through its remaining current projection', async () => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyBounded([projection, physical, projection]);
			projection.dataType = DataTypeType.BOOL;
			held.resolve(rows());
			const result = await pending;
			expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
			expect(result.items[1]).toMatchObject({ propertyId: physicalId, state: { value: 21, trend: 'rising' } });
			expect(result.items[2]).toEqual(unprocessed(projectionId, physicalId));
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 21 });
			closed();
		});

		it('rechecks a cache-only route after the real producer lifecycle callback remaps it', async () => {
			const closed = assertClosed();
			let armed = false,
				reads = 0;
			const lease = producers.register(physical, 2, {
				isCurrent: () => {
					if (armed && ++reads === 2) projection.sourcePropertyId = coldId;
					return true;
				},
				reason: 'owner_closed',
			});
			expect(
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
				),
			).toBe(true);
			armed = true;
			const result = await values.readLatestManyBounded([projection]);
			expect(reads).toBe(2);
			expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
			expect(result).toMatchObject({ storageStatus: 'not_needed', complete: false, unprocessedCount: 1 });
			expect(storage.queryStrict).not.toHaveBeenCalled();
			closed();
		});

		it('captures every original before the first producer read can remap a later route', async () => {
			const closed = assertClosed();
			jest.spyOn(producers, 'read').mockImplementationOnce(() => {
				projection.sourcePropertyId = coldId;
				return null;
			});
			storage.queryStrict.mockResolvedValue(rows());
			const result = await values.readLatestManyBounded([physical, projection]);
			expect(result.items[0]).toMatchObject({ state: { value: 21 } });
			expect(result.items[1]).toEqual(unprocessed(projectionId, physicalId));
			expect(storage.queryStrict.mock.calls[0][0]).not.toContain(coldId);
			closed();
		});

		it.each([false, true])('keeps concurrent writes after empty/nonempty rows (empty=%s)', async (empty) => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyBounded([physical, projection]);
			await values.write(physical, 25, new Date('2026-10-23T11:00:00Z'));
			held.resolve(empty ? [] : rows());
			const result = await pending;
			expect(result.items.every((item) => item.source === 'cache' && item.state?.value === 25)).toBe(true);
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 25, trend: null });
			closed();
		});

		it('does not resurrect deleted series or trends while its query is pending', async () => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const pending = values.readLatestManyBounded([physical, projection]);
			await values.delete(physical);
			held.resolve(rows());
			expect((await pending).items).toEqual([
				unprocessed(physicalId, physicalId),
				unprocessed(projectionId, physicalId),
			]);
			await expect(values.readLatest(physical)).resolves.toBeNull();
			await values.write(physical, 22);
			await expect(values.readLatest(physical)).resolves.toMatchObject({ value: 22, trend: null });
			closed();
		});

		it.each([new Error('bounded primary'), null, undefined, false, 0, ''])(
			'logs the primary diagnostic %p and retains valid cache without stale fallback',
			async (primary) => {
				const closed = assertClosed();
				const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
				await values.write(cold, 12);
				const held = deferred<Row[]>();
				storage.queryStrict.mockReturnValueOnce(held.promise);
				const pending = values.readLatestManyBounded([projection, cold]);
				projection.sourcePropertyId = coldId;
				held.reject(primary);
				const result = await pending;
				expect(result).toMatchObject({ storageStatus: 'failed', availableCount: 1, unprocessedCount: 1 });
				expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
				expect(result.items[1]).toMatchObject({ state: { value: 12 }, source: 'cache' });
				expect(log).toHaveBeenCalledWith(
					expect.stringContaining(`error=${primary instanceof Error ? primary.message : String(primary)}`),
					undefined,
					expect.objectContaining({ tag: 'devices-module' }),
				);
				closed();
			},
		);

		it('retains the original safe ID when capture itself changes the input and fails', async () => {
			const closed = assertClosed();
			jest.spyOn(graph, 'isQuarantined').mockImplementation((id) => {
				projection.id = randomUUID();
				return VirtualDependencyGraphService.prototype.isQuarantined.call(graph, id) as boolean;
			});
			const result = await values.readLatestManyBounded([physical, projection]);
			expect(result.items[1]).toEqual(unprocessed(projectionId, null));
			expect(projection.id).not.toBe(projectionId);
			expect(result).toMatchObject({ storageStatus: 'failed', unprocessedCount: 1, missingCount: 1 });
			closed();
		});

		it.each(['id', 'type'])('does not execute a refused own %s getter on capture failure', async (field) => {
			const closed = assertClosed();
			const getter = jest.fn(() => {
				throw new Error('must not run');
			});
			Object.defineProperty(projection, field, { configurable: true, get: getter });
			const result = await values.readLatestManyBounded([physical, projection]);
			expect(result.items[1]).toEqual(unprocessed(field === 'id' ? '' : projectionId, null));
			expect(getter).not.toHaveBeenCalled();
			closed();
		});

		it('closes partial captures on refusal, disconnected, expired, cache-only and unavailable-policy exits', async () => {
			const closed = assertClosed();
			const getter = jest.fn(() => DataTypeType.FLOAT);
			Object.defineProperty(cold, 'dataType', { configurable: true, get: getter });
			storage.isConnected.mockReturnValue(false);
			const refused = await values.readLatestManyBounded([physical, cold]);
			expect(refused.items).toEqual([unprocessed(physicalId, physicalId), unprocessed(coldId, null)]);
			expect(refused.storageStatus).toBe('disconnected');
			expect(getter).not.toHaveBeenCalled();
			const expired = await values.readLatestManyBounded([physical], { deadlineAt: new Date(0) });
			expect(expired).toMatchObject({ storageStatus: 'timed_out', unprocessedCount: 1 });
			await values.write(physical, 10);
			expect(await values.readLatestManyBounded([physical])).toMatchObject({
				storageStatus: 'not_needed',
				availableCount: 1,
			});
			graph.invalidateValidation();
			expect((await values.readLatestManyBounded([projection])).items[0]).toMatchObject({
				status: 'missing',
				state: { producer: { reasons: ['graph_validation_pending'] } },
			});
			expect(storage.queryStrict).not.toHaveBeenCalled();
			closed();
		});

		it.each(['failure', 'deadline', 'delete', 'write', 'stale'] as const)(
			'retains valid completed chunks and logical dispositions on later %s',
			async (ending) => {
				const repository = database.getRepository(ChannelPropertyEntity);
				const ids = Array.from({ length: 101 }, () => randomUUID());
				await repository.insert(
					ids.map((id) => ({
						id,
						channel: (physical.channel as ChannelEntity).id,
						category: PropertyCategory.TEMPERATURE,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
					})),
				);
				try {
					const loaded = await repository.findBy({ id: In(ids) });
					const properties = ids.map((id) => loaded.find((property) => property.id === id));
					const closed = assertClosed();
					const held = deferred<Row[]>();
					storage.queryStrict
						.mockResolvedValueOnce(
							ids.slice(0, 50).map((propertyId, index) => ({
								propertyId,
								numberValue: index,
								time: new Date('2026-10-23T12:00:00Z'),
							})),
						)
						.mockReturnValueOnce(held.promise)
						.mockResolvedValue([]);
					jest.useFakeTimers();
					try {
						const pending = values.readLatestManyBounded(properties);
						await jest.advanceTimersByTimeAsync(0);
						expect(storage.queryStrict).toHaveBeenCalledTimes(2);
						if (ending === 'deadline') await jest.advanceTimersByTimeAsync(750);
						else if (ending === 'failure') held.reject(new Error('second chunk failed'));
						else {
							if (ending === 'delete') await values.delete(properties[0]);
							if (ending === 'write') await values.write(properties[0], 99, new Date('2026-10-23T11:00:00Z'));
							if (ending === 'stale') properties[0].dataType = DataTypeType.BOOL;
							held.resolve([]);
						}
						const result = await pending;
						expect(result.items.map((item) => item.propertyId)).toEqual(ids);
						expect(result.items[1]).toMatchObject({ source: 'storage', state: { value: 1 } });
						if (ending === 'delete' || ending === 'stale') expect(result.items[0]).toEqual(unprocessed(ids[0], ids[0]));
						else
							expect(result.items[0]).toMatchObject({
								source: ending === 'write' ? 'cache' : 'storage',
								state: { value: ending === 'write' ? 99 : 0 },
							});
						if (ending === 'deadline' || ending === 'failure') {
							expect(result).toMatchObject({
								availableCount: 50,
								unprocessedCount: 51,
								storageCount: 50,
								storageStatus: ending === 'deadline' ? 'timed_out' : 'failed',
							});
							expect(result.items[100]).toEqual(unprocessed(ids[100], ids[100]));
							expect(storage.queryStrict).toHaveBeenCalledTimes(2);
						} else {
							expect(result.items[100]).toMatchObject({ status: 'missing', source: 'storage' });
							expect(storage.queryStrict).toHaveBeenCalledTimes(3);
						}
						for (const [query] of storage.queryStrict.mock.calls)
							expect((query.match(/propertyId =/g) ?? []).length).toBeLessThanOrEqual(50);
						closed();
						held.resolve([]);
						await jest.advanceTimersByTimeAsync(0);
						expect(jest.getTimerCount()).toBe(0);
					} finally {
						jest.useRealTimers();
					}
				} finally {
					await repository.delete(ids);
				}
			},
		);

		it.each(['fulfill', 'reject'] as const)(
			'bounds a real storage dispatch that ignores abort and consumes late %s',
			async (settlement) => {
				const closed = assertClosed();
				const held = deferred<Row[]>();
				const realStorage = new StorageService({
					getModuleConfig: () => ({ primaryStorage: 'primary', fallbackStorage: 'fallback' }),
				} as unknown as ConfigService);
				let signal: AbortSignal | undefined;
				const query = jest.fn((_sql: string, options?: StorageQueryOptions) => {
					signal = options?.signal;
					return held.promise;
				});
				const fallback = jest.fn().mockResolvedValue([]);
				realStorage.registerPlugin('primary', {
					name: 'primary',
					isAvailable: () => true,
					queryStrict: query,
				} as unknown as StoragePlugin);
				realStorage.registerPlugin('fallback', {
					name: 'fallback',
					isAvailable: () => true,
					queryStrict: fallback,
				} as unknown as StoragePlugin);
				const bounded = new PropertyValueService(
					realStorage,
					registry,
					new PropertyValueLockService({} as never),
					producers,
				);
				jest.useFakeTimers();
				try {
					const pending = bounded.readLatestManyBounded([projection], { deadlineAt: new Date(Date.now() + 30) });
					let settled = false;
					void pending.then(
						() => {
							settled = true;
						},
						() => {
							settled = true;
						},
					);
					await jest.advanceTimersByTimeAsync(29);
					expect(signal?.aborted).toBe(false);
					await jest.advanceTimersByTimeAsync(1);
					expect(settled).toBe(true);
					const result = await pending;
					expect(result).toMatchObject({ storageStatus: 'timed_out', unprocessedCount: 1 });
					expect(result.items[0]).toEqual(unprocessed(projectionId, physicalId));
					expect(signal?.aborted).toBe(true);
					closed();
					if (settlement === 'fulfill') held.resolve(rows());
					else held.reject(new Error('late backend rejection'));
					await jest.advanceTimersByTimeAsync(0);
					expect(fallback).not.toHaveBeenCalled();
					expect(query).toHaveBeenCalledTimes(1);
					expect(jest.getTimerCount()).toBe(0);
					closed();
				} finally {
					held.resolve([]);
					await jest.advanceTimersByTimeAsync(0);
					jest.useRealTimers();
					await realStorage.onApplicationShutdown();
				}
				// Same instance: no late cache/trend admission after closure.
				const queryAfterDeadline = jest.spyOn(realStorage, 'queryStrict').mockResolvedValue([]);
				await expect(bounded.readLatestStrict(physical)).resolves.toBeNull();
				expect(queryAfterDeadline).toHaveBeenCalledTimes(1);
			},
		);

		it.each(['fulfill', 'reject'] as const)(
			'treats exact-boundary %s as timeout even before the timer callback',
			async (settlement) => {
				const closed = assertClosed();
				const held = deferred<Row[]>();
				let signal: AbortSignal | undefined;
				storage.queryStrict.mockImplementationOnce((_query, options?: StorageQueryOptions) => {
					signal = options?.signal;
					return held.promise;
				});
				jest.useFakeTimers();
				try {
					const start = Date.now();
					const pending = values.readLatestManyBounded([projection], { deadlineAt: new Date(start + 10) });
					jest.setSystemTime(start + 10);
					if (settlement === 'fulfill') held.resolve(rows());
					else held.reject(null);
					expect(await pending).toMatchObject({ storageStatus: 'timed_out', unprocessedCount: 1 });
					expect(signal?.aborted).toBe(true);
					expect(jest.getTimerCount()).toBe(0);
					closed();
				} finally {
					jest.useRealTimers();
				}
				await expect(values.readLatest(physical)).resolves.toBeNull();
			},
		);

		it('propagates stale bounded input as unknown through the actual home-current-state caller', async () => {
			const closed = assertClosed();
			const held = deferred<Row[]>();
			storage.queryStrict.mockReturnValueOnce(held.promise);
			const caller = new HomeCurrentStateQueryService(
				{} as never,
				{
					findVisibleReadableStateCandidates: () => Promise.resolve({ properties: [projection, physical], total: 2 }),
				} as unknown as ChannelsPropertiesService,
				values,
			);
			const pending = caller.queryCurrentState({ profile: HOME_CURRENT_STATE_PROFILE_BUDDY_V1, operation: 'rows' });
			await Promise.resolve();
			expect(storage.queryStrict).toHaveBeenCalledTimes(1);
			projection.sourcePropertyId = coldId;
			held.resolve(rows());
			const result = await pending;
			expect(result).toMatchObject({
				evaluated: 1,
				unknown: 1,
				complete: false,
				storage_status: 'available',
				partial_reasons: ['unprocessed_values'],
			});
			expect(result.rows.map((row) => row.property_id)).toEqual([physicalId]);
			closed();
		});
	});
});
