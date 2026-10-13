import { plainToInstance } from 'class-transformer';
import { useContainer } from 'class-validator';
import { QueryRunner } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { CreateVirtualChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from '../dto/create-channel.dto';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateLightGroupDraftDto } from '../dto/light-group-draft.dto';
import { UpdateVirtualChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateVirtualChannelDto } from '../dto/update-channel.dto';
import { UpdateVirtualDeviceDto } from '../dto/update-device.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualLightGroupBindingEntity, VirtualLightGroupConfigEntity } from '../entities/virtual-producer.entity';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';
import { DeviceIsVirtualConstraintValidator } from '../validators/device-is-virtual-constraint.validator';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualLightGroupAuthoringService } from './virtual-light-group-authoring.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';

jest.setTimeout(30000);
describe('light group atomic authoring with real SQLite and core creation services', () => {
	let database: SqliteDataSource;
	let authoring: VirtualLightGroupAuthoringService;
	let graph: VirtualDependencyGraphService;
	let producers: PropertyProducerRegistryService;
	let events: EventEmitter2;
	let memberIds: string[];
	let phase: string | undefined;
	let previewing = false;
	let admittedRunner: QueryRunner | undefined;
	const publications: EventType[] = [];
	const afterCreate = jest.fn();
	const prematureCatalogLoads = jest.fn();
	beforeEach(async () => {
		phase = undefined;
		previewing = false;
		admittedRunner = undefined;
		publications.length = 0;
		afterCreate.mockClear();
		prematureCatalogLoads.mockClear();
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		events = new EventEmitter2();
		for (const event of [
			EventType.DEVICE_CREATED,
			EventType.CHANNEL_CREATED,
			EventType.CHANNEL_PROPERTY_CREATED,
			EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
		])
			events.on(event, () => publications.push(event));
		producers = new PropertyProducerRegistryService(events);
		graph = new VirtualDependencyGraphService(database);
		const lock = new DeviceStructureLockService();
		const state = new VirtualProducerStateService(database, producers, graph, events);
		const aggregates = new VirtualProducerConfigService(database, lock, graph, events, state);
		const devicesMapper = new DevicesTypeMapperService();
		const channelsMapper = new ChannelsTypeMapperService();
		const propertiesMapper = new ChannelsPropertiesTypeMapperService();
		propertiesMapper.registerMapping({
			type: 'virtual',
			class: VirtualChannelPropertyEntity,
			createDto: CreateVirtualChannelPropertyDto,
			updateDto: UpdateVirtualChannelPropertyDto,
			beforeCreate: async (property, channelId, manager) => {
				expect(property.channel).toBe(channelId);
				expect(manager?.queryRunner?.isTransactionActive).toBe(true);
				admittedRunner = manager?.queryRunner;
				if (phase === 'property') throw Error('property failure');
				await virtualService.assertChannelOwnerIsVirtual(channelId, manager);
				await virtualService.assertDerivedOutputSupported(property, channelId, manager);
				return Promise.resolve();
			},
			afterCreate: (property) => {
				expect(admittedRunner?.isTransactionActive).toBe(false);
				afterCreate();
				return Promise.resolve(property);
			},
		});
		channelsMapper.registerMapping({
			type: 'virtual',
			class: VirtualChannelEntity,
			createDto: CreateVirtualChannelDto,
			updateDto: UpdateVirtualChannelDto,
		});
		devicesMapper.registerMapping({
			type: 'virtual',
			class: VirtualDeviceEntity,
			createDto: CreateVirtualDeviceDto,
			updateDto: UpdateVirtualDeviceDto,
		});
		const properties = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			propertiesMapper,
			{} as never,
			new PropertyValueSourceRegistryService(),
			lock,
			{} as never,
			{} as never,
			database,
			events,
		);
		const channels = new ChannelsService(
			database.getRepository(ChannelEntity),
			channelsMapper,
			properties,
			{} as never,
			lock,
			database,
			events,
		);
		const zones = new DeviceZonesService(
			database.getRepository(DeviceZoneEntity),
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			events,
		);
		const devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			devicesMapper,
			channels,
			properties,
			{} as never,
			zones,
			lock,
			database,
			events,
		);
		const virtualService = new VirtualDevicesService(
			properties,
			channels,
			devices,
			{} as never,
			{} as never,
			graph,
			database,
		);
		useContainer(
			{
				get: <T>(type: new () => T): T => {
					if (type === (CategoryAllowedConstraintValidator as never))
						return new CategoryAllowedConstraintValidator(virtualService) as T;
					if (type === (DeviceIsVirtualConstraintValidator as never))
						return new DeviceIsVirtualConstraintValidator(virtualService) as T;
					if (type === (DeviceExistsConstraintValidator as never))
						return new DeviceExistsConstraintValidator(devices) as T;
					return new type();
				},
			},
			{ fallbackOnErrors: true },
		);
		authoring = new VirtualLightGroupAuthoringService(database, lock, graph, devices, aggregates);
		memberIds = [];
		for (let index = 0; index < 2; index++) {
			const deviceId = uuid(),
				channelId = uuid();
			memberIds.push(channelId);
			await database.manager.insert(DeviceEntity, {
				id: deviceId,
				name: 'Physical light',
				category: DeviceCategory.LIGHTING,
			});
			await database.manager.insert(ChannelEntity, {
				id: channelId,
				device: deviceId,
				name: 'Light',
				category: ChannelCategory.LIGHT,
			} as never);
			await database.manager.insert(ChannelPropertyEntity, {
				id: uuid(),
				channel: channelId,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			} as never);
		}
		database.subscribers.push({
			listenTo: () => ChannelPropertyEntity,
			afterLoad: (_entity, event) => {
				if (previewing || event?.queryRunner?.isTransactionActive) prematureCatalogLoads();
			},
		});
	});
	afterEach(async () => {
		producers?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
		useContainer({ get: <T>(type: new () => T) => new type() }, { fallbackOnErrors: true });
	});
	const draft = () =>
		plainToInstance(CreateLightGroupDraftDto, {
			device: { name: 'Group' },
			expected_graph_revision: 0,
			members: memberIds.map((id) => ({ source_channel: id })),
		});
	it('commits catalog and bindings before publishing any event and leaves every output unqualified', async () => {
		const result = await authoring.create(draft());
		expect(result.configuration.revision).toBe(1);
		expect(result.configuration.members).toHaveLength(2);
		expect(await database.manager.count(VirtualLightGroupConfigEntity)).toBe(1);
		expect(await database.manager.count(VirtualLightGroupBindingEntity)).toBe(2);
		expect(afterCreate).toHaveBeenCalled();
		expect(publications).toContain(EventType.DEVICE_CREATED);
		expect(prematureCatalogLoads).not.toHaveBeenCalled();
		for (const property of await database.manager.find(VirtualChannelPropertyEntity))
			if (property.valueOrigin === VirtualValueOrigin.DERIVED)
				expect(producers.read(property.id)?.producer.quality).toBe('unavailable');
	});
	it('rolls back catalog, memberships and buffered publications after a nested property failure', async () => {
		phase = 'property';
		await expect(authoring.create(draft())).rejects.toThrow('property failure');
		expect(await database.manager.count(VirtualDeviceEntity)).toBe(0);
		expect(await database.manager.count(VirtualLightGroupConfigEntity)).toBe(0);
		expect(await database.manager.count(VirtualLightGroupBindingEntity)).toBe(0);
		expect(publications).toEqual([]);
		expect(afterCreate).not.toHaveBeenCalled();
		expect(prematureCatalogLoads).not.toHaveBeenCalled();
	});
	it('previews structural metadata without property history hydration or publication', async () => {
		previewing = true;
		await authoring.preview(draft());
		previewing = false;
		expect(prematureCatalogLoads).not.toHaveBeenCalled();
		expect(publications).toEqual([]);
	});

	it('rejects a stale preview before inserting catalog rows', async () => {
		const dto = draft();
		dto.expectedGraphRevision = 1;
		await expect(authoring.create(dto)).rejects.toThrow('revision changed');
		expect(await database.manager.count(VirtualDeviceEntity)).toBe(0);
		expect(publications).toEqual([]);
	});
});
