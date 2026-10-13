import { instanceToPlain } from 'class-transformer';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddVirtualNumericTransforms1000000000029 } from '../../../migrations/1000000000029-AddVirtualNumericTransforms';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { ConfigureVirtualAggregateDto } from '../dto/producer-config.dto';
import { ConfigureVirtualTransformDto } from '../dto/transform-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualAggregateInputEntity, VirtualAggregateOperator } from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import { VirtualTransformMetadataSubscriber } from '../subscribers/virtual-transform-metadata.subscriber';

import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualTransformConfigService } from './virtual-transform-config.service';
import { VirtualTransformRuntimeService } from './virtual-transform-runtime.service';

jest.setTimeout(30000);
const base = Date.parse('2026-10-13T10:00:00Z');

describe('numeric transform real SQLite contract and runtime', () => {
	let directory: string;
	let database: SqliteDataSource;
	let graph: VirtualDependencyGraphService;
	let state: VirtualProducerStateService;
	let runtime: VirtualAggregateRuntimeService;
	let configs: VirtualProducerConfigService;
	let transforms: VirtualTransformConfigService;
	let transformRuntime: VirtualTransformRuntimeService;
	let values: PropertyValueService;
	let producers: PropertyProducerRegistryService;
	let events: EventEmitter2;
	let statuses: Map<string, ConnectionState>;
	let storage: {
		writePoints: jest.Mock;
		enqueueWritePoint: jest.Mock;
		flushQueuedWrites: jest.Mock;
		query: jest.Mock;
		isConnected: jest.Mock;
	};

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd2-aggregate-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'test.sqlite'),
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		database.subscribers.push({
			listenTo: () => ChannelPropertyEntity,
			afterLoad: (entity: ChannelPropertyEntity) => {
				entity.unit = resolvePropertyUnit(entity);
			},
		});
		new VirtualTransformMetadataSubscriber(database);
		jest.useFakeTimers({ now: base, doNotFake: ['nextTick', 'setImmediate'] });
		events = new EventEmitter2();
		producers = new PropertyProducerRegistryService(events);
		storage = {
			isConnected: jest.fn(() => true),
			writePoints: jest.fn().mockResolvedValue(undefined),
			enqueueWritePoint: jest.fn().mockResolvedValue(undefined),
			flushQueuedWrites: jest.fn().mockResolvedValue(undefined),
			query: jest.fn().mockResolvedValue([]),
		};
		values = new PropertyValueService(
			storage as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			producers,
			events,
		);
		graph = new VirtualDependencyGraphService(database);
		state = new VirtualProducerStateService(database, producers, graph, events);
		configs = new VirtualProducerConfigService(database, new DeviceStructureLockService(), graph, events, state);
		statuses = new Map();
		runtime = new VirtualAggregateRuntimeService(
			database,
			producers,
			values,
			{
				readLatest: (device: DeviceEntity) =>
					Promise.resolve({ status: statuses.get(device.id) ?? ConnectionState.UNKNOWN }),
			} as DeviceConnectionStateService,
			graph,
			events,
		);
		transformRuntime = new VirtualTransformRuntimeService(
			database,
			producers,
			values,
			{
				readLatest: (device: DeviceEntity) =>
					Promise.resolve({ status: statuses.get(device.id) ?? ConnectionState.UNKNOWN }),
			} as DeviceConnectionStateService,
			graph,
			events,
		);
		transforms = new VirtualTransformConfigService(
			database,
			new DeviceStructureLockService(),
			graph,
			events,
			state,
			transformRuntime,
		);
	});

	afterEach(async () => {
		runtime?.onModuleDestroy();
		transformRuntime?.onModuleDestroy();
		state?.onModuleDestroy();
		producers?.onModuleDestroy();
		jest.useRealTimers();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});

	const measurement = async (mode?: VirtualDeviceMode): Promise<ChannelPropertyEntity> => {
		const deviceId = uuid(),
			channelId = uuid(),
			id = uuid();
		await database.getRepository(mode ? VirtualDeviceEntity : DeviceEntity).insert({
			id: deviceId,
			name: 'Temperature',
			category: DeviceCategory.SENSOR,
			...(mode ? { mode } : {}),
		} as never);
		await database
			.getRepository(mode ? VirtualChannelEntity : ChannelEntity)
			.insert({ id: channelId, device: deviceId, name: 'Temperature', category: ChannelCategory.TEMPERATURE } as never);
		await database.getRepository(mode ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
			id,
			channel: channelId,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			...(mode ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
		} as never);
		return database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
	};
	const configure = async (
		output: ChannelPropertyEntity,
		sources: ChannelPropertyEntity[],
		minimumValidInputs = sources.length,
		revision = 0,
		operator = VirtualAggregateOperator.MEAN,
	) => {
		await configs.configureAggregate(
			output.id,
			Object.assign(new ConfigureVirtualAggregateDto(), {
				expectedRevision: revision,
				operator,
				minimumValidInputs,
				maximumAgeSeconds: 10,
				inputs: sources.map((source) => ({ sourcePropertyId: source.id })),
			}),
		);
		await runtime.flush();
	};
	const sample = async (property: ChannelPropertyEntity, value: number | null, sampledAt = Date.now()) => {
		await values.writeSampleWithState(property, value, {
			sampledAt: new Date(sampledAt),
			receivedAt: new Date(),
			provenance: 'live',
		});
		await transformRuntime.flush();
		await runtime.flush();
	};
	const start = async () => {
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		await transformRuntime.onApplicationBootstrap();
		await runtime.onApplicationBootstrap();
	};
	const outputState = (output: ChannelPropertyEntity) => producers.read(output.id);

	const dto = (source: ChannelPropertyEntity, revision = 0): ConfigureVirtualTransformDto =>
		Object.assign(new ConfigureVirtualTransformDto(), {
			schemaVersion: 1,
			expectedRevision: revision,
			maximumAgeSeconds: 10,
			quantity: PropertyCategory.TEMPERATURE,
			unit: '°C',
			source: { sourcePropertyId: source.id },
			policy: {
				operator: VirtualNumericTransformOperator.AFFINE,
				scale: 2,
				offset: 1,
				inputRange: { minimum: -100, maximum: 100 },
				outputRange: { minimum: -200, maximum: 200 },
			},
		});
	const transform = async (source: ChannelPropertyEntity, output: ChannelPropertyEntity, revision = 0) => {
		await transforms.configure(output.id, dto(source, revision));
		await transformRuntime.flush();
		await runtime.flush();
	};

	it('new aggregate evidence barriers ignore retained transformed output until a new physical acceptance', async () => {
		const raw = await measurement(),
			sibling = await measurement(),
			transformed = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await transforms.configure(transformed.id, dto(raw));
		await configure(aggregate, [transformed, sibling]);
		await start();
		await sample(raw, 10);
		await sample(sibling, 20);
		expect(outputState(aggregate)?.producer.quality).toBe('good');
		runtime.requireFreshInputs(aggregate.id, [
			{ sourceId: transformed.id, leafId: raw.id },
			{ sourceId: sibling.id, leafId: sibling.id },
		]);
		runtime.requestRecompute();
		await runtime.flush();
		expect(outputState(aggregate)?.value).toBeNull();
		transformRuntime.requestRecompute();
		await transformRuntime.flush();
		await runtime.flush();
		expect(outputState(aggregate)?.value).toBeNull();
		await sample(sibling, 20);
		expect(outputState(aggregate)?.value).toBeNull();
		jest.advanceTimersByTime(1000);
		await sample(raw, 10);
		expect(outputState(aggregate)?.producer.quality).toBe('good');
		expect(outputState(aggregate)?.value).toBe(20.5);
	});

	it('requires live source evidence, preserves source age and expires without renewing on evaluation', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		expect(outputState(output).value).toBeNull();
		jest.setSystemTime(base + 4000);
		await sample(source, 20, base + 1000);
		expect(outputState(output)).toMatchObject({
			value: 41,
			producer: {
				quality: 'good',
				sampledAt: new Date(base + 1000).toISOString(),
				expiresAt: new Date(base + 11000).toISOString(),
			},
		});
		jest.setSystemTime(base + 8000);
		transformRuntime.requestRecompute();
		await transformRuntime.flush();
		expect(outputState(output).producer.expiresAt).toBe(new Date(base + 11000).toISOString());
		jest.setSystemTime(base + 11000);
		expect(outputState(output).value).toBeNull();
		transformRuntime.requestRecompute();
		await transformRuntime.flush();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toContain('stale');
		expect(storage.writePoints).toHaveBeenCalledTimes(1);
	});

	it('revokes on null, domain errors, disabled and offline source while retaining history', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		await sample(source, null);
		expect(outputState(output).value).toBeNull();
		await database.manager.update(VirtualTransformConfigEntity, output.id, {
			policy: { ...dto(source).policy, inputRange: { minimum: -100, maximum: 30 } } as never,
		});
		jest.setSystemTime(base + 1);
		await sample(source, 40);
		expect(transformRuntime.readDiagnostics(output.id).reasons).toEqual(['input_out_of_range']);
		jest.setSystemTime(base + 2);
		await sample(source, 20);
		const device = (source.channel as ChannelEntity).device as DeviceEntity;
		statuses.set(device.id, ConnectionState.DISCONNECTED);
		events.emit(EventType.DEVICE_CONNECTION_CHANGED, { device, state: ConnectionState.DISCONNECTED });
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toEqual(['offline']);
		statuses.set(device.id, ConnectionState.CONNECTED);
		await database.manager.update(DeviceEntity, device.id, { enabled: false });
		events.emit(EventType.DEVICE_UPDATED, device);
		await transformRuntime.flush();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toEqual(['disabled']);
	});

	it('shares preview/write validation, enforces revisions and rolls back graph on invalid policy', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		const config = dto(source);
		const proposed = await transforms.preview(output.id, config);
		expect(proposed.revision).toBe(1);
		expect(await database.manager.count(VirtualTransformConfigEntity)).toBe(0);
		await transforms.configure(output.id, config);
		const graphRevision = await graph.revision();
		await expect(transforms.configure(output.id, config)).rejects.toThrow('revision');
		const bad = dto(source, 1);
		bad.policy.scale = Infinity;
		await expect(transforms.preview(output.id, bad)).rejects.toThrow('invalid_coefficients');
		await expect(transforms.configure(output.id, bad)).rejects.toThrow('invalid_coefficients');
		expect(await graph.revision()).toBe(graphRevision);
		const stale = dto(source, 1);
		stale.expectedGraphRevision = graphRevision - 1;
		await expect(transforms.preview(output.id, stale)).rejects.toThrow('graph revision');
		await expect(transforms.configure(output.id, stale)).rejects.toThrow('graph revision');
	});

	it('retains missing identity, remaps the same binding and cascades owned configuration', async () => {
		const source = await measurement(),
			replacement = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		const old = (await transforms.get(output.id)).source;
		await database.manager.delete(ChannelPropertyEntity, source.id);
		events.emit(EventType.CHANNEL_PROPERTY_DELETED, source);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		expect((await transforms.get(output.id)).source).toMatchObject({
			id: old.id,
			source_property: null,
			source_identity: source.id,
		});
		const remap = dto(replacement, 1);
		remap.source.id = old.id;
		await transforms.configure(output.id, remap);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(replacement, 22);
		expect(outputState(output)).toMatchObject({ value: 45, producer: { revision: 2 } });
		expect((await transforms.get(output.id)).source.id).toBe(old.id);
		await database.manager.delete(ChannelPropertyEntity, output.id);
		expect(await database.manager.count(VirtualTransformSourceEntity)).toBe(0);
		expect(await database.manager.count(VirtualTransformConfigEntity)).toBe(0);
	});

	it('fences old lease/config and waits for new evidence following a configuration edit', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		const lease = producers.register(output, 1),
			evaluation = producers.beginEvaluation(lease);
		jest.setSystemTime(base + 1000);
		const edited = dto(source, 1);
		edited.policy.scale = 3;
		await transforms.configure(output.id, edited);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await values.publishDerived(
			output,
			lease,
			999,
			{
				quality: 'good',
				reasons: [],
				sampledAt: new Date(base),
				evaluatedAt: new Date(),
				expiresAt: new Date(base + 10000),
			},
			evaluation,
		);
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output)).toMatchObject({ value: 61, producer: { revision: 2 } });
	});

	it('feeds an aggregate canonical temperature with bounded expiry and failure membership', async () => {
		const raw = await measurement(),
			physical = await measurement(),
			converted = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await transform(raw, converted);
		await configure(aggregate, [physical, converted]);
		await start();
		await sample(physical, 21);
		await sample(raw, 10);
		expect(outputState(aggregate)).toMatchObject({
			value: 21,
			producer: { quality: 'good', expiresAt: new Date(base + 10000).toISOString() },
		});
		await sample(raw, null);
		expect(outputState(converted).value).toBeNull();
		expect(outputState(aggregate).value).toBeNull();
		expect(
			await database.manager.count(VirtualAggregateInputEntity, { where: { outputPropertyId: aggregate.id } }),
		).toBe(2);
		await sample(raw, 10);
		jest.setSystemTime(base + 10000);
		expect(outputState(aggregate).value).toBeNull();
	});

	it('refuses recursive or writable virtual inputs and native Celsius NTC conversion', async () => {
		const physical = await measurement(),
			upstream = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await expect(transforms.configure(output.id, dto(upstream))).rejects.toThrow('incompatible_source');
		const ntc = dto(physical);
		ntc.policy = {
			operator: VirtualNumericTransformOperator.NTC_BETA,
			inputRange: { minimum: 0.1, maximum: 3.2 },
			outputRange: { minimum: -50, maximum: 150 },
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			nominalResistance: 10000,
			nominalTemperatureCelsius: 25,
			beta: 3950,
			thermistorLeg: 'low',
		};
		await expect(transforms.configure(output.id, ntc)).rejects.toThrow('incompatible_ntc_semantics');
		await database.manager.update(ChannelPropertyEntity, physical.id, { category: PropertyCategory.VOLTAGE });
		await database.manager.update(ChannelEntity, (physical.channel as ChannelEntity).id, {
			category: ChannelCategory.ELECTRICAL_POWER,
		});
		await transforms.configure(output.id, ntc);
		await start();
		const voltage = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: physical.id },
			relations: ['channel', 'channel.device'],
		});
		await sample(voltage, 1.65);
		expect(outputState(output).value).toBeCloseTo(25);
	});

	it('migration and synchronization retain matching indexes, source nulling and owner cascades', async () => {
		await database.manager.query('DROP TABLE devices_virtual_transform_sources');
		await database.manager.query('DROP TABLE devices_virtual_transform_configs');
		const migration = new AddVirtualNumericTransforms1000000000029();
		const runner = database.createQueryRunner();
		await migration.up(runner);
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		const binding = await database.manager.findOneByOrFail(VirtualTransformSourceEntity, {
			outputPropertyId: output.id,
		});
		await expect(database.manager.insert(VirtualTransformSourceEntity, { ...binding, id: uuid() })).rejects.toThrow();
		await database.manager.delete(ChannelPropertyEntity, source.id);
		expect(await database.manager.findOneByOrFail(VirtualTransformSourceEntity, { id: binding.id })).toMatchObject({
			sourcePropertyId: null,
			sourcePropertyIdentity: source.id,
		});
		await database.manager.delete(ChannelPropertyEntity, output.id);
		expect(await database.manager.count(VirtualTransformConfigEntity)).toBe(0);
		await migration.down(runner);
		await migration.up(runner);
		await runner.release();
		const sourceTable = await database.createQueryRunner().getTable('devices_virtual_transform_sources');
		expect(sourceTable.foreignKeys.map((fk) => [fk.columnNames[0], fk.onDelete])).toEqual(
			expect.arrayContaining([
				['sourcePropertyId', 'SET NULL'],
				['outputPropertyId', 'CASCADE'],
			]),
		);
		expect(sourceTable.indices.map((index) => [index.name, index.isUnique])).toEqual(
			expect.arrayContaining([
				['UQ_virtual_transform_source_output', true],
				['IDX_virtual_transform_source', false],
			]),
		);
	});
	it('requires a new accepted packet after source metadata changes even within the same clock millisecond', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		await database.manager.update(ChannelPropertyEntity, source.id, { category: PropertyCategory.HUMIDITY });
		events.emit(EventType.CHANNEL_PROPERTY_UPDATED, source);
		expect(outputState(output).value).toBeNull();
		await transformRuntime.flush();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toContain('incompatible_source');
		await database.manager.update(ChannelPropertyEntity, source.id, { category: PropertyCategory.TEMPERATURE });
		events.emit(EventType.CHANNEL_PROPERTY_UPDATED, source);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output).value).toBe(41);
		await transform(source, output, 1);
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output).value).toBe(41);
	});

	it('refuses generic numeric temperature masquerading but supports explicit humidity conversion', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await database.manager.update(ChannelEntity, (output.channel as ChannelEntity).id, {
			category: ChannelCategory.HUMIDITY,
		});
		await database.manager.update(ChannelPropertyEntity, output.id, { category: PropertyCategory.HUMIDITY });
		await expect(transforms.configure(output.id, dto(source))).rejects.toThrow('incompatible_output');
		const humidity = dto(source);
		humidity.quantity = PropertyCategory.HUMIDITY;
		humidity.unit = '%';
		await transforms.configure(output.id, humidity);
		await start();
		await sample(source, 20);
		expect(outputState(output).value).toBe(41);
		const aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE),
			second = await measurement();
		await expect(configure(aggregate, [output, second])).rejects.toThrow('canonical transformed temperatures');
	});

	it('cannot resurrect a configuration after a real output history write finishes late', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		let release: () => void, started: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			started = resolve;
		});
		storage.writePoints.mockImplementationOnce(() => {
			started();
			return blocked;
		});
		await values.writeSampleWithState(source, 20, {
			sampledAt: new Date(base),
			receivedAt: new Date(base),
			provenance: 'live',
		});
		await entered;
		const edited = dto(source, 1);
		edited.policy.scale = 3;
		await transforms.configure(output.id, edited);
		expect(outputState(output)).toMatchObject({ value: null, producer: { revision: 2 } });
		release();
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output)).toMatchObject({ value: 61, producer: { revision: 2 } });
	});

	it('coalesces source bursts while unrelated traffic cannot restart its in-flight evaluation', async () => {
		const source = await measurement(),
			unrelated = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		const original = database.manager.findOne.bind(database.manager) as typeof database.manager.findOne;
		let release: () => void, started: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			started = resolve;
		});
		let blocked = false;
		const read = jest.spyOn(database.manager, 'findOne').mockImplementation(async (entity, options) => {
			if (entity === ChannelPropertyEntity && (options.where as { id?: string }).id === source.id && !blocked) {
				blocked = true;
				started();
				await gate;
			}
			return original(entity, options);
		});
		transformRuntime.requestRecompute();
		await entered;
		await values.writeSampleWithState(unrelated, 30, {
			sampledAt: new Date(base),
			receivedAt: new Date(base),
			provenance: 'live',
		});
		events.emit(EventType.DEVICE_CONNECTION_CHANGED, {
			device: (unrelated.channel as ChannelEntity).device,
			state: ConnectionState.DISCONNECTED,
		});
		jest.advanceTimersByTime(1000);
		release();
		await transformRuntime.flush();
		expect(
			read.mock.calls.filter(
				([entity, options]) => entity === ChannelPropertyEntity && (options.where as { id?: string }).id === source.id,
			),
		).toHaveLength(1);
		read.mockRestore();
		expect(outputState(output).value).toBe(41);
	});

	it('keeps restart history unavailable and CLI generation free of database/runtime access', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		transformRuntime.onModuleDestroy();
		runtime.onModuleDestroy();
		producers.onModuleDestroy();
		const restartedProducers = new PropertyProducerRegistryService(events);
		const restartedValues = new PropertyValueService(
			storage as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			restartedProducers,
			events,
		);
		const restartedRuntime = new VirtualTransformRuntimeService(
			database,
			restartedProducers,
			restartedValues,
			{
				readLatest: () => Promise.resolve({ status: ConnectionState.CONNECTED }),
			} as unknown as DeviceConnectionStateService,
			graph,
			events,
		);
		await restartedRuntime.onApplicationBootstrap();
		expect(restartedProducers.read(output.id).value).toBeNull();
		restartedRuntime.onModuleDestroy();
		restartedProducers.onModuleDestroy();
		const { ConfigService } = await import('@nestjs/config');
		const cli = new VirtualTransformRuntimeService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			new ConfigService({ FB_CLI: 'on' }),
		);
		await cli.onApplicationBootstrap();
		expect(cli.isActive()).toBe(false);
		cli.onModuleDestroy();
	});
	it('admits the ordinary derived authoring hook with an unhydrated channel reference', async () => {
		const output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		const property = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		const channelId = (output.channel as ChannelEntity).id;
		property.channel = channelId;
		const authoring = new VirtualDevicesService({} as never, {} as never, {} as never, {} as never, {} as never, graph);
		await expect(
			authoring.assertDerivedOutputSupported(property, channelId, database.manager),
		).resolves.toBeUndefined();
	});

	it('remaps a disabled owner without leaving its source index or freshness barrier on the old source', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(a, output);
		await start();
		await sample(a, 20);
		const owner = (output.channel as ChannelEntity).device as DeviceEntity;
		await database.manager.update(DeviceEntity, owner.id, { enabled: false });
		events.emit(EventType.DEVICE_UPDATED, owner);
		await transformRuntime.flush();
		await transform(b, output, 1);
		await sample(b, 30);
		expect(outputState(output).value).toBeNull();
		await database.manager.update(DeviceEntity, owner.id, { enabled: true });
		events.emit(EventType.DEVICE_UPDATED, owner);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(b, 30);
		expect(outputState(output).value).toBe(61);
	});
	const generic = async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await database.manager.update(ChannelEntity, (source.channel as ChannelEntity).id, {
			category: ChannelCategory.ELECTRICAL_POWER,
		});
		await database.manager.update(ChannelPropertyEntity, source.id, { category: PropertyCategory.VOLTAGE });
		await database.manager.update(ChannelEntity, (output.channel as ChannelEntity).id, {
			category: ChannelCategory.ANALOG_INPUT,
		});
		await database.manager.update(ChannelPropertyEntity, output.id, { category: PropertyCategory.VALUE });
		return {
			source: await database.manager.findOneOrFail(ChannelPropertyEntity, {
				where: { id: source.id },
				relations: ['channel', 'channel.device'],
			}),
			output,
		};
	};

	it('persists custom quantity/unit, hydrates cold catalogs, serializes them and edits between different units', async () => {
		const { source, output } = await generic();
		const proposed = dto(source);
		proposed.quantity = 'voltage';
		proposed.unit = 'mV';
		proposed.policy.scale = 1000;
		proposed.policy.offset = 0;
		proposed.policy.outputRange.maximum = 100000;
		expect((await transforms.preview(output.id, proposed)).unit).toBe('mV');
		await transforms.configure(output.id, proposed);
		await start();
		await sample(source, 1.65);
		expect(outputState(output).value).toBe(1650);
		const cold = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		expect(instanceToPlain(cold)).toMatchObject({
			unit: 'mV',
			measurement_quantity: 'voltage',
			category: PropertyCategory.VALUE,
		});
		expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: source.id })).unit).toBeNull();
		const edited = dto(source, 1);
		edited.quantity = 'voltage';
		edited.unit = 'kV';
		edited.policy.scale = 0.001;
		edited.policy.offset = 0;
		expect((await transforms.preview(output.id, edited)).unit).toBe('kV');
		await transforms.configure(output.id, edited);
		await transformRuntime.flush();
		await sample(source, 1.65);
		expect(outputState(output).value).toBeCloseTo(0.00165);
		const changed = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		expect(instanceToPlain(changed)).toMatchObject({ unit: 'kV', measurement_quantity: 'voltage' });
		const authoring = new VirtualDevicesService({} as never, {} as never, {} as never, {} as never, {} as never, graph);
		await expect(
			authoring.assertDerivedOutputSupported(changed, (output.channel as ChannelEntity).id, database.manager),
		).resolves.toBeUndefined();
		transformRuntime.onModuleDestroy();
		runtime.onModuleDestroy();
		await database.destroy();
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'test.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		new VirtualTransformMetadataSubscriber(database);
		const restarted = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		expect(instanceToPlain(restarted)).toMatchObject({ unit: 'kV', measurement_quantity: 'voltage' });
		const persisted = await database.manager.findOneByOrFail(VirtualTransformConfigEntity, {
			outputPropertyId: output.id,
		});
		expect(persisted).toMatchObject({ unit: 'kV', quantity: 'voltage', revision: 2 });
	});

	it.each(['<script>', 'mV\n', 'mV\u0000', ' mV', 'mV;alert(1)', 'x'.repeat(33)])(
		'rejects unsafe custom unit %j in both preview and persistence',
		async (unit) => {
			const { source, output } = await generic();
			const proposed = dto(source);
			proposed.quantity = 'custom';
			proposed.unit = unit;
			await expect(transforms.preview(output.id, proposed)).rejects.toThrow('incompatible_output');
			await expect(transforms.configure(output.id, proposed)).rejects.toThrow('incompatible_output');
		},
	);

	it('keeps generic Celsius labels ineligible for temperature composition and checks the real sensor VALUE slot', async () => {
		const { source, output } = await generic();
		const proposed = dto(source);
		proposed.quantity = 'custom';
		proposed.unit = '°C';
		await transforms.configure(output.id, proposed);
		const aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE),
			second = await measurement();
		await expect(configure(aggregate, [output, second])).rejects.toThrow('canonical transformed temperatures');
		const invalid = dto(source, 1);
		invalid.quantity = 'temperature';
		await expect(transforms.configure(output.id, invalid)).rejects.toThrow('incompatible_output');
		const validation = new DeviceValidationService({} as never);
		const result = validation.validateDeviceStructure({
			category: DeviceCategory.SENSOR,
			channels: [
				{
					category: ChannelCategory.DEVICE_INFORMATION,
					properties: getRequiredProperties(ChannelCategory.DEVICE_INFORMATION).map((property) => ({
						category: property,
						dataType: getPropertyMetadata(ChannelCategory.DEVICE_INFORMATION, property).data_type,
						permissions: getPropertyMetadata(ChannelCategory.DEVICE_INFORMATION, property).permissions,
					})),
				},
				{
					category: ChannelCategory.ANALOG_INPUT,
					properties: [
						{ category: PropertyCategory.VALUE, dataType: DataTypeType.FLOAT, permissions: [PermissionType.READ_ONLY] },
					],
				},
				{
					category: ChannelCategory.ANALOG_INPUT,
					properties: [
						{ category: PropertyCategory.VALUE, dataType: DataTypeType.FLOAT, permissions: [PermissionType.READ_ONLY] },
					],
				},
			],
		});
		expect(result).toMatchObject({ isValid: true, issues: [] });
	});
});
