import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { Characteristic, HAPStatus, Service } from '@homebridge/hap-nodejs';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { ExtensionLoggerService } from '../../../common/logger/extension-logger.service';
import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { HomeKitEventListener } from '../../devices-homekit/listeners/homekit-event.listener';
import { HomeKitCommandDispatcher } from '../../devices-homekit/services/homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from '../../devices-homekit/services/homekit-mapper-registry.service';
import { HomeKitPropertyStateService } from '../../devices-homekit/services/homekit-property-state.service';
import { ConfigureVirtualAggregateDto } from '../dto/producer-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateFilterKind,
	VirtualAggregateInputEntity,
	VirtualAggregateOperator,
	VirtualAggregateProfile,
} from '../entities/virtual-producer.entity';
import { VirtualIndexMaintenanceListener } from '../listeners/virtual-index-maintenance.listener';

import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { aggregateProfiles } from './virtual-numeric-profile.utils';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualPropertyIndexService } from './virtual-property-index.service';
import { VirtualValueSourceService } from './virtual-value-source.service';

jest.setTimeout(30000);
const base = Date.parse('2026-10-13T10:00:00Z');

describe('aggregate runtime with real SQLite bindings and value boundary', () => {
	let directory: string;
	let database: SqliteDataSource;
	let graph: VirtualDependencyGraphService;
	let state: VirtualProducerStateService;
	let runtime: VirtualAggregateRuntimeService;
	let configs: VirtualProducerConfigService;
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
	});

	afterEach(async () => {
		runtime?.onModuleDestroy();
		state?.onModuleDestroy();
		producers?.onModuleDestroy();
		jest.useRealTimers();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});

	const measurement = async (
		mode?: VirtualDeviceMode,
		profileId = VirtualAggregateProfile.TEMPERATURE,
	): Promise<ChannelPropertyEntity> => {
		const profile = aggregateProfiles.find((candidate) => candidate.id === profileId);
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
			.insert({ id: channelId, device: deviceId, name: 'Measurement', category: profile.channel } as never);
		await database.getRepository(mode ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
			id,
			channel: channelId,
			category: profile.quantity,
			dataType: profile.dataTypes[0],
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
	const sample = async (property: ChannelPropertyEntity, value: number | boolean | null, sampledAt = Date.now()) => {
		await values.writeSampleWithState(property, value, {
			sampledAt: new Date(sampledAt),
			receivedAt: new Date(),
			provenance: 'live',
		});
		await runtime.flush();
	};
	const start = async () => {
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		await runtime.onApplicationBootstrap();
	};
	const outputState = (output: ChannelPropertyEntity) => producers.read(output.id);

	it.each([
		[VirtualAggregateProfile.HUMIDITY, 40, 41, 41],
		[VirtualAggregateProfile.CARBON_DIOXIDE, 400.1, 400.9, 401],
		[VirtualAggregateProfile.ILLUMINANCE, 0.1, 0.2, 0.2],
	] as const)(
		'publishes %s on its declared grid and preserves evidence/history across equal reports, expiry and restart',
		async (profile, first, second, expected) => {
			const a = await measurement(undefined, profile),
				b = await measurement(undefined, profile);
			const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE, profile);
			await configure(output, [a, b]);
			expect(await configs.getAggregate(output.id)).toMatchObject({
				profile,
				output_step: aggregateProfiles.find((item) => item.id === profile).outputStep,
			});
			expect((await configs.listAggregateSources(profile)).map((item) => item.property).sort()).toEqual(
				[a.id, b.id].sort(),
			);
			await start();
			await sample(a, first);
			await sample(b, second);
			expect(outputState(output)).toMatchObject({
				value: expected,
				producer: { quality: 'good', sampledAt: new Date(base).toISOString() },
			});
			jest.setSystemTime(base + 4000);
			await sample(b, second);
			expect(outputState(output)?.producer.sampledAt).toBe(new Date(base).toISOString());
			jest.setSystemTime(base + 10000);
			runtime.requestRecompute();
			await runtime.flush();
			expect(outputState(output)?.producer.quality).toBe('unavailable');
			expect(storage.enqueueWritePoint).toHaveBeenCalled();
			runtime.onModuleDestroy();
			values = new PropertyValueService(
				storage as unknown as StorageService,
				new PropertyValueSourceRegistryService(),
				new PropertyValueLockService({} as never),
				producers,
				events,
			);
			runtime = new VirtualAggregateRuntimeService(
				database,
				producers,
				values,
				{
					readLatest: () => Promise.resolve({ status: ConnectionState.UNKNOWN }),
				} as unknown as DeviceConnectionStateService,
				graph,
				events,
			);
			await runtime.onApplicationBootstrap();
			expect(outputState(output)?.producer.quality).toBe('unavailable');
		},
	);

	it.each([VirtualAggregateProfile.CONTACT, VirtualAggregateProfile.MOTION, VirtualAggregateProfile.OCCUPANCY])(
		'preserves %s fixed membership, unknowns and decisive degraded results with real producers',
		async (profile) => {
			const a = await measurement(undefined, profile),
				b = await measurement(undefined, profile);
			const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE, profile);
			await configure(output, [a, b], 1, 0, VirtualAggregateOperator.ANY);
			await start();
			await sample(a, false);
			expect(outputState(output)?.producer.quality).toBe('unavailable');
			await sample(a, true);
			expect(outputState(output)).toMatchObject({ value: true, producer: { quality: 'degraded' } });
			await sample(b, false);
			expect(outputState(output)).toMatchObject({ value: true, producer: { quality: 'good' } });
			await database.getRepository(ChannelPropertyEntity).delete(b.id);
			runtime.requestRecompute();
			await runtime.flush();
			expect(outputState(output)).toMatchObject({ value: true, producer: { quality: 'degraded' } });
			const saved = await configs.getAggregate(output.id);
			expect(saved.inputs).toHaveLength(2);
			expect(saved.inputs.find((input) => input.source_identity === b.id)).toMatchObject({
				source_property: null,
				quantity: 'detected',
			});
			await sample(a, false);
			expect(outputState(output)?.producer.quality).toBe('unavailable');
			// Retain the missing binding by UUID when changing operator.
			await configs.configureAggregate(
				output.id,
				Object.assign(new ConfigureVirtualAggregateDto(), {
					expectedRevision: 1,
					operator: VirtualAggregateOperator.ALL,
					minimumValidInputs: 1,
					maximumAgeSeconds: 10,
					inputs: saved.inputs.map((input) => ({ id: input.id, sourcePropertyId: input.source_property })),
				}),
			);
			await runtime.flush();
			expect(outputState(output)).toMatchObject({ value: false, producer: { quality: 'degraded' } });
			jest.setSystemTime(base + 10000);
			runtime.requestRecompute();
			await runtime.flush();
			expect(outputState(output)?.producer.quality).toBe('unavailable');
		},
	);

	it('fences a binary output profile change through the real graph without replacing its identity/history', async () => {
		const a = await measurement(undefined, VirtualAggregateProfile.CONTACT);
		const b = await measurement(undefined, VirtualAggregateProfile.CONTACT);
		const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE, VirtualAggregateProfile.CONTACT);
		await configure(output, [a, b], 2, 0, VirtualAggregateOperator.ANY);
		await start();
		await sample(a, true);
		await sample(b, false);
		expect(outputState(output)).toMatchObject({ value: true, producer: { quality: 'good' } });
		const writes = storage.enqueueWritePoint.mock.calls.length;
		await graph.withStructuralWrite((manager) =>
			manager.update(VirtualChannelEntity, (output.channel as ChannelEntity).id, { category: ChannelCategory.MOTION }),
		);
		await runtime.flush();
		expect(graph.isQuarantined(output.id)).toBe(true);
		expect(outputState(output)?.producer.quality).toBe('unavailable');
		expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(writes);
		expect(
			await database.manager.findOneBy(VirtualAggregateConfigEntity, { outputPropertyId: output.id }),
		).toMatchObject({ profile: VirtualAggregateProfile.CONTACT, revision: 1 });
	});

	const homekit = (output: ChannelPropertyEntity) => {
		const channel = output.channel as ChannelEntity,
			device = channel.device as DeviceEntity;
		device.channels = [channel];
		channel.properties = [output];
		device.status = { online: true } as DeviceEntity['status'];
		const registry = new HomeKitMapperRegistryService(
			new HomeKitPropertyStateService(producers, new PropertyValueSourceRegistryService()),
		);
		const staged = registry.buildAccessory(
			device,
			new HomeKitCommandDispatcher({ canExecuteCompositeProperty: () => false } as never),
		);
		if (!staged) throw new Error('Missing HomeKit measurement');
		registry.commitStaged(staged);
		const listener = new HomeKitEventListener(registry);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (property: ChannelPropertyEntity) =>
			listener.handlePropertyValueSet(property),
		);
		const service = staged.accessory.getService(Service.TemperatureSensor);
		return {
			reading: service.getCharacteristic(Characteristic.CurrentTemperature),
			fault: service.getCharacteristic(Characteristic.StatusFault),
		};
	};

	it('HomeKit rejects cold hydrated canonical derived history but preserves a known physical projection', async () => {
		const physical = await measurement(),
			other = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [physical, other]);
		await graph.onApplicationBootstrap();
		const alias = await measurement(VirtualDeviceMode.PROJECTION),
			physicalAlias = await measurement(VirtualDeviceMode.PROJECTION);
		await graph.withStructuralWrite(async (manager) => {
			for (const [projection, source] of [
				[alias, output],
				[physicalAlias, physical],
			]) {
				await manager.update(VirtualChannelPropertyEntity, projection.id, {
					valueOrigin: VirtualValueOrigin.SOURCE,
					sourcePropertyId: source.id,
				});
			}
		});
		expect(graph.propertyRequiresLiveValue(physical.id)).toBe(false);
		expect(graph.propertyRequiresLiveValue(output.id)).toBe(true);
		// Aggregate inputs without a projection do not expand the projection identity lookup.
		expect(graph.propertyRequiresLiveValue(other.id)).toBeNull();
		// A separate process starts without producer leases. ORM hydration reads persisted canonical
		// scalar history, which deliberately has no producer metadata; it must never become live proof.
		const coldProducers = new PropertyProducerRegistryService();
		const coldSources = new PropertyValueSourceRegistryService();
		coldSources.register(new VirtualValueSourceService(graph));
		const history = {
			...storage,
			query: jest.fn().mockResolvedValue([{ time: new Date(base - 1000), numberValue: 24 }]),
		};
		const coldValues = new PropertyValueService(
			history as unknown as StorageService,
			coldSources,
			new PropertyValueLockService({} as never),
			coldProducers,
		);
		new ChannelPropertyEntitySubscriber(
			coldValues,
			new DeviceConnectionStateService(history as unknown as StorageService),
			database,
		);
		const hydrated = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: alias.id },
			relations: ['channel', 'channel.device'],
		});
		expect(hydrated.value).toMatchObject({ value: 24 });
		expect(hydrated.value.producer).toBeUndefined();
		const adapter = new HomeKitPropertyStateService(coldProducers, coldSources);
		expect(adapter.read(hydrated)).toMatchObject({ unavailable: true, reasons: ['producer_unavailable'] });
		const knownPhysical = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: physicalAlias.id },
			relations: ['channel', 'channel.device'],
		});
		expect(adapter.read(knownPhysical)).toMatchObject({ value: 24, unavailable: false });
		// Missing source metadata cannot be treated as proof of a physical source after deletion.
		await graph.withStructuralWrite(async (manager) => {
			await manager.delete(ChannelPropertyEntity, physical.id);
		});
		const orphan = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: physicalAlias.id },
			relations: ['channel', 'channel.device'],
		});
		expect(adapter.read(orphan).unavailable).toBe(true);
		// Corrupted cyclic aliases retain quarantined history under their own ids, never authority.
		await graph.withStructuralWrite(async (manager) => {
			await manager.update(VirtualChannelPropertyEntity, alias.id, { sourcePropertyId: physicalAlias.id });
			await manager.update(VirtualChannelPropertyEntity, physicalAlias.id, { sourcePropertyId: alias.id });
		});
		expect(coldSources.unavailableReason(hydrated)).toBe('graph_quarantined');
		expect(adapter.read(hydrated)).toMatchObject({ unavailable: true, reasons: ['graph_quarantined'] });
		coldProducers.onModuleDestroy();
	});

	it('fences a physical-to-derived alias relink before its metadata event and rejects later stale metadata', async () => {
		const physical = await measurement(),
			other = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE),
			alias = await measurement(VirtualDeviceMode.PROJECTION);
		await configure(output, [physical, other]);
		await graph.withStructuralWrite((manager) =>
			manager.update(VirtualChannelPropertyEntity, alias.id, {
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: physical.id,
			}),
		);
		const bound = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: alias.id },
			relations: ['channel', 'channel.device'],
		});
		bound.value = new PropertyValueState(19);
		const sources = new PropertyValueSourceRegistryService();
		sources.register(new VirtualValueSourceService(graph));
		const coldProducers = new PropertyProducerRegistryService();
		const registry = new HomeKitMapperRegistryService(new HomeKitPropertyStateService(coldProducers, sources));
		const channel = bound.channel as ChannelEntity,
			device = channel.device as DeviceEntity;
		channel.properties = [bound];
		device.channels = [channel];
		device.status = { online: true } as DeviceEntity['status'];
		const staged = registry.buildAccessory(
			device,
			new HomeKitCommandDispatcher({ canExecuteCompositeProperty: () => false } as never),
		);
		registry.commitStaged(staged);
		const reading = staged.accessory
			.getService(Service.TemperatureSensor)
			.getCharacteristic(Characteristic.CurrentTemperature);
		expect(await reading.handleGetRequest()).toBe(19);
		// The structural transaction and graph snapshot are current, but no property event has been delivered.
		await graph.withStructuralWrite((manager) =>
			manager.update(VirtualChannelPropertyEntity, alias.id, { sourcePropertyId: output.id }),
		);
		await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		const updated = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: alias.id },
			relations: ['channel', 'channel.device'],
		});
		updated.value = new PropertyValueState(24);
		const listener = new HomeKitEventListener(registry);
		listener.handlePropertyValueChanged(updated);
		await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		const lease = coldProducers.register(output, 1),
			now = Date.now();
		expect(
			coldProducers.commit(
				lease,
				new PropertyValueState(22),
				{
					quality: 'good',
					reasons: [],
					sampledAt: new Date(now),
					evaluatedAt: new Date(now),
					expiresAt: new Date(now + 1000),
				},
				coldProducers.version(lease),
			),
		).toBe(true);
		expect(await reading.handleGetRequest()).toBe(22);
		listener.handlePropertyValueChanged(bound);
		await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		listener.handlePropertyValueChanged(updated);
		expect(await reading.handleGetRequest()).toBe(22);
		coldProducers.onModuleDestroy();
	});

	it('fences a previously local constant after the committed graph changes its origin to SOURCE', async () => {
		const physical = await measurement(),
			local = await measurement(VirtualDeviceMode.PROJECTION);
		await graph.withStructuralWrite((manager) =>
			manager.update(VirtualChannelPropertyEntity, local.id, {
				valueOrigin: VirtualValueOrigin.LOCAL,
				category: PropertyCategory.GENERIC,
			}),
		);
		const bound = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: local.id },
			relations: ['channel', 'channel.device'],
		});
		bound.value = new PropertyValueState(19);
		const sources = new PropertyValueSourceRegistryService();
		sources.register(new VirtualValueSourceService(graph));
		const adapter = new HomeKitPropertyStateService(new PropertyProducerRegistryService(), sources);
		expect(adapter.read(bound)).toMatchObject({ value: 19, unavailable: false });
		await graph.withStructuralWrite((manager) =>
			manager.update(VirtualChannelPropertyEntity, local.id, {
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: physical.id,
			}),
		);
		expect(adapter.read(bound)).toMatchObject({ unavailable: true, reasons: ['graph_source_changed'] });
	});
	it('fences source deletion synchronously inside a real transaction and repairs rollback before orphan events', async () => {
		jest.useRealTimers();
		const physical = await measurement(),
			alias = await measurement(VirtualDeviceMode.PROJECTION);
		await graph.withStructuralWrite((manager) =>
			manager.update(VirtualChannelPropertyEntity, alias.id, {
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: physical.id,
			}),
		);
		const bound = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: alias.id },
			relations: ['channel', 'channel.device'],
		});
		bound.value = new PropertyValueState(19);
		const sources = new PropertyValueSourceRegistryService();
		sources.register(new VirtualValueSourceService(graph));
		const coldProducers = new PropertyProducerRegistryService();
		const registry = new HomeKitMapperRegistryService(new HomeKitPropertyStateService(coldProducers, sources));
		const channel = bound.channel as ChannelEntity,
			device = channel.device as DeviceEntity;
		channel.properties = [bound];
		device.channels = [channel];
		device.status = { online: true } as DeviceEntity['status'];
		const staged = registry.buildAccessory(
			device,
			new HomeKitCommandDispatcher({ canExecuteCompositeProperty: () => false } as never),
		);
		registry.commitStaged(staged);
		const reading = staged.accessory
			.getService(Service.TemperatureSensor)
			.getCharacteristic(Characteristic.CurrentTemperature);
		const maintenance = new VirtualIndexMaintenanceListener(
			new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity), graph),
			{ recompute: jest.fn().mockResolvedValue(undefined) } as never,
			{ findAll: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) } as never,
			{} as never,
			{} as never,
			new DeviceStructureLockService(),
			events,
			database,
			database.getRepository(DeviceEntity),
			graph,
		);
		events.on(EventType.CHANNEL_PROPERTY_DELETED, () => maintenance.handleSourceDeleted());
		const settled = async () => {
			const deadline = Date.now() + 3000;
			while (
				(!graph.isValidated() || (maintenance as unknown as { running: boolean }).running) &&
				Date.now() < deadline
			)
				await new Promise<void>((resolve) => setTimeout(resolve, 5));
			expect(graph.isValidated()).toBe(true);
			expect((maintenance as unknown as { running: boolean }).running).toBe(false);
		};
		for (const rollback of [true, false]) {
			let entered!: () => void, release!: () => void;
			const inside = new Promise<void>((resolve) => {
					entered = resolve;
				}),
				gate = new Promise<void>((resolve) => {
					release = resolve;
				});
			const transaction = database.transaction(async (manager) => {
				await manager.delete(ChannelPropertyEntity, physical.id);
				events.emit(EventType.CHANNEL_PROPERTY_DELETED, physical);
				entered();
				await gate;
				if (rollback) throw new Error('test rollback');
			});
			// Observe and attach rejection handling before releasing the deliberately paused transaction.
			const completion = transaction.then(
				() => 'committed',
				() => 'rolled back',
			);
			await inside;
			expect(graph.isValidated()).toBe(false);
			await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			release();
			expect(await completion).toBe(rollback ? 'rolled back' : 'committed');
			await settled();
			if (rollback) expect(await reading.handleGetRequest()).toBe(19);
			else await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
		coldProducers.onModuleDestroy();
	});
	it('HomeKit follows real aggregate quorum, degraded evidence, expiry at GET and recovery', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b], 1);
		await start();
		const hap = homekit(output);
		await expect(hap.reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		await sample(a, -5);
		expect(await hap.reading.handleGetRequest()).toBe(-5);
		expect(await hap.fault.handleGetRequest()).toBe(Characteristic.StatusFault.GENERAL_FAULT);
		await sample(b, -5);
		expect(await hap.reading.handleGetRequest()).toBe(-5);
		expect(await hap.fault.handleGetRequest()).toBe(Characteristic.StatusFault.NO_FAULT);
		// No timer/event has run yet: GET itself must revoke expired producer authority.
		jest.setSystemTime(base + 10001);
		await expect(hap.reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		expect(await hap.fault.handleGetRequest()).toBe(Characteristic.StatusFault.GENERAL_FAULT);
		await sample(a, 22);
		await sample(b, 22);
		expect(await hap.reading.handleGetRequest()).toBe(22);
		expect(await hap.fault.handleGetRequest()).toBe(Characteristic.StatusFault.NO_FAULT);
	});
	it.each([VirtualAggregateOperator.MEAN, VirtualAggregateOperator.WEIGHTED_MEAN])(
		'starts without trusting history; equal reports recompute age without duplicate scalar history (%s)',
		async (operator) => {
			const a = await measurement(),
				b = await measurement(),
				output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
			await configure(output, [a, b], 2, 0, operator);
			await start();
			expect(outputState(output)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
			await sample(a, 20);
			await sample(b, 22);
			expect(outputState(output)).toMatchObject({
				value: 21,
				producer: {
					quality: 'good',
					sampledAt: new Date(base).toISOString(),
					expiresAt: new Date(base + 10000).toISOString(),
				},
			});
			jest.setSystemTime(base + 5000);
			await sample(a, 20);
			expect(outputState(output).producer.sampledAt).toBe(new Date(base).toISOString());
			await sample(b, 22);
			expect(outputState(output).producer.sampledAt).toBe(new Date(base + 5000).toISOString());
			expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(2);
			expect(storage.writePoints).toHaveBeenCalledTimes(1);
		},
	);

	it.each([VirtualAggregateOperator.MEAN, VirtualAggregateOperator.WEIGHTED_MEAN])(
		'expires members with a fixed quorum and admits an older contributor in a newer evaluation (%s)',
		async (operator) => {
			const a = await measurement(),
				b = await measurement(),
				output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
			await configure(output, [a, b], 1, 0, operator);
			await start();
			await sample(a, 20);
			jest.setSystemTime(base + 10000);
			await sample(b, 22);
			expect(outputState(output)).toMatchObject({
				value: 22,
				producer: { quality: 'degraded', sampledAt: new Date(base + 10000).toISOString() },
			});
			jest.setSystemTime(base + 12000);
			await sample(a, 20, base + 8000);
			expect(outputState(output)).toMatchObject({
				value: 21,
				producer: {
					quality: 'good',
					sampledAt: new Date(base + 8000).toISOString(),
					expiresAt: new Date(base + 18000).toISOString(),
				},
			});
			jest.setSystemTime(base + 18000);
			runtime.requestRecompute();
			await runtime.flush();
			expect(outputState(output)).toMatchObject({ value: 22, producer: { quality: 'degraded' } });
			jest.setSystemTime(base + 20000);
			runtime.requestRecompute();
			await runtime.flush();
			expect(outputState(output)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
		},
	);

	it('excludes offline, incompatible metadata and invalid values while keeping configured membership', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b], 1);
		await start();
		await sample(a, 20);
		await sample(b, 22);
		statuses.set(((a.channel as ChannelEntity).device as DeviceEntity).id, ConnectionState.DISCONNECTED);
		events.emit(EventType.DEVICE_CONNECTION_CHANGED, (a.channel as ChannelEntity).device);
		await runtime.flush();
		expect(outputState(output)).toMatchObject({ value: 22, producer: { quality: 'degraded' } });
		expect(runtime.readDiagnostics(output.id).inputs.find((input) => input.sourceIdentity === a.id).exclusion).toBe(
			'offline',
		);
		await database.manager.update(ChannelPropertyEntity, b.id, { category: PropertyCategory.HUMIDITY });
		events.emit(EventType.CHANNEL_PROPERTY_UPDATED, b);
		await runtime.flush();
		expect(outputState(output).value).toBeNull();
		expect(runtime.readDiagnostics(output.id).inputs.find((input) => input.sourceIdentity === b.id).exclusion).toBe(
			'incompatible',
		);
		await database.manager.update(ChannelPropertyEntity, b.id, { category: PropertyCategory.TEMPERATURE, invalid: 22 });
		events.emit(EventType.CHANNEL_PROPERTY_UPDATED, b);
		await runtime.flush();
		expect(runtime.readDiagnostics(output.id).inputs.find((input) => input.sourceIdentity === b.id).exclusion).toBe(
			'invalid',
		);
		expect(await database.manager.count(VirtualAggregateInputEntity, { where: { outputPropertyId: output.id } })).toBe(
			2,
		);
	});

	it.each([VirtualAggregateOperator.MEAN, VirtualAggregateOperator.WEIGHTED_MEAN])(
		'retains missing identity/quorum, remaps the binding and preserves output/history identity (%s)',
		async (operator) => {
			const a = await measurement(),
				b = await measurement(),
				c = await measurement(),
				output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
			await configure(output, [a, b], 2, 0, operator);
			await start();
			await sample(a, 20);
			await sample(b, 22);
			const old = (await configs.getAggregate(output.id)).inputs.find((input) => input.source_property === a.id);
			await database.manager.delete(ChannelPropertyEntity, a.id);
			events.emit(EventType.CHANNEL_PROPERTY_DELETED, a);
			await runtime.flush();
			expect(outputState(output)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
			expect(runtime.readDiagnostics(output.id).inputs.find((input) => input.id === old.id)).toMatchObject({
				sourceIdentity: a.id,
				exclusion: 'missing',
			});
			await configs.configureAggregate(
				output.id,
				Object.assign(new ConfigureVirtualAggregateDto(), {
					expectedRevision: 1,
					operator,
					minimumValidInputs: 2,
					maximumAgeSeconds: 10,
					inputs: [{ id: old.id, sourcePropertyId: c.id }, { sourcePropertyId: b.id }],
				}),
			);
			await runtime.flush();
			expect(outputState(output).value).toBeNull();
			await sample(c, 24);
			expect(outputState(output)).toMatchObject({ value: 23, producer: { revision: 2 } });
			expect((await configs.getAggregate(output.id)).inputs.find((input) => input.id === old.id).source_property).toBe(
				c.id,
			);
			expect(
				await database.manager.count(VirtualAggregateConfigEntity, { where: { outputPropertyId: output.id } }),
			).toBe(1);
		},
	);

	it('filters qualified weighted evidence, bounds authority by comparison expiry and requires a new cohort after restart', async () => {
		const a = await measurement(),
			b = await measurement(),
			c = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configs.configureAggregate(
			output.id,
			Object.assign(new ConfigureVirtualAggregateDto(), {
				expectedRevision: 0,
				operator: VirtualAggregateOperator.WEIGHTED_MEAN,
				minimumValidInputs: 2,
				maximumAgeSeconds: 10,
				outlierFilter: { kind: VirtualAggregateFilterKind.ABSOLUTE_DEVIATION_FROM_MEDIAN, threshold: 2 },
				inputs: [
					{ sourcePropertyId: a.id, weight: 1 },
					{ sourcePropertyId: b.id, weight: 3 },
					{ sourcePropertyId: c.id, weight: 1000000 },
				],
			}),
		);
		await start();
		await sample(a, 20);
		await sample(b, 22);
		expect(outputState(output).producer.reasons).toContain('insufficient_comparison_cohort');
		await sample(c, 80);
		expect(outputState(output)).toMatchObject({
			value: 21.5,
			producer: { quality: 'degraded', sampledAt: new Date(base).toISOString() },
		});
		expect(runtime.readDiagnostics(output.id).inputs.find((input) => input.sourceIdentity === c.id).exclusion).toBe(
			'outlier',
		);
		jest.setSystemTime(base + 5000);
		runtime.requestRecompute();
		await runtime.flush();
		expect(outputState(output).producer.sampledAt).toBe(new Date(base).toISOString());
		await sample(a, 20);
		await sample(b, 22);
		expect(outputState(output).producer.expiresAt).toBe(new Date(base + 10000).toISOString());
		jest.setSystemTime(base + 10000);
		runtime.requestRecompute();
		await runtime.flush();
		expect(outputState(output).producer.reasons).toContain('insufficient_comparison_cohort');
		expect(outputState(output).producer.quality).toBe('unavailable');
		runtime.onModuleDestroy();
		values = new PropertyValueService(
			storage as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			producers,
			events,
		);
		runtime = new VirtualAggregateRuntimeService(
			database,
			producers,
			values,
			{
				readLatest: () => Promise.resolve({ status: ConnectionState.UNKNOWN }),
			} as unknown as DeviceConnectionStateService,
			graph,
			events,
		);
		await runtime.onApplicationBootstrap();
		expect(outputState(output).producer.quality).toBe('unavailable');
		await sample(a, 20);
		await sample(b, 22);
		expect(outputState(output).producer.quality).toBe('unavailable');
		await sample(c, 22);
		expect(outputState(output).producer.quality).toBe('good');
	});
	it('fences pending output publication across reconfiguration and runtime disposal', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		await sample(a, 20);
		await sample(b, 22);
		const staleLease = producers.register(output, 1);
		const evaluation = producers.beginEvaluation(staleLease);
		await configure(output, [a, b], 2, 1, VirtualAggregateOperator.MAX);
		await values.publishDerived(
			output,
			staleLease,
			100,
			{
				quality: 'good',
				reasons: [],
				sampledAt: new Date(base),
				evaluatedAt: new Date(),
				expiresAt: new Date(base + 10000),
			},
			evaluation,
		);
		expect(outputState(output)).toMatchObject({ value: 22, producer: { revision: 2 } });
		runtime.onModuleDestroy();
		expect(outputState(output)).toMatchObject({
			value: null,
			producer: { quality: 'unavailable', reasons: ['producer_disposed'] },
		});
	});

	it('ignores unrelated heartbeats and timer ticks during an evaluation and coalesces relevant bursts', async () => {
		const a = await measurement(),
			b = await measurement(),
			unrelated = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		await sample(a, 20);
		await sample(b, 22);
		const original = runtime.snapshotEvidence.bind(runtime) as typeof runtime.snapshotEvidence;
		const runBlocked = async (during: () => Promise<void>) => {
			let release: () => void;
			let started: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			const entered = new Promise<void>((resolve) => {
				started = resolve;
			});
			let blocked = false;
			const read = jest.spyOn(runtime, 'snapshotEvidence').mockImplementation(async (...args) => {
				if (!blocked) {
					blocked = true;
					started();
					await gate;
				}
				return original(...args);
			});
			runtime.requestRecompute();
			await entered;
			await during();
			release();
			await runtime.flush();
			const calls = read.mock.calls.length;
			read.mockRestore();
			return calls;
		};
		const first = await runBlocked(async () => {
			jest.setSystemTime(base + 1000);
			await values.writeSampleWithState(unrelated, 90, {
				sampledAt: new Date(),
				receivedAt: new Date(),
				provenance: 'live',
			});
			jest.advanceTimersByTime(1000);
		});
		expect(first).toBe(1);
		expect(outputState(output)).toMatchObject({ value: 21, producer: { quality: 'good' } });
		const second = await runBlocked(async () => {
			for (const value of [23, 24, 25]) {
				jest.setSystemTime(Date.now() + 1000);
				await values.writeSampleWithState(b, value, {
					sampledAt: new Date(),
					receivedAt: new Date(),
					provenance: 'live',
				});
			}
		});
		expect(second).toBe(2);
		expect(outputState(output)).toMatchObject({
			value: 22.5,
			producer: { quality: 'good', sampledAt: new Date(base).toISOString() },
		});
	});

	it('clears disabled output authority and excludes disabled source devices', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b], 1);
		await start();
		await sample(a, 20);
		await sample(b, 22);
		const sourceDevice = (a.channel as ChannelEntity).device as DeviceEntity;
		await database.manager.update(DeviceEntity, sourceDevice.id, { enabled: false });
		events.emit(EventType.DEVICE_UPDATED, sourceDevice);
		await runtime.flush();
		expect(outputState(output)).toMatchObject({ value: 22, producer: { quality: 'degraded' } });
		expect(runtime.readDiagnostics(output.id).inputs.find((input) => input.sourceIdentity === a.id).exclusion).toBe(
			'disabled',
		);
		const outputDevice = (output.channel as ChannelEntity).device as DeviceEntity;
		await database.manager.update(DeviceEntity, outputDevice.id, { enabled: false });
		events.emit(EventType.DEVICE_UPDATED, outputDevice);
		await runtime.flush();
		expect(outputState(output)).toMatchObject({ value: null, producer: { reasons: ['output_disabled'] } });
		await database.manager.update(DeviceEntity, outputDevice.id, { enabled: true });
		events.emit(EventType.DEVICE_UPDATED, outputDevice);
		await runtime.flush();
		expect(outputState(output)).toMatchObject({
			value: 22,
			producer: { quality: 'degraded', sampledAt: new Date(base).toISOString() },
		});
	});

	it('bounds aggregate expiry by a qualified upstream transformed temperature', async () => {
		const a = await measurement(),
			transform = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, transform]);
		await start();
		await sample(a, 20);
		const lease = producers.register(transform, 1);
		await values.publishDerived(transform, lease, 24, {
			quality: 'degraded',
			reasons: ['source_degraded'],
			sampledAt: new Date(base),
			evaluatedAt: new Date(base),
			expiresAt: new Date(base + 3000),
		});
		await runtime.flush();
		expect(outputState(output)).toMatchObject({
			value: 22,
			producer: { quality: 'degraded', expiresAt: new Date(base + 3000).toISOString() },
		});
		jest.setSystemTime(base + 3000);
		runtime.requestRecompute();
		await runtime.flush();
		expect(outputState(output)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
	});

	it('cannot resurrect old config while its real output storage write is in flight', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		await sample(a, 20);
		let release: () => void;
		let started: () => void;
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
		await values.writeSampleWithState(b, 22, {
			sampledAt: new Date(base),
			receivedAt: new Date(base),
			provenance: 'live',
		});
		await entered;
		await configs.configureAggregate(
			output.id,
			Object.assign(new ConfigureVirtualAggregateDto(), {
				expectedRevision: 1,
				operator: VirtualAggregateOperator.MAX,
				minimumValidInputs: 2,
				maximumAgeSeconds: 10,
				inputs: [{ sourcePropertyId: a.id }, { sourcePropertyId: b.id }],
			}),
		);
		expect(outputState(output)).toMatchObject({ value: null, producer: { revision: 2, quality: 'unavailable' } });
		release();
		await runtime.flush();
		expect(outputState(output)).toMatchObject({ value: 22, producer: { revision: 2, quality: 'good' } });
	});

	it('quarantines an unsupported imported graph without poisoning physical qualification or looping', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		await sample(a, 20);
		await sample(b, 22);
		await database.manager.insert(VirtualAggregateInputEntity, {
			id: uuid(),
			outputPropertyId: output.id,
			sourcePropertyId: output.id,
			sourcePropertyIdentity: output.id,
			quantity: PropertyCategory.TEMPERATURE,
			unit: '°C',
		});
		await graph.refreshQuarantine();
		await runtime.flush();
		expect(outputState(output).producer.reasons).toContain('graph_quarantined');
		expect(values.readQualifiedSample(a, 10000)?.value).toBe(20);
		expect(producers.owns(a.id)).toBe(false);
	});

	it('keeps bootstrap alive after a transient SQLite evaluation fault and retries on the next tick', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		const failure = new Error('transient aggregate read');
		const original = database.manager.find.bind(database.manager) as typeof database.manager.find;
		const read = jest.spyOn(database.manager, 'find').mockRejectedValueOnce(failure);
		const logged = jest.spyOn(ExtensionLoggerService.prototype, 'error').mockImplementation();
		try {
			await expect(runtime.onApplicationBootstrap()).resolves.toBeUndefined();
			await expect(runtime.flush()).resolves.toBeUndefined();
			expect(logged).toHaveBeenCalledTimes(1);
			expect(logged).toHaveBeenCalledWith(expect.stringContaining('Aggregate evaluation failed'), failure);
			expect(outputState(output)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
			read.mockImplementation(original);
			jest.advanceTimersByTime(1000);
			await runtime.flush();
			expect(runtime.isActive()).toBe(true);
			await sample(a, 21);
			await sample(b, 23);
			expect(outputState(output)).toMatchObject({ value: 22, producer: { quality: 'good' } });
		} finally {
			read.mockRestore();
			logged.mockRestore();
		}
	});

	it('clears live authority on evaluation failure and recovers on the next source event', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		await sample(a, 20);
		await sample(b, 24);
		const failure = new Error('transient connectivity read');
		const connection = jest.spyOn(
			(runtime as unknown as { connectivity: DeviceConnectionStateService }).connectivity,
			'readLatest',
		);
		connection.mockRejectedValueOnce(failure);
		const logged = jest.spyOn(ExtensionLoggerService.prototype, 'error').mockImplementation();
		try {
			events.emit(EventType.DEVICE_CONNECTION_CHANGED, (a.channel as ChannelEntity).device);
			await expect(runtime.flush()).resolves.toBeUndefined();
			expect(logged).toHaveBeenCalledTimes(1);
			expect(outputState(output)).toMatchObject({
				value: null,
				producer: { quality: 'unavailable', reasons: ['runtime_error'] },
			});
			await sample(a, 22);
			expect(outputState(output)).toMatchObject({ value: 23, producer: { quality: 'good' } });
		} finally {
			connection.mockRestore();
			logged.mockRestore();
		}
	});

	it.each(['read', 'listener'] as const)(
		'returns persisted configuration after a post-commit %s failure while reads and publication stay closed until retry',
		async (failureStage) => {
			const a = await measurement(),
				b = await measurement();
			const output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
			const other = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
			await configure(output, [a, b]);
			await configure(other, [a, b]);
			await start();
			await sample(a, 20);
			await sample(b, 22);
			expect(values.readQualifiedSample(other, 10000)?.value).toBe(21);
			const priorRevision = await graph.revision();
			const priorGuard = graph.capturePublishGuard();
			const failure = new Error('injected post-commit ' + failureStage + ' failure');
			const logged = jest.spyOn(ExtensionLoggerService.prototype, 'error').mockImplementation();
			const edges = graph.edges.bind(graph) as VirtualDependencyGraphService['edges'];
			const reads = jest.spyOn(graph, 'edges');
			let stop: (() => void) | undefined;
			if (failureStage === 'read') reads.mockImplementationOnce(edges).mockRejectedValueOnce(failure);
			else stop = graph.observeValidation(() => Promise.reject(failure));
			try {
				const updated = await configs.configureAggregate(
					output.id,
					Object.assign(new ConfigureVirtualAggregateDto(), {
						expectedRevision: 1,
						operator: VirtualAggregateOperator.MAX,
						minimumValidInputs: 2,
						maximumAgeSeconds: 10,
						inputs: [{ sourcePropertyId: a.id }, { sourcePropertyId: b.id }],
					}),
				);
				expect(updated.revision).toBe(2);
				expect(
					(await database.manager.findOneByOrFail(VirtualAggregateConfigEntity, { outputPropertyId: output.id }))
						.operator,
				).toBe(VirtualAggregateOperator.MAX);
				expect(await graph.revision()).toBe(priorRevision + 1);
				expect(logged).toHaveBeenCalledTimes(1);
				expect(graph.isValidated()).toBe(false);
				expect(graph.isRevisionCurrent(priorRevision)).toBe(false);
				expect(graph.isRevisionCurrent(priorRevision + 1)).toBe(false);
				expect(priorGuard()).toBe(false);
				const failedGuard = graph.capturePublishGuard();
				// Assert immediately, before a timer or an awaited runtime evaluation can install a mask.
				expect(outputState(other)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
				expect(outputState(output)).toMatchObject({ value: null, producer: { quality: 'unavailable', revision: 2 } });
				expect(values.readQualifiedSample(other, 10000)).toBeNull();
				expect(values.readQualifiedSample(output, 10000)).toBeNull();
				expect(values.readQualifiedSample(a, 10000)?.value).toBe(20);
				await runtime.flush();
				expect(outputState(output)?.value).toBeNull();
				if (failureStage === 'listener') {
					await expect(graph.refreshQuarantine()).rejects.toBe(failure);
					expect(graph.isValidated()).toBe(false);
				}
				stop?.();
				await graph.refreshQuarantine();
				expect(graph.isRevisionCurrent(priorRevision + 1)).toBe(true);
				expect(priorGuard()).toBe(false);
				expect(failedGuard()).toBe(false);
				expect(values.readQualifiedSample(output, 10000)?.value).toBe(22);
				expect(values.readQualifiedSample(other, 10000)?.value).toBe(21);
				const recoveredGuard = graph.capturePublishGuard();
				await expect(
					graph.withStructuralWrite(async (manager) => {
						await manager.update(
							VirtualAggregateConfigEntity,
							{ outputPropertyId: output.id },
							{ operator: VirtualAggregateOperator.MIN },
						);
						throw new Error('rolled back before commit');
					}),
				).rejects.toThrow('rolled back before commit');
				expect(await graph.revision()).toBe(priorRevision + 1);
				expect(recoveredGuard()).toBe(true);
				expect(values.readQualifiedSample(output, 10000)?.value).toBe(22);
			} finally {
				stop?.();
				reads.mockRestore();
				logged.mockRestore();
			}
		},
	);
	it('returns a committed configuration when post-activation evaluation fails and recovers on the next report', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		await sample(a, 20);
		await sample(b, 22);
		const badInputId = uuid();
		await database.manager.insert(VirtualAggregateInputEntity, {
			id: badInputId,
			outputPropertyId: output.id,
			sourcePropertyId: output.id,
			sourcePropertyIdentity: output.id,
			quantity: PropertyCategory.TEMPERATURE,
			unit: '°C',
		});
		await graph.refreshQuarantine();
		await database.manager.delete(VirtualAggregateInputEntity, badInputId);
		const failure = new Error('transient connectivity read after commit');
		const connection = jest.spyOn(
			(runtime as unknown as { connectivity: DeviceConnectionStateService }).connectivity,
			'readLatest',
		);
		connection.mockRejectedValueOnce(failure);
		const logged = jest.spyOn(ExtensionLoggerService.prototype, 'error').mockImplementation();
		const invalidate = jest.spyOn(producers, 'invalidate');
		try {
			const updated = await configs.configureAggregate(
				output.id,
				Object.assign(new ConfigureVirtualAggregateDto(), {
					expectedRevision: 1,
					operator: VirtualAggregateOperator.MAX,
					minimumValidInputs: 2,
					maximumAgeSeconds: 10,
					inputs: [{ sourcePropertyId: a.id }, { sourcePropertyId: b.id }],
				}),
			);
			await runtime.flush();
			expect(updated.revision).toBe(2);
			expect(logged).toHaveBeenCalledTimes(1);
			expect(invalidate).toHaveBeenCalledWith(expect.anything(), ['runtime_error']);
			expect(graph.isRevisionCurrent(await graph.revision())).toBe(true);
			expect(graph.isQuarantined(output.id)).toBe(false);
			expect(outputState(output)).toMatchObject({
				value: null,
				producer: { quality: 'unavailable', revision: 2, reasons: ['runtime_error'] },
			});
			await sample(a, 24);
			expect(outputState(output)).toMatchObject({ value: 24, producer: { quality: 'good', revision: 2 } });
		} finally {
			connection.mockRestore();
			logged.mockRestore();
			invalidate.mockRestore();
		}
	});
	const previewService = () =>
		new VirtualProducerConfigService(
			database,
			new DeviceStructureLockService(),
			graph,
			events,
			state,
			undefined,
			runtime,
		);
	const editDraft = async (output: ChannelPropertyEntity, operator = VirtualAggregateOperator.MAX) => {
		const saved = await configs.getAggregate(output.id);
		return Object.assign(new ConfigureVirtualAggregateDto(), {
			expectedRevision: saved.revision,
			expectedGraphRevision: saved.graph_revision,
			operator,
			minimumValidInputs: saved.minimum_valid_inputs,
			maximumAgeSeconds: saved.maximum_age_seconds,
			inputs: saved.inputs.map((input) => ({ id: input.id, sourcePropertyId: input.source_property })),
		});
	};
	it('evaluates edited policy rather than saved runtime and keeps every write/publication/diagnostic untouched', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		await sample(a, 10);
		await sample(b, 20);
		const dto = await editDraft(output);
		const before = await database.manager.find(VirtualAggregateInputEntity);
		const live = producers.readDiagnosticState(output.id),
			diagnostics = runtime.readDiagnostics(output.id),
			generation = values.currentSampleGeneration();
		const eventsSeen = jest.fn();
		events.onAny(eventsSeen);
		const writes = jest.spyOn(database.logger, 'logQuery');
		const historyWrites = storage.enqueueWritePoint.mock.calls.length;
		const historyReads = storage.query.mock.calls.length;
		const result = await previewService().previewAggregate(output.id, dto);
		expect(result.preview_result).toMatchObject({
			value: 20,
			quality: 'good',
			profile: 'temperature',
			unit: '°C',
			sampled_at: new Date(base).toISOString(),
			expires_at: new Date(base + 10000).toISOString(),
		});
		expect(await database.manager.find(VirtualAggregateInputEntity)).toEqual(before);
		expect(
			(await database.manager.findOneBy(VirtualAggregateConfigEntity, { outputPropertyId: output.id })).operator,
		).toBe('mean');
		expect(producers.readDiagnosticState(output.id)).toEqual(live);
		expect(runtime.readDiagnostics(output.id)).toEqual(diagnostics);
		expect(values.currentSampleGeneration()).toBe(generation);
		expect(eventsSeen).not.toHaveBeenCalled();
		expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(historyWrites);
		expect(storage.query).toHaveBeenCalledTimes(historyReads);
		expect(writes.mock.calls.some(([query]) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toBe(false);
		writes.mockRestore();
		events.offAny(eventsSeen);
	});
	it('retains missing identity, and repairs against the replacement evidence rather than the old sample', async () => {
		const a = await measurement(),
			b = await measurement(),
			replacement = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b], 1);
		await start();
		await sample(a, 10);
		await sample(b, 90);
		await graph.withStructuralWrite(async (manager) => {
			await manager.delete(ChannelPropertyEntity, b.id);
		});
		const dto = await editDraft(output);
		const missing = dto.inputs.find((input) => input.sourcePropertyId === null);
		expect(missing).toBeDefined();
		const first = (await previewService().previewAggregate(output.id, dto)).preview_result;
		expect(first).toMatchObject({ value: 10, quality: 'degraded' });
		expect(first.inputs.find((input) => input.source_identity === b.id)).toMatchObject({
			id: missing.id,
			source_property: null,
			current_value: null,
			exclusion: 'missing',
		});
		missing.sourcePropertyId = replacement.id;
		const unqualifiedResponse = await previewService().previewAggregate(output.id, dto);
		expect(unqualifiedResponse.inputs.every((input) => input.current_value === undefined)).toBe(true);
		const unqualified = unqualifiedResponse.preview_result;
		expect(unqualified.value).toBe(10);
		expect(unqualified.inputs.find((input) => input.id === missing.id)).toMatchObject({
			source_identity: replacement.id,
			current_value: null,
		});
		await sample(replacement, 30);
		const repaired = (await previewService().previewAggregate(output.id, dto)).preview_result;
		expect(repaired).toMatchObject({ value: 30, quality: 'good' });
		expect(repaired.inputs.find((input) => input.id === missing.id)).toMatchObject({
			source_identity: replacement.id,
			current_value: 30,
		});
		expect((await configs.getAggregate(output.id)).inputs.find((input) => input.id === missing.id)).toMatchObject({
			source_identity: b.id,
			source_property: null,
		});
	});
	it('uses the evaluation clock after asynchronous metadata and never revives history-only or expired evidence', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await configure(output, [a, b]);
		await start();
		storage.query.mockResolvedValue([{ value: 80, time: new Date(base) }]);
		const dto = await editDraft(output);
		expect((await previewService().previewAggregate(output.id, dto)).preview_result).toMatchObject({
			value: null,
			quality: 'unavailable',
			reasons: expect.arrayContaining(['quorum_lost']) as string[],
		});
		await sample(a, 10);
		await sample(b, 20);
		const original = runtime.snapshotEvidence.bind(runtime) as typeof runtime.snapshotEvidence;
		jest.spyOn(runtime, 'snapshotEvidence').mockImplementationOnce(async (...args) => {
			const read = await original(...args);
			jest.setSystemTime(base + 10000);
			return read;
		});
		const result = (await previewService().previewAggregate(output.id, dto)).preview_result;
		expect(result).toMatchObject({
			value: null,
			quality: 'unavailable',
			evaluated_at: new Date(base + 10000).toISOString(),
		});
		expect(result.inputs.every((input) => input.exclusion === 'stale')).toBe(true);
		expect(producers.readDiagnosticState(output.id).producer.quality).toBe('good'); // Preview did not sweep expired authority.
	});
	it.each(['graph', 'configuration'] as const)(
		'revokes a draft if its %s changes during source snapshot',
		async (kind) => {
			const a = await measurement(),
				b = await measurement(),
				output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
			await configure(output, [a, b]);
			await start();
			await sample(a, 10);
			await sample(b, 20);
			const dto = await editDraft(output),
				original = runtime.snapshotEvidence.bind(runtime) as typeof runtime.snapshotEvidence;
			jest.spyOn(runtime, 'snapshotEvidence').mockImplementationOnce(async (...args) => {
				const read = await original(...args);
				if (kind === 'graph') graph.invalidateValidation();
				else
					await database.manager.increment(
						VirtualAggregateConfigEntity,
						{ outputPropertyId: output.id },
						'revision',
						1,
					);
				return read;
			});
			const result = (await previewService().previewAggregate(output.id, dto)).preview_result;
			expect(result).toMatchObject({
				value: null,
				quality: 'unavailable',
				reasons: ['preview_revoked'],
				expires_at: null,
			});
			expect(result.inputs.every((input) => input.current_value === null)).toBe(true);
		},
	);
	it.each([VirtualAggregateProfile.CONTACT, VirtualAggregateProfile.MOTION, VirtualAggregateProfile.OCCUPANCY])(
		'previews %s strict false and unknown/quorum outcomes under proposed binary policy',
		async (profile) => {
			const a = await measurement(undefined, profile),
				b = await measurement(undefined, profile),
				output = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE, profile);
			await configure(output, [a, b], 1, 0, VirtualAggregateOperator.ANY);
			await start();
			await sample(a, false);
			const dto = await editDraft(output, VirtualAggregateOperator.ALL);
			const result = (await previewService().previewAggregate(output.id, dto)).preview_result;
			expect(result).toMatchObject({ value: false, quality: 'degraded', output_step: null, unit: null });
			expect(result.inputs.every((input) => input.weight === undefined)).toBe(true);
			dto.operator = VirtualAggregateOperator.ANY;
			expect((await previewService().previewAggregate(output.id, dto)).preview_result).toMatchObject({
				value: null,
				quality: 'unavailable',
				reasons: expect.arrayContaining(['unknown_members']) as string[],
			});
			dto.operator = VirtualAggregateOperator.ALL;
			dto.minimumValidInputs = 2;
			expect((await previewService().previewAggregate(output.id, dto)).preview_result).toMatchObject({
				value: null,
				quality: 'unavailable',
				reasons: expect.arrayContaining(['quorum_lost']) as string[],
			});
		},
	);
});
