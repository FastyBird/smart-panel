import { randomUUID } from 'crypto';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource, createSqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddZigbeeSampleSources1000000000030 } from '../../../migrations/1000000000030-AddZigbeeSampleSources';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { zigbeeSourceIdentity } from '../contracts/sample-source.contract';
import { UpdateZigbee2mqttChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { ZigbeeSampleSourceEntity } from '../entities/zigbee-sample-source.entity';
import { Z2mDevice } from '../interfaces/zigbee2mqtt.interface';
import { Zigbee2mqttDevicePlatform } from '../platforms/zigbee2mqtt.device.platform';

import { Z2mBaseClientAdapter } from './base-client-adapter';
import { Z2mDeviceMapperService } from './device-mapper.service';
import { Z2mMqttClientAdapterService } from './mqtt-client-adapter.service';
import { Z2mWsClientAdapterService } from './ws-client-adapter.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';
import { ZigbeeSampleSourcesService } from './zigbee-sample-sources.service';

const ieee = '0x00158d0000000001';
const replacement = '0x00158d0000000002';
const base = Date.parse('2026-10-13T12:00:00Z');
const registry = (address = ieee, unit = '°C', name = 'floor'): Z2mDevice => ({
	ieee_address: address,
	friendly_name: name,
	type: 'EndDevice',
	supported: true,
	disabled: false,
	network_address: 1,
	definition: {
		model: 'fixture',
		vendor: 'fixture',
		description: 'label only',
		exposes: [{ type: 'numeric', name: 'temperature', property: 'temperature', access: 1, unit }],
	},
});

class FixtureAdapter extends Z2mBaseClientAdapter {
	constructor() {
		super('IdentityFixture');
	}
	connect(): Promise<void> {
		this.connected = true;
		this.bridgeOnline = true;
		return Promise.resolve();
	}
	disconnect(): Promise<void> {
		this.resetState();
		return Promise.resolve();
	}
	publishCommand(): Promise<boolean> {
		return Promise.resolve(true);
	}
	requestState(): Promise<boolean> {
		return Promise.resolve(true);
	}
	setPermitJoin(): Promise<boolean> {
		return Promise.resolve(true);
	}
	feed(topic: string, payload: unknown): void {
		this.handleMessage(topic, JSON.stringify(payload), true);
	}
}

describe('durable Zigbee physical source identity at real sample admission', () => {
	let database: SqliteDataSource;
	let sources: ZigbeeSampleSourcesService;
	let adapter: FixtureAdapter;
	let device: Zigbee2mqttDeviceEntity;
	let channel: Zigbee2mqttChannelEntity;
	let property: Zigbee2mqttChannelPropertyEntity;
	let values: PropertyValueService;
	let reports: ChannelsPropertiesService;
	let mapper: Z2mDeviceMapperService;
	let registryPending: Promise<void>;
	let samplePending: Promise<void>;
	let devices: { findOneBy: jest.Mock };
	beforeEach(async () => {
		jest.useFakeTimers({ now: base });
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				DeviceEntity,
				ChannelEntity,
				ChannelPropertyEntity,
				DeviceControlEntity,
				ChannelControlEntity,
				DeviceZoneEntity,
				SpaceEntity,
				Zigbee2mqttDeviceEntity,
				Zigbee2mqttChannelEntity,
				Zigbee2mqttChannelPropertyEntity,
				ZigbeeSampleSourceEntity,
			],
		});
		device = await database
			.getRepository(Zigbee2mqttDeviceEntity)
			.save({ id: randomUUID(), identifier: 'floor', name: 'Floor', category: DeviceCategory.GENERIC, enabled: true });
		channel = await database.getRepository(Zigbee2mqttChannelEntity).save({
			id: randomUUID(),
			identifier: 'temperature',
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
			device,
		});
		property = await database.getRepository(Zigbee2mqttChannelPropertyEntity).save({
			id: randomUUID(),
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			permissions: [PermissionType.READ_ONLY],
			format: [-100, 150],
			step: null,
			invalid: null,
			channel,
		});
		device = await database.getRepository(Zigbee2mqttDeviceEntity).findOneByOrFail({ id: device.id });
		channel = await database.getRepository(Zigbee2mqttChannelEntity).findOneByOrFail({ id: channel.id });
		channel.device = device;
		property = await database.getRepository(Zigbee2mqttChannelPropertyEntity).findOneByOrFail({ id: property.id });
		property.channel = channel;
		property.unit = resolvePropertyUnit(property);

		const storage = {
			isConnected: jest.fn(() => true),
			enqueueWritePoint: jest.fn().mockResolvedValue(undefined),
			writePoints: jest.fn().mockResolvedValue(undefined),
			flushQueuedWrites: jest.fn().mockResolvedValue(undefined),
			query: jest.fn().mockResolvedValue([]),
			queryStrict: jest.fn().mockResolvedValue([]),
		};
		const valueSources = new PropertyValueSourceRegistryService();
		const events = new EventEmitter2();
		values = new PropertyValueService(
			storage as unknown as StorageService,
			valueSources,
			new PropertyValueLockService({} as never),
			undefined,
			events,
		);
		reports = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			{
				getMapping: () => ({
					type: property.type,
					class: Zigbee2mqttChannelPropertyEntity,
					updateDto: UpdateZigbee2mqttChannelPropertyDto,
				}),
			} as unknown as ChannelsPropertiesTypeMapperService,
			values,
			valueSources,
			new DeviceStructureLockService(),
			new PropertyStateCoordinatorService(),
			new PropertyCommandWindowService(),
			{} as never,
			events,
			undefined,
			{ findOne: () => Promise.resolve(property) } as unknown as PropertyMetadataService,
		);
		sources = new ZigbeeSampleSourcesService(database.getRepository(ZigbeeSampleSourceEntity));
		devices = { findOneBy: jest.fn().mockResolvedValue(device) };
		mapper = new Z2mDeviceMapperService(
			devices as unknown as DevicesService,
			{ findAll: () => Promise.resolve([channel]) } as unknown as ChannelsService,
			Object.assign(Object.create(reports) as ChannelsPropertiesService, {
				findAll: () => Promise.resolve([property]),
			}),
			{} as never,
			{} as never,
			{} as never,
			{ getDerivedPropertiesForChannel: () => [] } as never,
			{} as never,
			{} as never,
			{} as never,
			undefined,
			sources,
		);
		adapter = new FixtureAdapter();
		adapter.setCallbacks({
			onSourceRegistryReceived: (identities) => {
				registryPending = sources.observeRegistry(identities);
				return registryPending;
			},
			onSourceRegistryUnavailable: () => sources.invalidateConnection(),
			onDeviceStateChanged: (name, state, metadata) => {
				samplePending = mapper.updateDeviceState(name, state, metadata);
				return samplePending;
			},
		});
		await adapter.connect();
		adapter.feed('bridge/info', { config: { advanced: { cache_state: false } } });
		adapter.feed('bridge/devices', [registry()]);
		await registryPending;
	});
	afterEach(async () => {
		await adapter.disconnect();
		sources.onModuleDestroy();
		reports.onModuleDestroy();
		await database.destroy();
		jest.useRealTimers();
	});
	const bind = async (): Promise<void> =>
		sources.bindDevice(device.id, sources.getIdentity(device.identifier), [
			{ property, mapping: { field: 'temperature', transformer: null } },
		]);
	const sample = async (value: number | null): Promise<void> => {
		adapter.feed('floor', { temperature: value });
		await samplePending;
	};

	it('requires deliberate initial binding for legacy properties and never guesses identity from a friendly name', async () => {
		jest.setSystemTime(base + 1_000);
		await sample(25);
		expect((await values.readLatest(property))?.value).toBe(25);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		expect(await sources.getReadiness(property.id)).toMatchObject({
			bound: false,
			reason: 'zigbee_source_identity_unbound_requires_deliberate_adoption',
		});
		await bind();
		await sample(25); // same-clock pre-binding/ambiguous packet cannot create qualification
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		jest.setSystemTime(base + 2_000);
		await sample(25);
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(25);
	});

	it('renews genuine equal temperature under the same source lease, and null revokes immediately', async () => {
		await bind();
		jest.setSystemTime(base + 1_000);
		await sample(25);
		const row = await database.getRepository(ZigbeeSampleSourceEntity).findOneByOrFail({ propertyId: property.id });
		jest.setSystemTime(base + 2_000);
		await sample(25);
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base + 2_000);
		adapter.feed('floor', { battery: 70 });
		await samplePending;
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base + 2_000);
		const unchanged = await database
			.getRepository(ZigbeeSampleSourceEntity)
			.findOneByOrFail({ propertyId: property.id });
		expect(unchanged.identifiedAt).toEqual(row.identifiedAt);
		expect(unchanged.revision).toBe(row.revision);
		jest.setSystemTime(base + 3_000);
		await sample(null);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('revokes live qualification synchronously and fences a queued mapper when the name is reassigned', async () => {
		await bind();
		jest.setSystemTime(base + 1_000);
		await sample(25);
		let release: (value: Zigbee2mqttDeviceEntity) => void;
		devices.findOneBy.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}),
		);
		adapter.feed('floor', { temperature: 29 });
		const pending = samplePending;
		adapter.feed('bridge/devices', [registry(replacement)]);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		await registryPending;
		release(device);
		await pending;
		expect((await values.readLatest(property))?.value).toBe(25);
		expect(await sources.getReadiness(property.id)).toMatchObject({
			quarantined: true,
			reason: 'zigbee_friendly_name_reassigned',
			ieeeAddress: ieee,
		});
		jest.setSystemTime(base + 2_000);
		await sample(30);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('ignores labels/availability metadata but quarantines exposed unit changes and keeps quarantine after restart', async () => {
		await bind();
		jest.setSystemTime(base + 1_000);
		await sample(25);
		const changedLabel = registry();
		changedLabel.description = 'new label';
		changedLabel.definition.description = 'new description';
		adapter.feed('bridge/devices', [changedLabel]);
		await registryPending;
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(25);
		adapter.feed('bridge/devices', [registry(ieee, '°F')]);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		await registryPending;
		sources.onModuleDestroy();
		sources = new ZigbeeSampleSourcesService(database.getRepository(ZigbeeSampleSourceEntity));
		await sources.observeRegistry([zigbeeSourceIdentity(registry(ieee, '°F'))]);
		expect(await sources.getReadiness(property.id)).toMatchObject({
			quarantined: true,
			reason: 'zigbee_expose_contract_changed',
		});
		await sources.observeRegistry([zigbeeSourceIdentity(registry())]);
		expect(await sources.getReadiness(property.id)).toMatchObject({ quarantined: true });
	});

	it('compatible explicit re-adoption retains UUID/history and requires a fresh post-binding sample', async () => {
		await bind();
		jest.setSystemTime(base + 1_000);
		await sample(25);
		const uuid = property.id;
		adapter.feed('bridge/devices', [registry(replacement)]);
		await registryPending;
		jest.setSystemTime(base + 2_000);
		await bind();
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		expect((await values.readLatest(property))?.value).toBe(25);
		expect(await database.getRepository(Zigbee2mqttChannelPropertyEntity).count()).toBe(1);
		expect(property.id).toBe(uuid);
		jest.setSystemTime(base + 3_000);
		await sample(26);
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(26);
		expect(await sources.getReadiness(uuid)).toMatchObject({ quarantined: false, ieeeAddress: replacement });
	});

	it('a pure physical rename revokes old routing but keeps the persisted IEEE baseline for deliberate rerouting', async () => {
		await bind();
		jest.setSystemTime(base + 1_000);
		await sample(25);
		adapter.feed('bridge/devices', [registry(ieee, '°C', 'renamed-floor')]);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		await registryPending;
		expect(await sources.getReadiness(property.id)).toMatchObject({ quarantined: false, ieeeAddress: ieee });
		expect(await sources.findBoundDeviceId(ieee)).toBe(device.id);
		expect((await sources.prepareDispatch(device.id, 'floor', [property.id])).allowed).toBe(false);
	});

	it('migration and sync agree on columns/FKs; property and device deletion cascade; metadata excludes secrets', async () => {
		const runner = database.createQueryRunner();
		const synced = await runner.getTable('devices_zigbee2mqtt_sample_sources');
		await runner.dropTable('devices_zigbee2mqtt_sample_sources');
		const migration = new AddZigbeeSampleSources1000000000030();
		await migration.up(runner);
		const migrated = await runner.getTable('devices_zigbee2mqtt_sample_sources');
		const columns = (table: typeof synced) =>
			table.columns.map(({ name, type, isNullable, isPrimary }) => ({ name, type, isNullable, isPrimary }));
		expect(columns(migrated)).toEqual(columns(synced));
		expect(migrated.foreignKeys).toHaveLength(2);
		expect(migrated.foreignKeys.every((key) => key.onDelete === 'CASCADE')).toBe(true);
		await bind();
		const row = await database.getRepository(ZigbeeSampleSourceEntity).findOneByOrFail({ propertyId: property.id });
		expect(row.expose).toMatchObject({ property: 'temperature', type: 'numeric', unit: '°C', access: 1 });
		expect(JSON.stringify(row)).not.toContain('label only');
		await database.getRepository(Zigbee2mqttChannelPropertyEntity).delete(property.id);
		expect(await database.getRepository(ZigbeeSampleSourceEntity).count()).toBe(0);
		const second = await database
			.getRepository(Zigbee2mqttChannelPropertyEntity)
			.save(
				database.getRepository(Zigbee2mqttChannelPropertyEntity).create({ ...property, id: randomUUID(), channel }),
			);
		await sources.bindDevice(device.id, sources.getIdentity('floor'), [
			{ property: second, mapping: { field: 'temperature', transformer: null } },
		]);
		await database.getRepository(Zigbee2mqttDeviceEntity).delete(device.id);
		expect(await database.getRepository(ZigbeeSampleSourceEntity).count()).toBe(0);
		await migration.down(runner);
		expect(await runner.hasTable('devices_zigbee2mqtt_sample_sources')).toBe(false);
		await runner.release();
	});

	it.each(['mqtt', 'websocket'])(
		'fences bound and strict composite commands at actual %s publication; explicit compatible adoption re-enables the same UUID',
		async (transport) => {
			let switchChannel: Zigbee2mqttChannelEntity = await database
				.getRepository(Zigbee2mqttChannelEntity)
				.save({ id: randomUUID(), identifier: 'switcher', category: ChannelCategory.SWITCHER, name: 'Switch', device });
			switchChannel = await database.getRepository(Zigbee2mqttChannelEntity).findOneByOrFail({ id: switchChannel.id });
			switchChannel.device = device;

			const saved = await database.getRepository(Zigbee2mqttChannelPropertyEntity).save({
				id: randomUUID(),
				identifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				format: null,
				step: null,
				invalid: null,
				channel: switchChannel,
			});
			const on = await database.getRepository(Zigbee2mqttChannelPropertyEntity).findOneByOrFail({ id: saved.id });
			on.channel = switchChannel;
			const driver = transport === 'mqtt' ? new Z2mMqttClientAdapterService() : new Z2mWsClientAdapterService();
			const published = jest.fn((_topic: string, _value: unknown, _options: unknown, callback: (error: null) => void) =>
				callback(null),
			);
			const sent = jest.fn((_message: string, callback: (error: null) => void) => callback(null));
			const fixture = driver as unknown as {
				connected: boolean;
				bridgeOnline: boolean;
				client: unknown;
				ws: unknown;
				handleMessage(topic: string, payload: string, relative: boolean): void;
			};
			fixture.connected = true;
			fixture.bridgeOnline = true;
			if (transport === 'mqtt') fixture.client = { connected: true, publish: published };
			else fixture.ws = { send: sent };
			driver.setCallbacks({
				onSourceRegistryReceived: (identities) => {
					registryPending = sources.observeRegistry(identities);
					return registryPending;
				},
			});
			const source = (address = ieee): Z2mDevice => {
				const entry = registry(address);
				entry.definition.exposes.push({
					type: 'binary',
					name: 'state',
					property: 'state',
					access: 7,
					value_on: 'ON',
					value_off: 'OFF',
				});
				return entry;
			};
			const feed = (address = ieee): void =>
				fixture.handleMessage('bridge/devices', JSON.stringify([source(address)]), true);
			const platform = new Zigbee2mqttDevicePlatform(
				{ getActiveAdapter: () => driver } as unknown as Zigbee2mqttService,
				{} as never,
				{
					getWriteMapping: () => ({
						z2mProperty: 'state',
						transformer: { write: (value: boolean) => (value ? 'ON' : 'OFF') },
					}),
				} as never,
				mapper,
				sources,
			);
			const update = { device, channel: switchChannel, property: on, value: true };
			try {
				feed();
				await registryPending;
				// Truly unbound ordinary commands retain the existing contract; strict composites decline.
				expect(await platform.prepareCompositeBatch([update])).toBeNull();
				expect(await platform.process(update)).toBe(true);
				await sources.bindDevice(device.id, sources.getIdentity('floor'), [
					{ property, mapping: { field: 'temperature', transformer: null } },
					{ property: on, mapping: { field: 'state', transformer: null } },
				]);
				published.mockClear();
				sent.mockClear();
				const prepared = await platform.prepareCompositeBatch([update]);
				expect(prepared).not.toBeNull();
				expect(await prepared.dispatch(() => false)).toBe(false); // owned core window revoked before IO
				expect(published).not.toHaveBeenCalled();
				expect(sent).not.toHaveBeenCalled();
				feed(replacement); // metadata callback revokes authority synchronously before DB quarantine resolves
				expect(prepared.isCurrent()).toBe(false);
				expect(await prepared.dispatch(() => true)).toBe(false);
				await registryPending;
				expect(await platform.process(update)).toBe(false);
				expect(await platform.prepareCompositeBatch([update])).toBeNull();
				// Registry refresh can request read-only state; no mutation may target the replacement IEEE.
				expect(published.mock.calls.filter(([topic]) => topic.endsWith('/set'))).toHaveLength(0);
				expect(
					sent.mock.calls.filter(([message]) => (JSON.parse(message) as { topic: string }).topic.endsWith('/set')),
				).toHaveLength(0);
				await sources.bindDevice(device.id, sources.getIdentity('floor'), [
					{ property, mapping: { field: 'temperature', transformer: null } },
					{ property: on, mapping: { field: 'state', transformer: null } },
				]);
				const rebound = await platform.prepareCompositeBatch([update]);
				expect(rebound.updates[0].property.id).toBe(on.id);
				expect(await rebound.dispatch(() => true)).toBe(true);
				if (transport === 'mqtt')
					expect(published).toHaveBeenCalledWith(
						'zigbee2mqtt/floor/set',
						JSON.stringify({ state: 'ON' }),
						{ qos: 1 },
						expect.any(Function),
					);
				else
					expect(sent).toHaveBeenCalledWith(
						JSON.stringify({ topic: 'floor/set', payload: { state: 'ON' } }),
						expect.any(Function),
					);
			} finally {
				fixture.client = null;
				fixture.ws = null;
				await driver.disconnect();
			}
		},
	);
});
