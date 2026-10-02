import { DataSource } from 'typeorm';

import { Characteristic, HAPStatus, Service } from '@homebridge/hap-nodejs';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../../modules/config/services/config.service';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { PropertyValueLockEntity } from '../../../modules/devices/entities/property-value-lock.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyCommandService } from '../../../modules/devices/services/property-command.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
import { DeviceEntitySubscriber } from '../../../modules/devices/subscribers/device-entity.subscriber';
import { IntentTimeseriesService } from '../../../modules/intents/services/intent-timeseries.service';
import { IntentsService } from '../../../modules/intents/services/intents.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { StorageConfigModel } from '../../../modules/storage/models/config.model';
import { StorageService } from '../../../modules/storage/services/storage.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../../devices-virtual/entities/devices-virtual.entity';
import { VirtualProjectionListener } from '../../devices-virtual/listeners/virtual-projection.listener';
import { VirtualDevicePlatform } from '../../devices-virtual/platforms/virtual-device.platform';
import { VirtualPropertyIndexService } from '../../devices-virtual/services/virtual-property-index.service';
import { VirtualValueSourceService } from '../../devices-virtual/services/virtual-value-source.service';
import { MemoryStorage } from '../../memory-storage/services/memory-storage.storage';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../simulator/entities/simulator.entity';
import { SIMULATOR_TYPE } from '../../simulator/simulator.constants';
import { HomeKitEventListener } from '../listeners/homekit-event.listener';

import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

/**
 * Real HAP handlers -> command services -> virtual forwarding -> controlled provider, with real
 * SQLite entities/leases, value storage, subscribers and projection/characteristic listeners.
 * History uses the production memory-storage fallback, not SQLite or a mocked write method.
 * No bridge is advertised and no physical device/network command is sent. HTTP/WS transport,
 * authentication and Raspberry Pi performance remain separate acceptance boundaries.
 */
