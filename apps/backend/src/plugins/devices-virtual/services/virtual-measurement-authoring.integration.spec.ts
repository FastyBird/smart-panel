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
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { CreateVirtualChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from '../dto/create-channel.dto';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateVirtualAggregateProducerDto } from '../dto/measurement-authoring.dto';
import { PreviewVirtualTransformProducerDto } from '../dto/measurement-authoring.dto';
import { UpdateVirtualChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateVirtualChannelDto } from '../dto/update-channel.dto';
import { UpdateVirtualDeviceDto } from '../dto/update-device.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualAggregateOperator } from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';
import { DeviceIsVirtualConstraintValidator } from '../validators/device-is-virtual-constraint.validator';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualMeasurementAuthoringService } from './virtual-measurement-authoring.service';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualTransformConfigService } from './virtual-transform-config.service';

jest.setTimeout(30000);
describe('measurement atomic authoring with real SQLite and core creation services', () => {
	let database: SqliteDataSource;
	let authoring: VirtualMeasurementAuthoringService;
	let graph: VirtualDependencyGraphService;
	let producers: PropertyProducerRegistryService;
	let events: EventEmitter2;
	let transforms: VirtualTransformConfigService;
	let sourceId: string;
	let phase: string | undefined;
	let admittedRunner: QueryRunner | undefined;
	const publications: EventType[] = [];
	const afterCreate = jest.fn();
	beforeEach(async () => {
		phase = undefined;
		admittedRunner = undefined;
		publications.length = 0;
		afterCreate.mockClear();
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
		transforms = new VirtualTransformConfigService(database, lock, graph, events, state);
		const aggregates = new VirtualProducerConfigService(database, lock, graph, events, state);
		const devicesMapper = new DevicesTypeMapperService();
		const channelsMapper = new ChannelsTypeMapperService();
		const propertiesMapper = new ChannelsPropertiesTypeMapperService();
		propertiesMapper.registerMapping({
			type: 'virtual',
			class: VirtualChannelPropertyEntity,
			createDto: CreateVirtualChannelPropertyDto,
			updateDto: UpdateVirtualChannelPropertyDto,
			beforeCreate: (property, channelId, manager) => {
				expect(property.channel).toBe(channelId);
				expect(manager?.queryRunner?.isTransactionActive).toBe(true);
				admittedRunner = manager?.queryRunner;
				if (phase === 'property') throw Error('property failure');
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
		useContainer(
			{
				get: <T>(type: new () => T): T => {
					if (
						[
							CategoryAllowedConstraintValidator,
							DeviceIsVirtualConstraintValidator,
							DeviceExistsConstraintValidator,
						].includes(type as never)
					)
						return { validate: () => true } as T;
					return new type();
				},
			},
			{ fallbackOnErrors: true },
		);
		authoring = new VirtualMeasurementAuthoringService(
			database,
			lock,
			graph,
			devices,
			new DeviceValidationService(devices),
			aggregates,
			transforms,
			state,
			{ requireFreshInputs: jest.fn() } as never,
		);
		const sourceDevice = uuid(),
			channelId = uuid();
		sourceId = uuid();
		await database
			.getRepository(DeviceEntity)
			.insert({ id: sourceDevice, name: 'Physical temperature', category: DeviceCategory.SENSOR });
		await database.getRepository(ChannelEntity).insert({
			id: channelId,
			device: sourceDevice,
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.getRepository(ChannelPropertyEntity).insert({
			id: sourceId,
			channel: channelId,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
		} as never);
	});
	afterEach(async () => {
		producers?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
		useContainer({ get: <T>(type: new () => T) => new type() }, { fallbackOnErrors: true });
	});
	const draft = () => {
		const outputId = uuid();
		return plainToInstance(PreviewVirtualTransformProducerDto, {
			device: {
				id: uuid(),
				type: 'virtual',
				mode: VirtualDeviceMode.SENSOR_TRANSFORM,
				category: DeviceCategory.SENSOR,
				name: 'Converter',
				channels: [
					{
						id: uuid(),
						type: 'virtual',
						name: 'Temperature',
						category: ChannelCategory.TEMPERATURE,
						properties: [
							{
								id: outputId,
								type: 'virtual',
								category: PropertyCategory.TEMPERATURE,
								data_type: DataTypeType.FLOAT,
								permissions: [PermissionType.READ_ONLY],
								value_origin: VirtualValueOrigin.DERIVED,
								format: [-200, 200],
							},
						],
					},
				],
			},
			output_property: outputId,
			configuration: {
				schema_version: 1,
				expected_revision: 0,
				maximum_age_seconds: 10,
				quantity: 'temperature',
				unit: '°C',
				source: { source_property: sourceId },
				policy: {
					operator: VirtualNumericTransformOperator.AFFINE,
					scale: 2,
					offset: 1,
					inputRange: { minimum: -100, maximum: 100 },
					outputRange: { minimum: -200, maximum: 200 },
				},
			},
			preview_input: 12,
		});
	};
	const snapshot = async () => ({
		devices: await database.getRepository(DeviceEntity).count(),
		channels: await database.getRepository(ChannelEntity).count(),
		properties: await database.getRepository(ChannelPropertyEntity).count(),
		configs: await database.getRepository(VirtualTransformConfigEntity).count(),
		sources: await database.getRepository(VirtualTransformSourceEntity).count(),
		revision: await graph.revision(),
	});
	it('dry-runs supplied input without catalog, publications, graph changes or producer ownership', async () => {
		const dto = draft(),
			before = await snapshot();
		const preview = await authoring.previewTransform(dto);
		expect(preview.preview_result).toEqual({ input: 12, value: 25, error: null, qualified: false });
		expect(await snapshot()).toEqual(before);
		expect(publications).toEqual([]);
		expect(producers.owns(dto.outputPropertyId)).toBe(false);
		dto.previewInput = 120;
		expect((await authoring.previewTransform(dto)).preview_result).toMatchObject({ value: null, qualified: false });
	});
	it('commits catalog and configuration together before hooks or events and starts unavailable', async () => {
		const dto = draft();
		const result = await authoring.createTransform(dto);
		expect(result.device.id).toBe(dto.device.id);
		const shape = new DeviceValidationService({} as never).validateDeviceStructure({
			category: result.device.category,
			channels: result.device.channels.map((channel) => ({
				category: channel.category,
				properties: channel.properties,
			})),
		});
		expect(shape.isValid).toBe(true);
		expect(shape.issues).toEqual([]);
		expect(result.configuration.revision).toBe(1);
		expect(await graph.revision()).toBe(1);
		expect(afterCreate).toHaveBeenCalledTimes(5);
		expect(publications.filter((e) => e === EventType.DEVICE_CREATED)).toHaveLength(1);
		expect(publications.filter((e) => e === EventType.CHANNEL_CREATED)).toHaveLength(2);
		expect(publications.filter((e) => e === EventType.CHANNEL_PROPERTY_CREATED)).toHaveLength(5);
		expect(producers.read(dto.outputPropertyId)?.producer.quality).toBe('unavailable');
	});
	it.each(['device', 'channel', 'property', 'config', 'source'])(
		'rolls back a %s failure without rows, revisions, events or leases',
		async (failure) => {
			const dto = draft(),
				before = await snapshot();
			phase = failure;
			const table = {
				device: 'devices_module_devices',
				channel: 'devices_module_channels',
				config: 'devices_virtual_transform_configs',
				source: 'devices_virtual_transform_sources',
			}[failure];
			if (table) {
				const metadata = database.entityMetadatas.find(
					(m) => m.tableName === table || m.tableName.replace(/-/g, '_') === table,
				);
				if (!metadata) throw Error('Missing table ' + table);
				await database.query(
					`CREATE TRIGGER fail_insert BEFORE INSERT ON "${metadata.tableName}" BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
				);
			}
			await expect(authoring.createTransform(dto)).rejects.toThrow();
			expect(await snapshot()).toEqual(before);
			expect(publications).toEqual([]);
			expect(afterCreate).not.toHaveBeenCalled();
			expect(producers.owns(dto.outputPropertyId)).toBe(false);
		},
	);
	it('rejects collisions and stale graph previews without altering an existing source', async () => {
		const dto = draft(),
			before = await snapshot();
		dto.device.id = (await database.getRepository(DeviceEntity).find())[0].id;
		await expect(authoring.createTransform(dto)).rejects.toThrow('already exists');
		expect(await snapshot()).toEqual(before);
		const next = draft();
		next.configuration.expectedGraphRevision = 12;
		await expect(authoring.previewTransform(next)).rejects.toThrow('revision changed');
		expect(await snapshot()).toEqual(before);
	});

	it('previews a native Shelly voltage NTC using spec metadata without listeners or history', async () => {
		const deviceId = uuid(),
			channelId = uuid(),
			voltageId = uuid();
		await database
			.getRepository(ShellyNgDeviceEntity)
			.insert({ id: deviceId, name: 'Shelly analog', category: DeviceCategory.SENSOR } as never);
		await database.getRepository(ShellyNgChannelEntity).insert({
			id: channelId,
			device: deviceId,
			name: 'Voltage',
			category: ChannelCategory.ELECTRICAL_POWER,
		} as never);
		await database.getRepository(ShellyNgChannelPropertyEntity).insert({
			id: voltageId,
			channel: channelId,
			category: PropertyCategory.VOLTAGE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
		} as never);
		const history = jest.fn();
		database.subscribers.push({
			listenTo: () => ChannelPropertyEntity,
			afterLoad: () => {
				history();
			},
		});
		const dto = draft();
		dto.configuration.source.sourcePropertyId = voltageId;
		dto.configuration.policy = Object.assign(dto.configuration.policy, {
			operator: VirtualNumericTransformOperator.NTC_BETA,
			inputRange: { minimum: 0.01, maximum: 3.29 },
			outputRange: { minimum: -100, maximum: 150 },
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			nominalResistance: 10000,
			nominalTemperatureCelsius: 25,
			beta: 3950,
			thermistorLeg: 'low',
		});
		delete dto.configuration.policy.scale;
		delete dto.configuration.policy.offset;
		dto.previewInput = 1.65;
		const before = await snapshot(),
			result = await authoring.previewTransform(dto);
		expect(result.source.unit).toBe('V');
		expect(result.preview_result.value).toBeCloseTo(25);
		expect(history).not.toHaveBeenCalled();
		expect(await snapshot()).toEqual(before);
		expect(publications).toEqual([]);
	});
	it('previews transformed canonical Celsius aggregate membership without history or leases', async () => {
		const transform = draft();
		await authoring.createTransform(transform);
		publications.length = 0;
		const dto = draft(),
			history = jest.fn();
		database.subscribers.push({
			listenTo: () => ChannelPropertyEntity,
			afterLoad: () => {
				history();
			},
		});
		dto.device.mode = VirtualDeviceMode.SENSOR_AGGREGATE;
		const request = Object.assign(new CreateVirtualAggregateProducerDto(), {
			device: dto.device,
			outputPropertyId: dto.outputPropertyId,
			configuration: {
				expectedRevision: 0,
				operator: VirtualAggregateOperator.MEAN,
				minimumValidInputs: 1,
				maximumAgeSeconds: 10,
				inputs: [{ sourcePropertyId: transform.outputPropertyId }, { sourcePropertyId: sourceId }],
			},
		});
		const before = await snapshot(),
			result = await authoring.previewAggregate(request);
		expect(result.inputs[0].unit).toBe('°C');
		expect(history).not.toHaveBeenCalled();
		expect(await snapshot()).toEqual(before);
		expect(publications).toEqual([]);
		expect(producers.owns(dto.outputPropertyId)).toBe(false);
	});
	it('updates declared output range in the same config writer while keeping its UUID', async () => {
		const dto = draft();
		await authoring.createTransform(dto);
		dto.configuration.expectedRevision = 1;
		dto.configuration.policy.outputRange = { minimum: -500, maximum: 500 };
		await transforms.configure(dto.outputPropertyId, dto.configuration);
		const output = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: dto.outputPropertyId });
		expect(output.format).toEqual([-500, 500]);
		expect((await transforms.get(dto.outputPropertyId)).revision).toBe(2);
		expect(producers.read(dto.outputPropertyId)?.producer.quality).toBe('unavailable');
	});

	it('refuses a context whose writer has not committed and never publishes', async () => {
		const callback = jest.fn();
		await database.transaction(async (manager) => {
			await expect(
				DeviceCreationContext.run<number>(
					(operation) => operation(manager),
					'virtual',
					() => Promise.resolve(1),
					callback,
				),
			).rejects.toThrow('owning COMMIT');
		});
		expect(callback).not.toHaveBeenCalled();
	});
});
