import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { SensorMapper } from '../../devices-homekit/mappers/sensor.mapper';
import { ConfigureVirtualDewPointDto } from '../dto/dew-point-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualDewPointConfigEntity } from '../entities/virtual-dew-point.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDewPointConfigService } from './virtual-dew-point-config.service';
import { VirtualDewPointRuntimeService } from './virtual-dew-point-runtime.service';
import { DEW_POINT_FORMULA } from './virtual-dew-point.utils';
import { matchesAggregateNumericProfile } from './virtual-numeric-profile.utils';
import { isThermostatTemperature } from './virtual-thermostat-contract.utils';

jest.setTimeout(30000);
describe('dedicated dew point SQLite persistence and live authority', () => {
	let directory: string,
		database: SqliteDataSource,
		values: PropertyValueService,
		producers: PropertyProducerRegistryService;
	let graph: VirtualDependencyGraphService,
		runtime: VirtualDewPointRuntimeService,
		configs: VirtualDewPointConfigService;
	let events: EventEmitter2;
	let temperature: ChannelPropertyEntity, humidity: ChannelPropertyEntity, output: VirtualChannelPropertyEntity;
	const base = Date.parse('2026-10-16T10:00:00Z');
	const measurement = async (category: ChannelCategory, propertyCategory: PropertyCategory, virtual = false) => {
		const deviceId = uuid(),
			channelId = uuid(),
			id = uuid();
		await database.manager.insert(virtual ? VirtualDeviceEntity : DeviceEntity, {
			id: deviceId,
			name: 'Fixture',
			category: DeviceCategory.SENSOR,
			...(virtual ? { mode: VirtualDeviceMode.SENSOR_TRANSFORM } : {}),
		} as never);
		await database.manager.insert(virtual ? VirtualChannelEntity : ChannelEntity, {
			id: channelId,
			device: deviceId,
			name: 'Fixture',
			category,
		} as never);
		await database.manager.insert(virtual ? VirtualChannelPropertyEntity : ChannelPropertyEntity, {
			id,
			channel: channelId,
			category: propertyCategory,
			dataType: propertyCategory === PropertyCategory.HUMIDITY ? DataTypeType.UCHAR : DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			...(virtual ? { valueOrigin: VirtualValueOrigin.DERIVED, format: [-45, 60] } : {}),
		} as never);
		return database.manager.findOneOrFail(virtual ? VirtualChannelPropertyEntity : ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
	};
	const start = () => {
		runtime = new VirtualDewPointRuntimeService(
			database,
			producers,
			values,
			graph,
			{ readLatest: async () => ({ status: ConnectionState.UNKNOWN }) } as unknown as DeviceConnectionStateService,
			events,
			new ConfigService(),
		);
		configs = new VirtualDewPointConfigService(database, new DeviceStructureLockService(), graph, runtime, events);
		return runtime.onApplicationBootstrap();
	};
	const dto = async (revision = 0, t = temperature.id, rh = humidity.id) =>
		Object.assign(new ConfigureVirtualDewPointDto(), {
			schemaVersion: 1,
			formulaVersion: DEW_POINT_FORMULA,
			expectedRevision: revision,
			expectedGraphRevision: await graph.revision(),
			maximumAgeSeconds: 10,
			maximumSkewSeconds: 2,
			sources: [
				{ role: 'dry_bulb', sourcePropertyId: t },
				{ role: 'relative_humidity', sourcePropertyId: rh },
			],
		});
	const report = async (p: ChannelPropertyEntity, value: number | null, sampled = Date.now()) => {
		await values.writeSampleWithState(p, value, {
			sampledAt: new Date(sampled),
			receivedAt: new Date(),
			provenance: 'live',
		});
		await runtime.flush();
	};
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'dew-point-1459-'));
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
		jest.useFakeTimers({ now: base, doNotFake: ['nextTick', 'setImmediate'] });
		events = new EventEmitter2();
		producers = new PropertyProducerRegistryService(events);
		values = new PropertyValueService(
			{
				isConnected: () => true,
				enqueueWritePoint: async () => undefined,
				flushQueuedWrites: async () => undefined,
				writePoints: async () => undefined,
				query: async () => [],
			} as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			producers,
			events,
		);
		temperature = await measurement(ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);
		humidity = await measurement(ChannelCategory.HUMIDITY, PropertyCategory.HUMIDITY);
		output = (await measurement(
			ChannelCategory.ANALOG_INPUT,
			PropertyCategory.VALUE,
			true,
		)) as VirtualChannelPropertyEntity;
		graph = new VirtualDependencyGraphService(database);
		await graph.refreshQuarantine();
		await start();
	});
	afterEach(async () => {
		runtime?.onModuleDestroy();
		producers?.onModuleDestroy();
		jest.useRealTimers();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	it('persists both exact roles, requires both fresh reports and inherits earliest expiry', async () => {
		await report(temperature, 20);
		await report(humidity, 50);
		await configs.configure(output.id, await dto());
		await runtime.flush();
		expect((await configs.get(output.id)).current_value).toBeNull();
		await report(temperature, 20);
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
		await report(humidity, 50);
		expect(values.readQualifiedSample(output, 10000)?.value).toBeCloseTo(9.255174599, 8);
		const state = await configs.get(output.id);
		expect(state.quantity).toBe('dew_point');
		expect(state.sources.map((s) => s.source_identity)).toEqual(expect.arrayContaining([temperature.id, humidity.id]));
		jest.setSystemTime(base + 10000);
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
	});
	it('retains deleted identity and repairs without changing output UUID/history; restart needs fresh inputs', async () => {
		await configs.configure(output.id, await dto());
		await runtime.flush();
		await report(temperature, 20);
		await report(humidity, 50);
		await database.manager.delete(ChannelPropertyEntity, { id: humidity.id });
		runtime.requestRecompute();
		await runtime.flush();
		let state = await configs.get(output.id);
		expect(state.current_value).toBeNull();
		expect(state.sources.find((s) => s.role === 'relative_humidity')).toMatchObject({
			source_property: null,
			source_identity: humidity.id,
		});
		const replacement = await measurement(ChannelCategory.HUMIDITY, PropertyCategory.HUMIDITY);
		await configs.configure(output.id, await dto(1, temperature.id, replacement.id));
		await runtime.flush();
		await report(temperature, 20);
		await report(replacement, 50);
		expect(values.readQualifiedSample(output, 10000)?.value).toBeCloseTo(9.255174599);
		runtime.onModuleDestroy();
		await start();
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
		await report(temperature, 20);
		await report(replacement, 50);
		state = await configs.get(output.id);
		expect(state.output_property).toBe(output.id);
		expect(state.current_value).toBeCloseTo(9.255174599);
	});
	it('accepts skew equality, refuses greater skew/domain/partial results and fences competing revisions', async () => {
		const request = await dto();
		await configs.configure(output.id, request);
		await runtime.flush();
		await expect(configs.configure(output.id, request)).rejects.toThrow('revision');
		jest.setSystemTime(base + 3000);
		await report(temperature, 20, base + 1000);
		await report(humidity, 50, base + 3000);
		expect(values.readQualifiedSample(output, 10000)).not.toBeNull();
		await report(humidity, 50, base + 3001); // Future timestamps cannot qualify.
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
		jest.setSystemTime(base + 4000);
		await report(humidity, 50, base + 4000);
		expect((await configs.get(output.id)).errors).toContain('skew');
		await report(temperature, -45, base + 4000);
		expect((await configs.get(output.id)).errors).toContain('domain');
		await report(humidity, null);
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
	});
	it('cannot masquerade as ambient/floor, ordinary temperature aggregate or generic HAP temperature', async () => {
		await configs.configure(output.id, await dto());
		await runtime.flush();
		const channel = Object.assign(new VirtualChannelEntity(), output.channel, {
			category: ChannelCategory.TEMPERATURE,
		});
		const mislabeled = Object.assign(new VirtualChannelPropertyEntity(), output, {
			category: PropertyCategory.TEMPERATURE,
			measurementQuantity: 'dew_point',
			unit: '°C',
			channel,
		});
		channel.properties = [mislabeled];
		const device = Object.assign(new VirtualDeviceEntity(), { id: uuid(), channels: [channel] });
		expect(matchesAggregateNumericProfile(mislabeled, channel)).toBe(false);
		expect(isThermostatTemperature(mislabeled, channel)).toBe(false);
		expect(new SensorMapper().canMap(device)).toBe(false);
	});

	it('allows preview without a graph revision but requires the current transaction fence for writes', async () => {
		const request = await dto();
		delete request.expectedGraphRevision;
		const preview = await configs.configure(output.id, request, true);
		expect(preview.graph_revision).toBe(await graph.revision());
		expect(await database.manager.countBy(VirtualDewPointConfigEntity, { outputPropertyId: output.id })).toBe(0);
		await expect(configs.configure(output.id, request)).rejects.toThrow('graph revision');
		expect(await database.manager.countBy(VirtualDewPointConfigEntity, { outputPropertyId: output.id })).toBe(0);
		request.expectedGraphRevision = await graph.revision();
		expect((await configs.configure(output.id, request)).revision).toBe(1);
	});

	it('adds both input edges to cycle validation and refuses one-input role abuse', async () => {
		const invalid = await dto();
		invalid.sources[1].role = 'dry_bulb';
		await expect(configs.configure(output.id, invalid)).rejects.toThrow('roles');
		await configs.configure(output.id, await dto());
		const edges = await graph.edges(database.manager);
		expect(edges.filter((e) => e.outputPropertyId === output.id)).toHaveLength(2);
		await expect(
			graph.validateReplacement(
				database.manager,
				[temperature.id],
				[{ outputPropertyId: temperature.id, sourcePropertyId: output.id }],
			),
		).rejects.toThrow('cycle');
	});
});