describe.each([false, true])('HomeKit command convergence with SQLite (cross-process locks: %s)', (locksEnabled) => {
	let database: DataSource;
	let memory: MemoryStorage;
	let storage: StorageService;
	let events: EventEmitter2;
	let properties: ChannelsPropertiesService;
	let values: PropertyValueService;
	let propertyMetadata: PropertyMetadataService;
	let dispatch: PropertyCommandDispatchService;
	let commands: PropertyCommandService;
	let devices: DevicesService;
	let connectivity: DeviceConnectionStateService;
	let windows: PropertyCommandWindowService;
	let structure: DeviceStructureLockService;
	let source: SimulatorChannelPropertyEntity;
	let aliases: VirtualChannelPropertyEntity[];
	let characteristics: Characteristic[];
	let provider: jest.Mock<Promise<boolean>, [IDevicePropertyData[]]>;
	let published: Array<{ id: string; value: unknown }>;
	let notifications: unknown[][];

	beforeEach(async () => {
		database = new DataSource({
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
				PropertyValueLockEntity,
				SimulatorDeviceEntity,
				SimulatorChannelEntity,
				SimulatorChannelPropertyEntity,
				VirtualDeviceEntity,
				VirtualChannelEntity,
				VirtualChannelPropertyEntity,
			],
		});
		await database.initialize();
		memory = new MemoryStorage();
		await memory.initialize();
		storage = new StorageService({
			getModuleConfig: () => new StorageConfigModel(),
		} as unknown as ConfigService);
		storage.registerPlugin(memory.name, memory);
		const valueSources = new PropertyValueSourceRegistryService();
		valueSources.register(new VirtualValueSourceService());
		const runtimeConfig = new NestConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: locksEnabled });
		propertyMetadata = new PropertyMetadataService(database, runtimeConfig);
		values = new PropertyValueService(storage, valueSources, new PropertyValueLockService(database, runtimeConfig));
		connectivity = new DeviceConnectionStateService(storage);
		new ChannelPropertyEntitySubscriber(values, connectivity, database);
		new DeviceEntitySubscriber(connectivity, database);
		events = new EventEmitter2();
		windows = new PropertyCommandWindowService();
		structure = new DeviceStructureLockService();
		const coordinator = new PropertyStateCoordinatorService();
		const propertyMapper = new ChannelsPropertiesTypeMapperService();
		propertyMapper.registerMapping({
			type: SIMULATOR_TYPE,
			class: SimulatorChannelPropertyEntity,
			createDto: CreateChannelPropertyDto,
			updateDto: UpdateChannelPropertyDto,
		});
		properties = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			propertyMapper,
			values,
			valueSources,
			structure,
			coordinator,
			windows,
			database,
			events,
			undefined,
			propertyMetadata,
		);
		// Use production catalog reads; CRUD-only collaborators are not needed for command execution.
		const channels = new ChannelsService(
			database.getRepository(ChannelEntity),
			new ChannelsTypeMapperService(),
			properties,
			null as never,
			structure,
			database,
			events,
		);
		devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			new DevicesTypeMapperService(),
			channels,
			properties,
			null as never,
			null as never,
			structure,
			database,
			events,
		);
		const platforms = new PlatformRegistryService();
		provider = jest.fn<Promise<boolean>, [IDevicePropertyData[]]>().mockResolvedValue(true);
		platforms.register({
			getType: () => SIMULATOR_TYPE,
			process: (update) => provider([update]),
			processBatch: provider,
		});
		platforms.register(new VirtualDevicePlatform(devices, channels, properties, platforms));
		dispatch = new PropertyCommandDispatchService(
			propertyMetadata,
			values,
			channels,
			devices,
			platforms,
			valueSources,
			structure,
			coordinator,
			windows,
		);
		commands = new PropertyCommandService(
			devices,
			channels,
			propertyMetadata,
			values,
			platforms,
			new IntentsService(events, new IntentTimeseriesService(storage)),
			dispatch,
			windows,
		);
		const homekit = new HomeKitCommandDispatcher(commands);
		const registry = new HomeKitMapperRegistryService();
		const index = new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity));
		const projection = new VirtualProjectionListener(index, events);
		const listener = new HomeKitEventListener(registry);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) =>
			projection.handlePropertyValueSet(property),
		);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) =>
			listener.handlePropertyValueSet(property),
		);
		published = [];
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) => {
			published.push({ id: property.id, value: property.value?.value });
		});

		const device = await database
			.getRepository(SimulatorDeviceEntity)
			.save({ name: 'Source light', category: DeviceCategory.LIGHTING });
		const channel = await database
			.getRepository(SimulatorChannelEntity)
			.save({ device, name: 'Light', category: ChannelCategory.LIGHT });
		const metadata = {
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		};
		source = await database.getRepository(SimulatorChannelPropertyEntity).save({ ...metadata, channel });
		await values.write(source, false, new Date(Date.now() - 1000));
		aliases = [];
		characteristics = [];
		notifications = [];
		for (let i = 0; i < 2; i++) {
			const aliasDevice = await database
				.getRepository(VirtualDeviceEntity)
				.save({ name: `Alias ${i}`, category: DeviceCategory.LIGHTING });
			const aliasChannel = await database
				.getRepository(VirtualChannelEntity)
				.save({ device: aliasDevice, name: 'Light', category: ChannelCategory.LIGHT });
			const savedAlias = await database.getRepository(VirtualChannelPropertyEntity).save({
				...metadata,
				channel: aliasChannel,
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: source.id,
			});
			const alias = await properties.findOne<VirtualChannelPropertyEntity>(savedAlias.id);
			if (!alias) throw new Error('Missing alias property');
			index.add(alias, device.id);
			aliases.push(alias);
			const hydrated = await devices.findOne(aliasDevice.id);
			if (!hydrated) throw new Error('Missing alias device');
			const staged = registry.buildAccessory(hydrated, homekit);
			if (!staged) throw new Error('Missing HomeKit accessory');
			registry.commitStaged(staged);
			const characteristic = staged.accessory.getService(Service.Lightbulb)?.getCharacteristic(Characteristic.On);
			if (!characteristic) throw new Error('Missing On characteristic');
			characteristics.push(characteristic);
			const changes: unknown[] = [];
			// Observe actual HAP changes, including GET/SET completion, not only updateValue calls.
			characteristic.on('change', (change: { newValue: unknown }) => changes.push(change.newValue));
			notifications.push(changes);
		}
		await propertyMetadata.onModuleInit();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		events?.removeAllListeners();
		propertyMetadata?.onModuleDestroy();
		await storage?.onApplicationShutdown();
		await memory?.destroy();
		if (database?.isInitialized) await database.destroy();
	});

	const report = (value: boolean) => properties.update(source.id, { type: SIMULATOR_TYPE, value });

	async function expectState(value: boolean, history: boolean[]): Promise<void> {
		await values.flushHistory();
		for (const property of [source, ...aliases]) {
			expect((await properties.findOne(property.id))?.value?.value).toBe(value);
		}
		for (const characteristic of characteristics) {
			expect(await characteristic.handleGetRequest()).toBe(value);
		}
		const rows = await memory.query<{ propertyId: string; stringValue: string }>(
			'SELECT * FROM "property_value" ORDER BY time ASC',
		);
		expect(rows.map((row) => row.stringValue)).toEqual(history.map(String));
		expect(rows.every((row) => row.propertyId === source.id)).toBe(true);
		expect(await database.getRepository(PropertyValueLockEntity).count()).toBe(0);
	}

	function commandTarget(property: ChannelPropertyEntity, value = true): IDevicePropertyData {
		const channel = property.channel;
		if (typeof channel === 'string' || typeof channel.device === 'string') throw new Error('Missing target relations');
		return { device: channel.device, channel, property, value };
	}

	it.each(['single', 'batch', 'api'] as const)(
		'prepares a warm %s command with only the provider graph SELECT and current runtime values',
		async (entrypoint) => {
			const metadata = await propertyMetadata.findOne(source.id);
			if (!metadata) throw new Error('Missing source metadata');
			const target = commandTarget(metadata);
			await values.writeLiveWithState(source, true);
			await connectivity.write(
				target.device,
				Object.assign(new SimulatorChannelPropertyEntity(), source, { category: PropertyCategory.STATUS }),
				ConnectionState.CONNECTED,
			);
			const query = jest.spyOn(database.createQueryRunner(), 'query');
			const propertyRead = jest.spyOn(properties, 'findOne');
			const identityRead = jest.spyOn(devices, 'findIdentity');

			if (entrypoint === 'single') {
				expect((await commands.executePropertyCommandById(source.id, false)).success).toBe(true);
			} else if (entrypoint === 'batch') {
				expect((await commands.executePropertyCommands([{ propertyId: source.id, value: false }])).success).toBe(true);
			} else {
				await commands.processApiPropertyCommand(target.device.id, target.channel.id, source.id, false);
			}

			// One full provider graph remains deliberately outside the structural metadata cache.
			if (locksEnabled) {
				expect(query.mock.calls.length).toBeGreaterThan(1);
			} else {
				expect(query).toHaveBeenCalledTimes(1);
				expect(query.mock.calls[0][0]).toMatch(/^SELECT /);
			}
			expect(propertyRead).not.toHaveBeenCalled();
			expect(identityRead).not.toHaveBeenCalled();
			expect(provider).toHaveBeenCalledTimes(1);
			const update = provider.mock.calls[0][0][0];
			expect(update.property.value?.value).toBe(true);
			expect(commandTarget(update.property).device.status).toMatchObject({
				online: true,
				status: ConnectionState.CONNECTED,
			});
			expect(update.value).toBe(false);
			expect((await propertyMetadata.findOne(source.id))?.value).toBeUndefined();
			expect(commandTarget(await propertyMetadata.findOne(source.id)).device.status.status).toBe(
				ConnectionState.UNKNOWN,
			);
		},
	);

	it('rejects current offline connectivity after warming command metadata', async () => {
		const metadata = await propertyMetadata.findOne(source.id);
		if (!metadata) throw new Error('Missing source metadata');
		const target = commandTarget(metadata);
		const statusProperty = Object.assign(new SimulatorChannelPropertyEntity(), source, {
			category: PropertyCategory.STATUS,
		});
		await connectivity.write(target.device, statusProperty, ConnectionState.CONNECTED);
		expect((await commands.executePropertyCommandById(source.id, true)).success).toBe(true);
		provider.mockClear();
		await connectivity.write(target.device, statusProperty, ConnectionState.DISCONNECTED);

		expect(await commands.executePropertyCommandById(source.id, false)).toMatchObject({
			success: false,
			reason: 'Device is offline',
		});
		expect(provider).not.toHaveBeenCalled();
	});

	it.each(['deleted', 'reparented', 'read-only', 'data-type'] as const)(
		'revalidates a %s property after warming command metadata',
		async (mutation) => {
			const metadata = await propertyMetadata.findOne(source.id);
			if (!metadata) throw new Error('Missing source metadata');
			const target = commandTarget(metadata);
			const repository = database.getRepository(SimulatorChannelPropertyEntity);
			if (mutation === 'deleted') {
				await repository.delete(source.id);
			} else if (mutation === 'reparented') {
				const otherChannel = commandTarget(aliases[0]).channel;
				await repository.update(source.id, { channel: { id: otherChannel.id } });
			} else if (mutation === 'read-only') {
				await repository.update(source.id, { permissions: [PermissionType.READ_ONLY] });
			} else {
				await repository.update(source.id, { dataType: DataTypeType.INT });
			}

			await commands.processApiPropertyCommand(target.device.id, target.channel.id, source.id, true);

			expect(provider).not.toHaveBeenCalled();
			expect(windows.get(source.id)).toBeNull();
		},
	);

	it('admits warmed source and alias commands without ORM/SQLite while reading the current value', async () => {
		const target = await propertyMetadata.findOne(source.id);
		const alias = await propertyMetadata.findOne(aliases[0].id);
		if (!target || !alias) throw new Error('Missing command targets');
		await values.writeLiveWithState(source, true);
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		const repository = jest.spyOn(database, 'getRepository');

		const receipt = await dispatch.prepareApiCommand(commandTarget(alias, false), 3000);
		expect(receipt?.baseline?.value).toBe(true);
		expect(receipt?.canonicalPropertyId).toBe(source.id);
		expect(windows.get(source.id)?.previousValue).toBe(true);
		const directReceipt = await dispatch.prepareApiCommand(commandTarget(target, false), 3000);
		if (!directReceipt) throw new Error('Missing source receipt');
		await expect(
			dispatch.dispatchBatch([commandTarget(target, false)], {
				windowHandles: [directReceipt.handle],
			}),
		).resolves.toEqual({ success: true });
		expect(provider).toHaveBeenCalledTimes(1);
		if (locksEnabled) {
			expect(query).toHaveBeenCalled();
		} else {
			expect(query).not.toHaveBeenCalled();
			expect(repository).not.toHaveBeenCalled();
		}
		query.mockRestore();
		repository.mockRestore();
		// No value was installed into the metadata catalog by admission.
		expect((await propertyMetadata.findOne(source.id))?.value).toBeUndefined();
	});

	it.each([
		['remap', false],
		['remap', true],
		['delete', false],
		['delete', true],
	] as const)('rejects a queued command after an alias %s (preopened: %s)', async (change, preopened) => {
		const replacement = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel: source.channel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		const target = await propertyMetadata.findOne(aliases[0].id);
		if (!target) throw new Error('Missing alias');
		await propertyMetadata.findOne(source.id);
		const receipt = preopened ? await dispatch.prepareApiCommand(commandTarget(target), 3000) : null;
		if (preopened && !receipt) throw new Error('Missing preopened receipt');
		const entered = deferred();
		const release = deferred();
		const mutation = structure.runExclusive(async () => {
			entered.resolve();
			await release.promise;
			if (change === 'remap') {
				await database
					.getRepository(VirtualChannelPropertyEntity)
					.update(target.id, { sourcePropertyId: replacement.id });
			} else {
				await database.getRepository(VirtualChannelPropertyEntity).delete(target.id);
			}
		});
		await entered.promise;
		const command = dispatch.dispatchBatch([commandTarget(target)], receipt ? { windowHandles: [receipt.handle] } : {});
		release.resolve();
		await mutation;
		await expect(command).resolves.toEqual(expect.objectContaining({ success: false }));
		expect(provider).not.toHaveBeenCalled();
		expect(windows.get(source.id)).toBeNull();
	});

	it('admits against committed metadata after an outer rollback with an inner savepoint', async () => {
		const target = await propertyMetadata.findOne(aliases[0].id);
		if (!target) throw new Error('Missing alias');
		const entered = deferred();
		const release = deferred();
		const rollback = new Error('rollback');
		const mutation = structure.runExclusive(async () => {
			await expect(
				database.transaction(async (manager) => {
					await manager
						.getRepository(SimulatorChannelPropertyEntity)
						.update(source.id, { dataType: DataTypeType.STRING });
					await manager.transaction(() => Promise.resolve());
					expect((await propertyMetadata.findOne(source.id))?.dataType).toBe(DataTypeType.STRING);
					entered.resolve();
					await release.promise;
					throw rollback;
				}),
			).rejects.toBe(rollback);
		});
		await entered.promise;
		const command = dispatch.prepareApiCommand(commandTarget(target), 3000);
		release.resolve();
		await mutation;
		await expect(command).resolves.toEqual(expect.objectContaining({ canonicalPropertyId: source.id }));
		expect(windows.get(source.id)?.commandedValue).toBe(true);
	});

	it('reports changed and unchanged values without SQLite in the default single-process mode', async () => {
		// SQLite has a single query runner; spying here includes both ORM queries and raw lease SQL.
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		await report(true);
		await report(true);
		await report(false);
		if (locksEnabled) {
			expect(query.mock.calls.some(([sql]) => sql.includes('devices_module_property_value_locks'))).toBe(true);
		} else {
			expect(query).not.toHaveBeenCalled();
		}
		query.mockRestore();
		expect(published).toHaveLength(6);
		expect(notifications).toEqual([
			[true, false],
			[true, false],
		]);
		await expectState(false, [false, true, false]);
	});

	function deferred(): { promise: Promise<void>; resolve: () => void } {
		let resolve: () => void = () => {};
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		return { promise, resolve };
	}

	const metadataReport = (value: boolean, overrides: Partial<UpdateChannelPropertyDto> = {}) =>
		properties.update(
			source.id,
			{
				type: SIMULATOR_TYPE,
				identifier: source.identifier,
				permissions: [...source.permissions],
				data_type: source.dataType,
				format: source.format,
				step: source.step,
				value,
				...overrides,
			},
			{ skipUnchangedMetadata: true },
		);

	it('converges metadata-bearing reports without structural writes or exclusive admission', async () => {
		await characteristics[0].handleSetRequest(true);
		const exclusive = jest.spyOn(structure, 'runExclusive');
		const save = jest.spyOn(database.getRepository(SimulatorChannelPropertyEntity), 'save');
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		await metadataReport(true);
		await metadataReport(true);
		// The old OFF report is suppressed during the confirmed ON command window.
		await metadataReport(false);
		expect(exclusive).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
		if (!locksEnabled) expect(query).not.toHaveBeenCalled();
		query.mockRestore();
		expect(published).toHaveLength(3);
		// SET completion and provider confirmation may both notify true; neither emits stale false.
		expect(notifications).toEqual([[true, true], [true]]);
		await expectState(true, [false, true]);
	});

	it.each([
		{ identifier: 'changed' },
		{ permissions: [PermissionType.READ_ONLY] },
		{ data_type: DataTypeType.STRING },
		{ format: [0, 1] },
		{ step: 1 },
	])('persists changed metadata through exclusive admission: %j', async (overrides) => {
		const exclusive = jest.spyOn(structure, 'runExclusive');
		const save = jest.spyOn(database.getRepository(SimulatorChannelPropertyEntity), 'save');
		await metadataReport(true, overrides);
		expect(exclusive).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledTimes(1);
		const row = await database.getRepository(SimulatorChannelPropertyEntity).findOneByOrFail({ id: source.id });
		const { data_type: dataType, ...fields } = overrides as Partial<UpdateChannelPropertyDto>;
		expect(row).toMatchObject({ ...fields, ...(dataType ? { dataType } : {}) });
		exclusive.mockClear();
		save.mockClear();
		await metadataReport(true, overrides);
		expect(exclusive).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});

	it('rejects invalid metadata before writing a value', async () => {
		const write = jest.spyOn(values, 'writeWithState');
		await expect(metadataReport(true, { permissions: [] })).rejects.toThrow();
		expect(write).not.toHaveBeenCalled();
		await expectState(false, [false]);
	});

	it('publishes provider state before slow history while structural changes still drain history', async () => {
		const entered = deferred();
		const release = deferred();
		const originalWrite = memory.writePoints.bind(memory) as MemoryStorage['writePoints'];
		jest.spyOn(memory, 'writePoints').mockImplementationOnce(async (...args) => {
			entered.resolve();
			await release.promise;
			return originalWrite(...args);
		});
		let publishedLive = false;
		const update = metadataReport(true).then(() => {
			publishedLive = true;
		});
		await entered.promise;
		const save = jest.spyOn(database.getRepository(SimulatorChannelPropertyEntity), 'save');
		let mutationFinished = false;
		const mutation = metadataReport(true, { identifier: 'changed-after-history' }).then(() => {
			mutationFinished = true;
		});
		try {
			await new Promise<void>((resolve) => setTimeout(resolve, 100));
			expect(publishedLive).toBe(!locksEnabled);
			expect(mutationFinished).toBe(false);
			expect(save).not.toHaveBeenCalled();
			if (!locksEnabled) {
				expect(published.map(({ value }) => value)).toEqual([true, true, true]);
				expect(characteristics.map((characteristic) => characteristic.value)).toEqual([true, true]);
			}
		} finally {
			release.resolve();
			await Promise.all([update, mutation]);
		}
		expect(mutationFinished).toBe(true);
		await expectState(true, [false, true]);
	});

	if (!locksEnabled) {
		it('does not replay an old HomeKit state when delayed history finishes after a newer report', async () => {
			const release = deferred();
			const originalWrite = memory.writePoints.bind(memory) as MemoryStorage['writePoints'];
			jest.spyOn(memory, 'writePoints').mockImplementationOnce(async (...args) => {
				await release.promise;
				return originalWrite(...args);
			});
			try {
				await metadataReport(true);
				await new Promise<void>((resolve) => setTimeout(resolve, 5));
				await metadataReport(false);
				expect(characteristics.map((characteristic) => characteristic.value)).toEqual([false, false]);
				expect(notifications).toEqual([
					[true, false],
					[true, false],
				]);
			} finally {
				release.resolve();
				await values.flushHistory();
			}
			expect(notifications).toEqual([
				[true, false],
				[true, false],
			]);
			await expectState(false, [false, true, false]);
		});
	}

	it.each(['change', 'delete'])('re-reads metadata after a queued structural %s', async (operation) => {
		const entered = deferred();
		const release = deferred();
		const mutation = structure.runExclusive(async () => {
			entered.resolve();
			await release.promise;
			const repository = database.getRepository(SimulatorChannelPropertyEntity);
			if (operation === 'delete') await repository.delete(source.id);
			else await repository.update(source.id, { identifier: 'changed while waiting' });
		});
		await entered.promise;
		const update = metadataReport(true);
		const result =
			operation === 'delete'
				? expect(update).rejects.toThrow('Channel property does not exist')
				: expect(update).resolves.toMatchObject({ identifier: source.identifier });
		release.resolve();
		await mutation;
		await result;
		const row = await database.getRepository(SimulatorChannelPropertyEntity).findOneBy({ id: source.id });
		if (operation === 'delete') expect(row).toBeNull();
		else expect(row?.identifier).toBe(source.identifier);
	});

	it('refreshes property, channel and device metadata after structural writes and deletion', async () => {
		const original = await propertyMetadata.findOne(source.id);
		if (!original || typeof original.channel === 'string' || typeof original.channel.device === 'string') {
			throw new Error('Missing source relations');
		}
		await database.getRepository(SimulatorChannelPropertyEntity).update(source.id, { name: 'Renamed property' });
		await database.getRepository(SimulatorChannelEntity).update(original.channel.id, { name: 'Renamed channel' });
		await database.getRepository(SimulatorDeviceEntity).update(original.channel.device.id, { name: 'Renamed device' });
		const updated = await propertyMetadata.findOne(source.id);
		expect(updated).toMatchObject({
			name: 'Renamed property',
			channel: { name: 'Renamed channel', device: { name: 'Renamed device' } },
		});
		await database.getRepository(SimulatorChannelPropertyEntity).delete(source.id);
		expect(await propertyMetadata.findOne(source.id)).toBeNull();
		await expect(report(true)).rejects.toThrow('Channel property does not exist');
	});

	it('sees newly created properties and source remaps after the catalog was warmed', async () => {
		const added = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel: source.channel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		expect((await propertyMetadata.findOne(added.id))?.id).toBe(added.id);
		await database.getRepository(VirtualChannelPropertyEntity).update(aliases[0].id, { sourcePropertyId: added.id });
		expect(await propertyMetadata.findOne(aliases[0].id)).toMatchObject({ sourcePropertyId: added.id });
	});

	it('discards metadata read inside a rolled-back transaction', async () => {
		const original = await propertyMetadata.findOne(source.id);
		const rollback = new Error('rollback fixture');
		await expect(
			database.transaction(async (manager) => {
				await manager.getRepository(SimulatorChannelPropertyEntity).update(source.id, { name: 'Uncommitted' });
				expect((await propertyMetadata.findOne(source.id))?.name).toBe('Uncommitted');
				throw rollback;
			}),
		).rejects.toBe(rollback);
		expect((await propertyMetadata.findOne(source.id))?.name).toBe(original?.name);
	});

	it('forwards an alias to its source and never publishes a stale value before or after confirmation', async () => {
		await characteristics[0].handleSetRequest(true);
		expect(provider).toHaveBeenCalledTimes(1);
		expect(provider.mock.calls[0][0].map(({ property, value }) => ({ id: property.id, value }))).toEqual([
			{ id: source.id, value: true },
		]);
		expect(await characteristics[0].handleGetRequest()).toBe(true);
		await report(false);
		expect(published).toEqual([]);
		await report(true);
		await report(false);
		expect(published).toHaveLength(3);
		expect(published.every((event) => event.value === true)).toBe(true);
		expect(notifications.flat()).not.toContain(false);
		await expectState(true, [false, true]);
	});

	it('keeps the final ON through ON/OFF/ON and the late OFF readback', async () => {
		for (const value of [true, false, true]) await characteristics[0].handleSetRequest(value);
		expect(provider.mock.calls.map(([updates]) => updates[0].value)).toEqual([true, false, true]);
		const generation = windows.get(source.id)?.generation;
		expect(generation).toBeDefined();
		notifications.forEach((changes) => changes.splice(0));
		await report(false);
		await report(true);
		await report(false);
		expect(windows.get(source.id)).toMatchObject({ generation, state: 'confirmed_grace' });
		expect(notifications.flat()).not.toContain(false);
		await expectState(true, [false, true]);
	});

	it.each(['refusal', 'exception'])(
		'reverts the HomeKit cache on provider %s without changing source history',
		async (failure) => {
			if (failure === 'refusal') provider.mockResolvedValueOnce(false);
			else provider.mockRejectedValueOnce(new Error('Provider unavailable'));
			await expect(characteristics[0].handleSetRequest(true)).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			expect(windows.get(source.id)).toBeNull();
			expect(published).toEqual([]);
			await expectState(false, [false]);
		},
	);

	it('does not let an older failed command roll back a newer confirmation through another alias', async () => {
		let enter: () => void = () => undefined;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		let settle: (success: boolean) => void = () => undefined;
		const outcome = new Promise<boolean>((resolve) => {
			settle = resolve;
		});
		provider.mockImplementationOnce(() => {
			enter();
			return outcome;
		});
		const first = characteristics[0].handleSetRequest(true);
		const rejected = expect(first).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		await entered;
		await characteristics[1].handleSetRequest(true);
		await report(true);
		settle(false);
		await rejected;
		expect(notifications.flat()).not.toContain(false);
		await expectState(true, [false, true]);
	});

	it.each([0, 1])('does not publish an older successful SET after alias %s confirms a newer command', async (alias) => {
		let enter: () => void = () => undefined;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		let settle: (success: boolean) => void = () => undefined;
		const outcome = new Promise<boolean>((resolve) => {
			settle = resolve;
		});
		provider.mockImplementationOnce(() => {
			enter();
			return outcome;
		});
		const first = characteristics[0].handleSetRequest(true);
		await entered;
		await characteristics[alias].handleSetRequest(false);
		await report(false);
		notifications.forEach((changes) => changes.splice(0));
		settle(true);
		await first;
		expect(notifications.flat()).not.toContain(true);
		expect(characteristics.map((characteristic) => characteristic.value)).toEqual([false, false]);
		await expectState(false, [false]);
	});

	it('accepts expiry reconciliation even while the provider acknowledgement is still pending', async () => {
		let enter: () => void = () => undefined;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		let settle: (success: boolean) => void = () => undefined;
		const outcome = new Promise<boolean>((resolve) => {
			settle = resolve;
		});
		provider.mockImplementationOnce(() => {
			enter();
			return outcome;
		});
		const command = characteristics[0].handleSetRequest(true);
		await entered;
		await report(false);
		const window = windows.get(source.id);
		if (!window) throw new Error('Missing pending window');
		jest.spyOn(Date, 'now').mockReturnValue(window.expiresAt);
		await (
			properties as unknown as { recoverExpiredCommandWindows: () => Promise<void> }
		).recoverExpiredCommandWindows();
		await expectState(false, [false]);
		notifications.forEach((changes) => changes.splice(0));
		settle(true);
		await command;
		expect(notifications.flat()).not.toContain(true);
		expect(characteristics[0].value).toBe(false);
	});

	it.each(['sweep', 'fresh report', 'metadata report'])(
		'reconciles an unchanged held report once after expiry via %s',
		async (path) => {
			await characteristics[0].handleSetRequest(true);
			await report(false);
			const window = windows.get(source.id);
			expect(window?.state).toBe('pending');
			if (!window) throw new Error('Missing pending window');
			jest.spyOn(Date, 'now').mockReturnValue(window.expiresAt);
			if (path === 'fresh report') await report(false);
			if (path === 'metadata report') {
				await properties.update(source.id, { type: SIMULATOR_TYPE, value: false, name: 'Updated light' });
			}
			await (
				properties as unknown as { recoverExpiredCommandWindows: () => Promise<void> }
			).recoverExpiredCommandWindows();
			expect(windows.get(source.id)).toBeNull();
			await expectState(false, [false]);
			expect(published).toHaveLength(3);
			expect(published.every((event) => event.value === false)).toBe(true);
			await report(false);
			await (
				properties as unknown as { recoverExpiredCommandWindows: () => Promise<void> }
			).recoverExpiredCommandWindows();
			expect(published).toHaveLength(3);
		},
	);
});
