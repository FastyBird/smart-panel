import { plainToInstance } from 'class-transformer';
import { useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
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
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import {
	DEVICES_MODBUS_TYPE,
	ModbusBindingRole,
	ModbusDataType,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusValidationException } from '../devices-modbus.exceptions';
import { CreateModbusChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateModbusChannelDto } from '../dto/create-channel.dto';
import { CreateModbusDeviceStructureDto } from '../dto/create-device-structure.dto';
import { CreateModbusDeviceDto } from '../dto/create-device.dto';
import { UpdateModbusChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateModbusChannelDto } from '../dto/update-channel.dto';
import { UpdateModbusDeviceDto } from '../dto/update-device.dto';
import {
	ModbusChannelEntity,
	ModbusChannelPropertyEntity,
	ModbusDeviceEntity,
} from '../entities/devices-modbus.entity';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';

import { ModbusBindingsService } from './modbus-bindings.service';
import { ModbusConnectionsService } from './modbus-connections.service';
import { ModbusDeviceStructureService } from './modbus-device-structure.service';
import { ModbusEndpointsService } from './modbus-endpoints.service';
import { ModbusRuntimeService } from './modbus-runtime.service';

type Plain = Record<string, unknown>;

const holding = ModbusRegisterType.HOLDING_REGISTER;

/** The Eletechsup N4D8B08 relay board: one holding register per relay, written with different values than read. */
const relayChannel = (n: number): Plain => ({
	identifier: `relay_${n}`,
	name: `Relay ${n}`,
	category: ChannelCategory.SWITCHER,
	properties: [
		{
			category: PropertyCategory.ON,
			data_type: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			read: {
				register_type: holding,
				address: n,
				data_type: ModbusDataType.UINT16,
				value_map: [
					{ raw: 1, value: true },
					{ raw: 0, value: false },
				],
			},
			write: {
				register_type: holding,
				address: n,
				data_type: ModbusDataType.UINT16,
				value_map: [
					{ raw: 256, value: true },
					{ raw: 512, value: false },
				],
				write_function: ModbusWriteFunction.SINGLE,
			},
		},
	],
});

const relayBoard = (endpointId: string, unitId = 1): Plain => ({
	name: 'N4D8B08',
	category: DeviceCategory.SWITCHER,
	endpoint_id: endpointId,
	unit_id: unitId,
	channels: [1, 2, 3, 4, 5, 6, 7, 8].map(relayChannel),
});

/** A single-relay switcher whose first property can be adjusted per test. */
const singleRelay = (endpointId: string, property: (base: Plain) => Plain, unitId = 1): Plain => {
	const channel = relayChannel(1);
	const [base] = channel.properties as Plain[];

	return {
		...relayBoard(endpointId, unitId),
		channels: [{ ...channel, properties: [property(base)] }],
	};
};

const toDto = (plain: Plain): CreateModbusDeviceStructureDto => plainToInstance(CreateModbusDeviceStructureDto, plain);

const reasonsOf = async (promise: Promise<unknown>): Promise<{ field: string; reason: string }[]> => {
	const error: unknown = await promise.then<null, unknown>(
		() => null,
		(e: unknown) => e,
	);

	expect(error).toBeInstanceOf(ModbusValidationException);

	return ((error as ModbusValidationException).getResponse() as { message: string[] }).message.map(
		(m) => JSON.parse(m) as { field: string; reason: string },
	);
};

jest.setTimeout(30000);

describe('ModbusDeviceStructureService with real SQLite and core creation services', () => {
	let database: SqliteDataSource;
	let service: ModbusDeviceStructureService;
	let bindings: ModbusBindingsService;
	let runtime: { loadDevice: jest.Mock };
	let values: { write: jest.Mock };
	let endpoint: ModbusEndpointEntity;
	let otherEndpoint: ModbusEndpointEntity;

	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();

		const events = new EventEmitter2();
		const lock = new DeviceStructureLockService();
		const devicesMapper = new DevicesTypeMapperService();
		const channelsMapper = new ChannelsTypeMapperService();
		const propertiesMapper = new ChannelsPropertiesTypeMapperService();

		devicesMapper.registerMapping({
			type: DEVICES_MODBUS_TYPE,
			class: ModbusDeviceEntity,
			createDto: CreateModbusDeviceDto,
			updateDto: UpdateModbusDeviceDto,
		});
		channelsMapper.registerMapping({
			type: DEVICES_MODBUS_TYPE,
			class: ModbusChannelEntity,
			createDto: CreateModbusChannelDto,
			updateDto: UpdateModbusChannelDto,
		});
		propertiesMapper.registerMapping({
			type: DEVICES_MODBUS_TYPE,
			class: ModbusChannelPropertyEntity,
			createDto: CreateModbusChannelPropertyDto,
			updateDto: UpdateModbusChannelPropertyDto,
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
					if (type === (DeviceExistsConstraintValidator as never))
						return new DeviceExistsConstraintValidator(devices) as T;

					return new type();
				},
			},
			{ fallbackOnErrors: true },
		);

		const endpoints = new ModbusEndpointsService(
			database.getRepository(ModbusEndpointEntity),
			database.getRepository(ModbusDeviceEntity),
			{ reconcile: jest.fn().mockResolvedValue(undefined) } as unknown as ModbusConnectionsService,
		);

		endpoint = await endpoints.create({ name: 'Gateway', host: '10.10.0.230' });
		otherEndpoint = await endpoints.create({ name: 'Other gateway', host: '10.10.0.231' });

		runtime = { loadDevice: jest.fn().mockResolvedValue(undefined) };
		values = { write: jest.fn().mockResolvedValue(true) };
		bindings = new ModbusBindingsService(database.getRepository(ModbusBindingEntity));
		service = new ModbusDeviceStructureService(
			database,
			lock,
			devices,
			new DeviceValidationService(devices),
			endpoints,
			runtime as unknown as ModbusRuntimeService,
			values as unknown as PropertyValueService,
		);
	});

	afterEach(async () => {
		if (database?.isInitialized) await database.destroy();
		useContainer({ get: <T>(type: new () => T) => new type() }, { fallbackOnErrors: true });
	});

	const counts = async () => ({
		devices: await database.manager.count(DeviceEntity),
		channels: await database.manager.count(ChannelEntity),
		properties: await database.manager.count(ChannelPropertyEntity),
		bindings: await database.manager.count(ModbusBindingEntity),
	});

	it('creates the N4D8B08 relay structure atomically', async () => {
		const device = await service.create(toDto(relayBoard(endpoint.id)));

		expect(device).toBeInstanceOf(ModbusDeviceEntity);
		expect(device).toMatchObject({ modbusEndpointId: endpoint.id, modbusUnitId: 1, category: DeviceCategory.SWITCHER });
		expect(device.channels).toHaveLength(8);
		expect(await counts()).toEqual({ devices: 1, channels: 8, properties: 8, bindings: 16 });

		const rows = await bindings.findByDevice(device.id);

		expect(rows).toHaveLength(16);
		expect(rows.filter((row) => row.role === ModbusBindingRole.READ)).toHaveLength(8);

		const relay3 = device.channels.find((channel) => channel.identifier === 'relay_3');
		const pair = await bindings.findByProperty(relay3.properties[0].id);

		expect(pair.read).toMatchObject({
			registerType: holding,
			address: 3,
			dataType: ModbusDataType.UINT16,
			valueMap: [
				{ raw: 1, value: true },
				{ raw: 0, value: false },
			],
			scale: 1,
			offset: 0,
			invert: false,
			writeFunction: null,
		});
		expect(pair.write).toMatchObject({
			address: 3,
			valueMap: [
				{ raw: 256, value: true },
				{ raw: 512, value: false },
			],
			writeFunction: ModbusWriteFunction.SINGLE,
		});
		expect(runtime.loadDevice).toHaveBeenCalledWith(device.id);
	});

	it('rolls back everything when a binding fails', async () => {
		let inserts = 0;

		database.subscribers.push({
			listenTo: () => ModbusBindingEntity,
			beforeInsert: () => {
				inserts++;

				if (inserts === 2) throw new Error('binding insert failed');
			},
		});

		await expect(service.create(toDto(relayBoard(endpoint.id)))).rejects.toThrow('binding insert failed');
		expect(await counts()).toEqual({ devices: 0, channels: 0, properties: 0, bindings: 0 });
		expect(runtime.loadDevice).not.toHaveBeenCalled();
	});

	it('refuses a duplicate unit on the same endpoint', async () => {
		await service.create(toDto(relayBoard(endpoint.id, 2)));

		expect(await reasonsOf(service.create(toDto(relayBoard(endpoint.id, 2))))).toEqual([
			{ field: 'unit_id', reason: expect.stringContaining('already used') as string },
		]);
		expect((await counts()).devices).toBe(1);
	});

	it('allows the same unit on another endpoint', async () => {
		await service.create(toDto(relayBoard(endpoint.id, 2)));

		await expect(service.create(toDto(relayBoard(otherEndpoint.id, 2)))).resolves.toBeInstanceOf(ModbusDeviceEntity);
		expect((await counts()).devices).toBe(2);
	});

	it('refuses an unknown endpoint', async () => {
		expect(await reasonsOf(service.create(toDto(relayBoard(uuid()))))).toEqual([
			{ field: 'endpoint_id', reason: expect.any(String) as string },
		]);
	});

	it('refuses rw properties without a read binding', async () => {
		const dto = singleRelay(endpoint.id, (base) => ({ ...base, read: undefined }));

		expect(await reasonsOf(service.create(toDto(dto)))).toContainEqual({
			field: 'channels[0].properties[0].read',
			reason: expect.any(String) as string,
		});
		expect(await counts()).toEqual({ devices: 0, channels: 0, properties: 0, bindings: 0 });
	});

	it('refuses a device without any read binding', async () => {
		const dto = singleRelay(endpoint.id, (base) => ({
			...base,
			permissions: [PermissionType.WRITE_ONLY],
			read: undefined,
		}));

		expect(await reasonsOf(service.create(toDto(dto)))).toContainEqual({
			field: 'channels',
			reason: expect.stringContaining('read binding') as string,
		});
	});

	it('refuses read bindings on write-only properties and write bindings on read-only properties', async () => {
		const wo = singleRelay(endpoint.id, (base) => ({ ...base, permissions: [PermissionType.WRITE_ONLY] }));
		const ro = singleRelay(endpoint.id, (base) => ({ ...base, permissions: [PermissionType.READ_ONLY] }));

		expect(await reasonsOf(service.create(toDto(wo)))).toContainEqual({
			field: 'channels[0].properties[0].read',
			reason: expect.any(String) as string,
		});
		expect(await reasonsOf(service.create(toDto(ro)))).toContainEqual({
			field: 'channels[0].properties[0].write',
			reason: expect.any(String) as string,
		});
	});

	it('refuses bit write bindings', async () => {
		const dto = singleRelay(endpoint.id, (base) => ({
			...base,
			read: { register_type: holding, address: 4, data_type: ModbusDataType.BOOL, bit: 3 },
			write: { register_type: holding, address: 4, data_type: ModbusDataType.BOOL, bit: 3 },
		}));

		expect(await reasonsOf(service.create(toDto(dto)))).toEqual([
			{ field: 'channels[0].properties[0].write.bit', reason: expect.any(String) as string },
		]);
	});

	it('accepts bit read bindings on registers', async () => {
		const dto = singleRelay(endpoint.id, (base) => ({
			...base,
			permissions: [PermissionType.READ_ONLY],
			read: { register_type: holding, address: 4, data_type: ModbusDataType.BOOL, bit: 15 },
			write: undefined,
		}));

		await expect(service.create(toDto(dto))).resolves.toBeInstanceOf(ModbusDeviceEntity);
	});

	it('refuses value_map with scale', async () => {
		const dto = singleRelay(endpoint.id, (base) => ({
			...base,
			read: { ...(base.read as Plain), scale: 10 },
		}));

		expect(await reasonsOf(service.create(toDto(dto)))).toEqual([
			{ field: 'channels[0].properties[0].read.value_map', reason: expect.any(String) as string },
		]);
	});

	it('refuses two writes to the same register', async () => {
		const board = relayBoard(endpoint.id);
		const channels = board.channels as Plain[];
		const second = (channels[1].properties as Plain[])[0];

		second.write = { ...(second.write as Plain), address: 1 };

		expect(await reasonsOf(service.create(toDto(board)))).toEqual([
			{ field: 'channels[1].properties[0].write.address', reason: expect.any(String) as string },
		]);
	});

	it('refuses overlapping 32-bit writes', async () => {
		const board = relayBoard(endpoint.id);
		const [first, second] = (board.channels as Plain[]).map((channel) => (channel.properties as Plain[])[0]);

		first.write = {
			register_type: holding,
			address: 10,
			data_type: ModbusDataType.UINT32,
			write_function: ModbusWriteFunction.MULTIPLE,
		};
		first.read = { register_type: holding, address: 10, data_type: ModbusDataType.UINT32 };
		second.write = { register_type: holding, address: 11, data_type: ModbusDataType.UINT16 };

		expect(await reasonsOf(service.create(toDto(board)))).toContainEqual({
			field: 'channels[1].properties[0].write.address',
			reason: expect.any(String) as string,
		});
	});

	it('refuses structures the spec rejects', async () => {
		const dto = { ...relayBoard(endpoint.id), category: DeviceCategory.INPUT_CONTROLLER };

		const reasons = await reasonsOf(service.create(toDto(dto)));

		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.every((r) => r.field.startsWith('channels') || r.field === 'category')).toBe(true);
		expect(await counts()).toEqual({ devices: 0, channels: 0, properties: 0, bindings: 0 });
	});

	describe('binding rules', () => {
		const rejects = async (read: Plain, field: string, write?: Plain) => {
			const dto = singleRelay(endpoint.id, (base) => ({
				...base,
				permissions: [write ? PermissionType.READ_WRITE : PermissionType.READ_ONLY],
				read,
				write,
			}));

			expect(await reasonsOf(service.create(toDto(dto)))).toContainEqual({
				field,
				reason: expect.any(String) as string,
			});
		};
		const at = 'channels[0].properties[0]';

		it('requires bool for coils and discrete inputs and refuses a bit on them', async () => {
			await rejects(
				{ register_type: ModbusRegisterType.COIL, address: 0, data_type: ModbusDataType.UINT16 },
				`${at}.read.data_type`,
			);
			await rejects(
				{ register_type: ModbusRegisterType.DISCRETE_INPUT, address: 0, data_type: ModbusDataType.BOOL, bit: 1 },
				`${at}.read.bit`,
			);
		});

		it('requires bool and a 0-15 bit for bit bindings', async () => {
			await rejects({ register_type: holding, address: 0, data_type: ModbusDataType.UINT16, bit: 1 }, `${at}.read.bit`);
			await rejects({ register_type: holding, address: 0, data_type: ModbusDataType.BOOL, bit: 16 }, `${at}.read.bit`);
		});

		it('allows writes only to coils and holding registers', async () => {
			await rejects(
				{ register_type: ModbusRegisterType.INPUT_REGISTER, address: 0, data_type: ModbusDataType.UINT16 },
				`${at}.write.register_type`,
				{ register_type: ModbusRegisterType.INPUT_REGISTER, address: 0, data_type: ModbusDataType.UINT16 },
			);
		});

		it('refuses value_map on float32, value_map with invert and non-unique maps', async () => {
			await rejects(
				{ register_type: holding, address: 0, data_type: ModbusDataType.FLOAT32, value_map: [{ raw: 1, value: 1 }] },
				`${at}.read.value_map`,
			);
			await rejects(
				{
					register_type: holding,
					address: 0,
					data_type: ModbusDataType.UINT16,
					invert: true,
					value_map: [{ raw: 1, value: true }],
				},
				`${at}.read.invert`,
			);
			await rejects(
				{
					register_type: holding,
					address: 0,
					data_type: ModbusDataType.UINT16,
					value_map: [
						{ raw: 1, value: true },
						{ raw: 1, value: false },
					],
				},
				`${at}.read.value_map`,
			);
			await rejects(
				{
					register_type: holding,
					address: 0,
					data_type: ModbusDataType.UINT16,
					value_map: [
						{ raw: 1, value: true },
						{ raw: 2, value: true },
					],
				},
				`${at}.read.value_map`,
			);
		});

		it('refuses an address range past the end of the table', async () => {
			await rejects({ register_type: holding, address: 65535, data_type: ModbusDataType.UINT32 }, `${at}.read.address`);
		});

		it('refuses single-register writes of 32-bit values', async () => {
			await rejects(
				{ register_type: holding, address: 0, data_type: ModbusDataType.UINT32 },
				`${at}.write.write_function`,
				{
					register_type: holding,
					address: 0,
					data_type: ModbusDataType.UINT32,
					write_function: ModbusWriteFunction.SINGLE,
				},
			);
		});
	});

	describe('static properties', () => {
		const withStatic = (staticProperty: Plain): Plain => {
			const board = singleRelay(endpoint.id, (base) => base);
			const [channel] = board.channels as Plain[];

			return {
				...board,
				channels: [
					{
						...channel,
						properties: [...(channel.properties as Plain[]), staticProperty],
					},
				],
			};
		};

		const staticName = {
			category: PropertyCategory.GENERIC,
			data_type: DataTypeType.STRING,
			permissions: [PermissionType.READ_ONLY],
			static_value: 'relay',
		};

		it('writes static values after commit', async () => {
			const device = await service.create(toDto(withStatic(staticName)));

			const property = device.channels[0].properties.find((p) => p.category === PropertyCategory.GENERIC);

			expect(values.write).toHaveBeenCalledWith(expect.objectContaining({ id: property.id }), 'relay');
			expect((await bindings.findByProperty(property.id)).read).toBeNull();
		});

		it('refuses bindings on static properties', async () => {
			const dto = withStatic({
				...staticName,
				read: { register_type: holding, address: 20, data_type: ModbusDataType.UINT16 },
			});

			expect(await reasonsOf(service.create(toDto(dto)))).toContainEqual({
				field: 'channels[0].properties[1].read',
				reason: expect.any(String) as string,
			});
		});

		it('refuses a static value that does not match the data type', async () => {
			const dto = withStatic({ ...staticName, static_value: 5 });

			expect(await reasonsOf(service.create(toDto(dto)))).toContainEqual({
				field: 'channels[0].properties[1].static_value',
				reason: expect.any(String) as string,
			});
		});
	});

	it('keeps the committed device when the runtime fails to load it', async () => {
		runtime.loadDevice.mockRejectedValueOnce(new Error('runtime down'));

		const device = await service.create(toDto(relayBoard(endpoint.id)));

		expect(device.id).toBeDefined();
		expect((await counts()).bindings).toBe(16);
	});
});
