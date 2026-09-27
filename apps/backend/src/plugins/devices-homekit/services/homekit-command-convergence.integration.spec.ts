import { DataSource } from 'typeorm';

import { Characteristic, HAPStatus, Service } from '@homebridge/hap-nodejs';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../../modules/config/services/config.service';
import {
	ChannelCategory,
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
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyCommandService } from '../../../modules/devices/services/property-command.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
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
describe('HomeKit command convergence with SQLite', () => {
	let database: DataSource;
	let memory: MemoryStorage;
	let events: EventEmitter2;
	let properties: ChannelsPropertiesService;
	let values: PropertyValueService;
	let windows: PropertyCommandWindowService;
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
		const storage = new StorageService({
			getModuleConfig: () => new StorageConfigModel(),
		} as unknown as ConfigService);
		storage.registerPlugin(memory.name, memory);
		const valueSources = new PropertyValueSourceRegistryService();
		valueSources.register(new VirtualValueSourceService());
		values = new PropertyValueService(storage, valueSources, new PropertyValueLockService(database));
		// The unused removal collaborator is deliberately absent: this fixture does not remove entities.
		new ChannelPropertyEntitySubscriber(values, null as never, database);
		events = new EventEmitter2();
		windows = new PropertyCommandWindowService();
		const structure = new DeviceStructureLockService();
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
		const devices = new DevicesService(
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
		const dispatch = new PropertyCommandDispatchService(
			properties,
			channels,
			devices,
			platforms,
			valueSources,
			structure,
			coordinator,
			windows,
		);
		const commands = new PropertyCommandService(
			devices,
			channels,
			properties,
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
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		events?.removeAllListeners();
		await memory?.destroy();
		if (database?.isInitialized) await database.destroy();
	});

	const report = (value: boolean) => properties.update(source.id, { type: SIMULATOR_TYPE, value });

	async function expectState(value: boolean, history: boolean[]): Promise<void> {
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
