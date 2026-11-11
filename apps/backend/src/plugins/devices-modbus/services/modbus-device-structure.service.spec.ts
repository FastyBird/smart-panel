import { plainToInstance } from 'class-transformer';
import { useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
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
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	DeviceValidationService,
	ValidationIssueType,
} from '../../../modules/devices/services/device-validation.service';
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
import { UpdateModbusDeviceStructureDto } from '../dto/update-device-structure.dto';
import { UpdateModbusDeviceDto } from '../dto/update-device.dto';
import {
	ModbusChannelEntity,
	ModbusChannelPropertyEntity,
	ModbusDeviceEntity,
} from '../entities/devices-modbus.entity';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import { ModbusConfigModel } from '../models/config.model';

import { ModbusBindingsService } from './modbus-bindings.service';
import { ModbusConnectionsService } from './modbus-connections.service';
import { ModbusDeviceStructureService } from './modbus-device-structure.service';
import { ModbusEndpointsService } from './modbus-endpoints.service';
import { ModbusRuntimeService } from './modbus-runtime.service';
import { ModbusTemplatesService } from './modbus-templates.service';

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
	let devices: DevicesService;
	let channels: ChannelsService;
	let properties: ChannelsPropertiesService;
	let events: EventEmitter2;
	let bindings: ModbusBindingsService;
	let runtime: { loadDevice: jest.Mock };
	let values: { write: jest.Mock; flushHistory: jest.Mock };
	let templates: { has: jest.Mock };
	let endpoint: ModbusEndpointEntity;
	let otherEndpoint: ModbusEndpointEntity;

	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();

		events = new EventEmitter2();
		const lock = new DeviceStructureLockService();
		const devicesMapper = new DevicesTypeMapperService();
		const channelsMapper = new ChannelsTypeMapperService();
		const propertiesMapper = new ChannelsPropertiesTypeMapperService();

		devicesMapper.registerMapping({
			type: DEVICES_MODBUS_TYPE,
			class: ModbusDeviceEntity,
			createDto: CreateModbusDeviceDto,
			updateDto: UpdateModbusDeviceDto,
			// As registered by DevicesModbusPlugin
			beforeUpdate: (device, previous) => service.validateUpdate(device, previous),
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

		properties = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			propertiesMapper,
			{} as never,
			new PropertyValueSourceRegistryService(),
			lock,
			{} as never,
			// Removing a property cancels its command windows; none are open in these tests.
			{ cancel: jest.fn() } as never,
			database,
			events,
		);
		channels = new ChannelsService(
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
		devices = new DevicesService(
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
			{ getPluginConfig: jest.fn(() => new ModbusConfigModel()) } as unknown as ConfigService,
		);

		endpoint = await endpoints.create({ name: 'Gateway', host: '10.10.0.230' });
		otherEndpoint = await endpoints.create({ name: 'Other gateway', host: '10.10.0.231' });

		runtime = { loadDevice: jest.fn().mockResolvedValue(undefined) };
		values = { write: jest.fn().mockResolvedValue(true), flushHistory: jest.fn().mockResolvedValue(undefined) };
		templates = { has: jest.fn().mockReturnValue(true) };
		bindings = new ModbusBindingsService(database.getRepository(ModbusBindingEntity));
		service = new ModbusDeviceStructureService(
			database,
			lock,
			devices,
			new DeviceValidationService(devices),
			endpoints,
			runtime as unknown as ModbusRuntimeService,
			values as unknown as PropertyValueService,
			templates as unknown as ModbusTemplatesService,
			channels,
			properties,
			events,
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
		expect(device).toMatchObject({ endpointId: endpoint.id, unitId: 1, category: DeviceCategory.SWITCHER });
		expect(device.channels).toHaveLength(9);
		expect(device.channels.filter((channel) => channel.category === ChannelCategory.SWITCHER)).toHaveLength(8);
		expect(await counts()).toEqual({ devices: 1, channels: 9, properties: 11, bindings: 16 });

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

	it('stores the template the device came from with its text revision', async () => {
		const device = await service.create(
			toDto({ ...relayBoard(endpoint.id), template_id: 'eletechsup-n4d8b08', template_revision: '1.2.0+3f2a9c1b' }),
		);

		expect(device).toMatchObject({ templateId: 'eletechsup-n4d8b08', templateRevision: '1.2.0+3f2a9c1b' });
	});

	it('creates a device from a loaded template with any revision', async () => {
		const device = await service.create(
			toDto({ ...relayBoard(endpoint.id), template_id: 'qingjun-32di', template_revision: 'abc' }),
		);

		expect(templates.has).toHaveBeenCalledWith('qingjun-32di');
		expect(device).toMatchObject({ templateId: 'qingjun-32di', templateRevision: 'abc' });
	});

	it('refuses a template id without a revision', async () => {
		expect(await reasonsOf(service.create(toDto({ ...relayBoard(endpoint.id), template_id: 'qingjun-32di' })))).toEqual(
			[{ field: 'template_revision', reason: 'is required when template_id is set.' }],
		);
	});

	it('refuses a template that is not loaded', async () => {
		templates.has.mockReturnValue(false);

		expect(
			await reasonsOf(
				service.create(toDto({ ...relayBoard(endpoint.id), template_id: 'missing', template_revision: 'abc' })),
			),
		).toEqual([{ field: 'template_id', reason: 'Template missing is not loaded.' }]);
		expect(await devices.findAll()).toHaveLength(0);
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

	/** A relay whose read binding spans two registers (uint32). */
	const wideRelay = (endpointId: string, unitId = 1): Plain =>
		singleRelay(
			endpointId,
			(base) => ({ ...base, read: { ...(base.read as Plain), data_type: ModbusDataType.UINT32 } }),
			unitId,
		);

	it('refuses max_read_registers below 2 when a read binding spans two registers', async () => {
		expect(await reasonsOf(service.create(toDto({ ...wideRelay(endpoint.id), max_read_registers: 1 })))).toEqual([
			{ field: 'max_read_registers', reason: expect.stringContaining('two registers') as string },
		]);
		expect((await counts()).devices).toBe(0);

		await expect(service.create(toDto({ ...relayBoard(endpoint.id), max_read_registers: 1 }))).resolves.toBeInstanceOf(
			ModbusDeviceEntity,
		);
	});

	describe('device updates through the core devices service', () => {
		const patch = (id: string, fields: Plain) => devices.update(id, { type: DEVICES_MODBUS_TYPE, ...fields } as never);

		const stored = async (id: string) => await database.getRepository(ModbusDeviceEntity).findOneByOrFail({ id });

		it('refuses a unit another device uses on the endpoint and leaves the row untouched', async () => {
			await service.create(toDto(relayBoard(endpoint.id, 2)));
			const device = await service.create(toDto(relayBoard(endpoint.id, 3)));

			expect(await reasonsOf(patch(device.id, { unit_id: 2 }))).toEqual([
				{ field: 'unit_id', reason: expect.stringContaining('already used') as string },
			]);
			expect((await stored(device.id)).unitId).toBe(3);
		});

		it('refuses moving a device to an endpoint where its unit is taken', async () => {
			await service.create(toDto(relayBoard(otherEndpoint.id, 2)));
			const device = await service.create(toDto(relayBoard(endpoint.id, 2)));

			expect(await reasonsOf(patch(device.id, { endpoint_id: otherEndpoint.id }))).toEqual([
				{ field: 'unit_id', reason: expect.stringContaining('already used') as string },
			]);
			expect((await stored(device.id)).endpointId).toBe(endpoint.id);
		});

		it('refuses an unknown endpoint', async () => {
			const device = await service.create(toDto(relayBoard(endpoint.id)));

			expect(await reasonsOf(patch(device.id, { endpoint_id: uuid() }))).toEqual([
				{ field: 'endpoint_id', reason: 'Endpoint does not exist.' },
			]);
			expect((await stored(device.id)).endpointId).toBe(endpoint.id);
		});

		it('accepts a free unit, another endpoint and a plain rename', async () => {
			await service.create(toDto(relayBoard(endpoint.id, 2)));
			const device = await service.create(toDto(relayBoard(endpoint.id, 3)));

			await expect(patch(device.id, { unit_id: 4 })).resolves.toBeDefined();
			await expect(patch(device.id, { endpoint_id: otherEndpoint.id, unit_id: 2 })).resolves.toBeDefined();
			await expect(patch(device.id, { name: 'Renamed' })).resolves.toBeDefined();

			expect(await stored(device.id)).toMatchObject({
				endpointId: otherEndpoint.id,
				unitId: 2,
				name: 'Renamed',
			});
		});

		it('refuses max_read_registers below 2 when a read binding spans two registers', async () => {
			const wide = await service.create(toDto(wideRelay(endpoint.id, 2)));
			const narrow = await service.create(toDto(relayBoard(endpoint.id, 3)));

			expect(await reasonsOf(patch(wide.id, { max_read_registers: 1 }))).toEqual([
				{ field: 'max_read_registers', reason: expect.stringContaining('two registers') as string },
			]);
			expect((await stored(wide.id)).maxReadRegisters).not.toBe(1);

			await expect(patch(narrow.id, { max_read_registers: 1 })).resolves.toBeDefined();
		});
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

			const relay = device.channels.find((channel) => channel.identifier === 'relay_1');
			const property = relay.properties.find((p) => p.category === PropertyCategory.GENERIC);

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

	describe('device information', () => {
		const informationOf = (device: ModbusDeviceEntity) =>
			device.channels.filter((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION);

		const staticValueOf = (device: ModbusDeviceEntity, category: PropertyCategory): unknown => {
			const property = informationOf(device)[0].properties.find((p) => p.category === category);
			const calls = values.write.mock.calls as [ChannelPropertyEntity, unknown][];
			const call = calls.find(([written]) => written.id === property.id);

			return call?.[1];
		};

		it('stores a device_information channel with static defaults', async () => {
			const device = await service.create(toDto(relayBoard(endpoint.id, 7)));

			const [information] = informationOf(device);

			expect(informationOf(device)).toHaveLength(1);
			expect(information).toMatchObject({ identifier: 'device_information', name: 'Device Information' });
			expect(information.properties.map((p) => p.category).sort()).toEqual([
				PropertyCategory.MANUFACTURER,
				PropertyCategory.MODEL,
				PropertyCategory.SERIAL_NUMBER,
			]);
			expect(
				information.properties.every(
					(p) =>
						p.dataType === DataTypeType.STRING &&
						p.permissions.length === 1 &&
						p.permissions[0] === PermissionType.READ_ONLY,
				),
			).toBe(true);
			expect(staticValueOf(device, PropertyCategory.MANUFACTURER)).toBe('Generic');
			expect(staticValueOf(device, PropertyCategory.MODEL)).toBe('Modbus device');
			expect(staticValueOf(device, PropertyCategory.SERIAL_NUMBER)).toBe('10.10.0.230:502#7');
		});

		it('takes manufacturer, model and serial number from the request', async () => {
			const device = await service.create(
				toDto({ ...relayBoard(endpoint.id), manufacturer: 'Eletechsup', model: 'N4D8B08', serial_number: 'SN-1' }),
			);

			expect(staticValueOf(device, PropertyCategory.MANUFACTURER)).toBe('Eletechsup');
			expect(staticValueOf(device, PropertyCategory.MODEL)).toBe('N4D8B08');
			expect(staticValueOf(device, PropertyCategory.SERIAL_NUMBER)).toBe('SN-1');
		});

		it('keeps a device_information channel the request brings', async () => {
			const board = relayBoard(endpoint.id);
			const information = {
				identifier: 'info',
				name: 'Info',
				category: ChannelCategory.DEVICE_INFORMATION,
				properties: [PropertyCategory.MANUFACTURER, PropertyCategory.MODEL, PropertyCategory.SERIAL_NUMBER].map(
					(category) => ({
						category,
						data_type: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
						static_value: `custom ${category}`,
					}),
				),
			};

			const device = await service.create(toDto({ ...board, channels: [...(board.channels as Plain[]), information] }));

			expect(informationOf(device)).toHaveLength(1);
			expect(informationOf(device)[0].identifier).toBe('info');
			expect(staticValueOf(device, PropertyCategory.MODEL)).toBe('custom model');
		});

		it('creates a device that passes the core validation', async () => {
			const device = await service.create(toDto(relayBoard(endpoint.id)));

			const result = await new DeviceValidationService(devices).validateDeviceById(device.id);

			expect(
				result.issues.filter(
					(issue) =>
						issue.type === ValidationIssueType.MISSING_CHANNEL || issue.type === ValidationIssueType.MISSING_PROPERTY,
				),
			).toEqual([]);
			expect(result.isValid).toBe(true);
		});

		it('lets the core connectivity service add status to the same channel', async () => {
			const device = await service.create(toDto(relayBoard(endpoint.id)));
			const state = {
				readLatest: jest.fn().mockResolvedValue({ status: ConnectionState.UNKNOWN }),
				write: jest.fn().mockResolvedValue(undefined),
			};

			await new DeviceConnectivityService(
				devices,
				channels,
				properties,
				state as unknown as DeviceConnectionStateService,
				events,
			).setConnectionState(device.id, { state: ConnectionState.CONNECTED });

			const reloaded = (await devices.getOneOrThrow(device.id)) as ModbusDeviceEntity;
			const information = informationOf(reloaded);

			expect(information).toHaveLength(1);
			expect(information[0].properties.map((p) => p.category).sort()).toEqual([
				PropertyCategory.MANUFACTURER,
				PropertyCategory.MODEL,
				PropertyCategory.SERIAL_NUMBER,
				PropertyCategory.STATUS,
			]);
		});
	});

	describe('points update', () => {
		const GENERIC_REASON = 'The generic category is reserved and cannot be used for Modbus devices.';

		const toUpdate = (plain: Plain): UpdateModbusDeviceStructureDto =>
			plainToInstance(UpdateModbusDeviceStructureDto, plain);

		type PointIds = { channel: string; property: string };

		/** Relay `n` of the board reading and writing `address`, optionally keeping existing channel and property IDs. */
		const relayAt = (n: number, address: number, ids?: PointIds): Plain => {
			const channel = relayChannel(n);
			const [property] = channel.properties as Plain[];

			return {
				...channel,
				id: ids?.channel,
				properties: [
					{
						...property,
						id: ids?.property,
						read: { ...(property.read as Plain), address },
						write: { ...(property.write as Plain), address },
					},
				],
			};
		};

		const createRelays = (relays: number[], unitId = 1, extra: Plain = {}): Promise<ModbusDeviceEntity> =>
			service.create(toDto({ ...relayBoard(endpoint.id, unitId), channels: relays.map(relayChannel), ...extra }));

		const idsOf = (device: ModbusDeviceEntity, identifier = 'relay_1'): PointIds => {
			const channel = device.channels.find((candidate) => candidate.identifier === identifier);

			return { channel: channel.id, property: channel.properties[0].id };
		};

		const fieldsOf = async (promise: Promise<unknown>): Promise<string[]> =>
			(await reasonsOf(promise)).map((issue) => issue.field);

		const rows = async () => ({
			devices: await database.manager.find(DeviceEntity, { order: { id: 'ASC' } }),
			channels: await database.manager.find(ChannelEntity, { order: { id: 'ASC' } }),
			properties: await database.manager.find(ChannelPropertyEntity, { order: { id: 'ASC' } }),
			bindings: await database.manager.find(ModbusBindingEntity, { order: { id: 'ASC' } }),
		});

		it('keeps ids of updated channels and properties', async () => {
			const device = await createRelays([1]);
			const ids = idsOf(device);
			const emitted = jest.spyOn(events, 'emit');

			const updated = await service.update(
				device.id,
				toUpdate({
					category: DeviceCategory.SWITCHER,
					poll_interval_ms: 250,
					channels: [relayAt(1, 11, ids), relayAt(2, 2)],
				}),
			);

			const relay1 = updated.channels.find((channel) => channel.id === ids.channel);
			const relay2 = updated.channels.find((channel) => channel.identifier === 'relay_2');

			expect(relay1?.properties.map((property) => property.id)).toEqual([ids.property]);
			expect(relay2).toBeDefined();
			expect([ids.channel, ids.property]).not.toContain(relay2.id);
			expect(updated.pollIntervalMs).toBe(250);

			const pair = await bindings.findByProperty(ids.property);

			expect(pair.read?.address).toBe(11);
			expect(pair.write?.address).toBe(11);
			expect((await bindings.findByProperty(relay2.properties[0].id)).read?.address).toBe(2);
			expect(await counts()).toEqual({ devices: 1, channels: 3, properties: 5, bindings: 4 });
			expect(emitted).toHaveBeenCalledWith(EventType.CHANNEL_CREATED, expect.objectContaining({ id: relay2.id }));
			expect(emitted).toHaveBeenCalledWith(EventType.DEVICE_UPDATED, expect.objectContaining({ id: device.id }));
		});

		it('swaps channel identifiers between kept channels', async () => {
			const device = await createRelays([1, 2]);
			const relay1 = idsOf(device, 'relay_1');
			const relay2 = idsOf(device, 'relay_2');

			const updated = await service.update(
				device.id,
				toUpdate({
					category: DeviceCategory.SWITCHER,
					channels: [
						{ ...relayAt(1, 1, relay2), identifier: 'relay_1' },
						{ ...relayAt(2, 2, relay1), identifier: 'relay_2' },
					],
				}),
			);

			expect(updated.channels.find((channel) => channel.id === relay2.channel)?.identifier).toBe('relay_1');
			expect(updated.channels.find((channel) => channel.id === relay1.channel)?.identifier).toBe('relay_2');
		});

		it('removes channels that are not listed', async () => {
			const device = await createRelays([1, 2]);
			const relay2 = idsOf(device, 'relay_2');
			const information = device.channels.find((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION);
			const emitted = jest.spyOn(events, 'emit');

			const updated = await service.update(
				device.id,
				toUpdate({ category: DeviceCategory.SWITCHER, channels: [relayAt(1, 1, idsOf(device))] }),
			);

			expect(await database.manager.findOneBy(ChannelEntity, { id: relay2.channel })).toBeNull();
			expect(await database.manager.findOneBy(ChannelPropertyEntity, { id: relay2.property })).toBeNull();
			expect(await bindings.findByProperty(relay2.property)).toEqual({ read: null, write: null });
			expect(await counts()).toEqual({ devices: 1, channels: 2, properties: 4, bindings: 2 });

			const kept = updated.channels.find((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION);

			expect(kept?.id).toBe(information.id);
			expect(kept?.properties.map((property) => property.id).sort()).toEqual(
				information.properties.map((property) => property.id).sort(),
			);
			expect(emitted).toHaveBeenCalledWith(EventType.CHANNEL_DELETED, expect.objectContaining({ id: relay2.channel }));
		});

		it('refuses ids of another device', async () => {
			const device = await createRelays([1]);
			const other = await createRelays([1], 2);

			expect(
				await fieldsOf(
					service.update(
						device.id,
						toUpdate({ category: DeviceCategory.SWITCHER, channels: [relayAt(1, 1, idsOf(other))] }),
					),
				),
			).toContain('channels[0].id');
			expect(
				await fieldsOf(
					service.update(
						device.id,
						toUpdate({
							category: DeviceCategory.SWITCHER,
							channels: [relayAt(1, 1, { channel: idsOf(device).channel, property: idsOf(other).property })],
						}),
					),
				),
			).toContain('channels[0].properties[0].id');
		});

		it('refuses a changed channel category', async () => {
			const device = await createRelays([1]);

			expect(
				await fieldsOf(
					service.update(
						device.id,
						toUpdate({
							category: DeviceCategory.SWITCHER,
							channels: [{ ...relayAt(1, 1, idsOf(device)), category: ChannelCategory.LIGHT }, relayAt(2, 2)],
						}),
					),
				),
			).toContain('channels[0].category');
		});

		it('refuses a device_information channel in the body', async () => {
			const device = await createRelays([1]);
			const information = {
				identifier: 'info',
				name: 'Device Information',
				category: ChannelCategory.DEVICE_INFORMATION,
				properties: [PropertyCategory.MANUFACTURER, PropertyCategory.MODEL, PropertyCategory.SERIAL_NUMBER].map(
					(category) => ({
						category,
						data_type: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
						static_value: 'x',
					}),
				),
			};

			expect(
				await fieldsOf(
					service.update(
						device.id,
						toUpdate({ category: DeviceCategory.SWITCHER, channels: [relayAt(1, 1), information] }),
					),
				),
			).toContain('channels[1].category');
		});

		it('refuses the generic category', async () => {
			const device = await createRelays([1]);

			expect(
				await reasonsOf(
					service.update(device.id, toUpdate({ category: DeviceCategory.GENERIC, channels: [relayAt(1, 1)] })),
				),
			).toContainEqual({ field: 'category', reason: GENERIC_REASON });
			expect(
				await reasonsOf(service.create(toDto({ ...relayBoard(endpoint.id, 2), category: DeviceCategory.GENERIC }))),
			).toContainEqual({ field: 'category', reason: GENERIC_REASON });
		});

		it('refused update changes nothing', async () => {
			const device = await createRelays([1, 2]);
			const before = await rows();

			runtime.loadDevice.mockClear();

			const relay1 = relayAt(1, 1, idsOf(device));
			const [property] = relay1.properties as Plain[];

			expect(
				await fieldsOf(
					service.update(
						device.id,
						toUpdate({
							category: DeviceCategory.SWITCHER,
							poll_interval_ms: 250,
							channels: [
								{
									...relay1,
									properties: [
										{
											...property,
											read: {
												register_type: ModbusRegisterType.COIL,
												address: 1,
												data_type: ModbusDataType.UINT16,
											},
										},
									],
								},
							],
						}),
					),
				),
			).toContain('channels[0].properties[0].read.data_type');
			expect(await rows()).toEqual(before);
			expect(runtime.loadDevice).not.toHaveBeenCalled();
		});

		it('reloads the runtime after commit', async () => {
			const device = await createRelays([1]);
			const ids = idsOf(device);
			let addressSeenByRuntime: number | undefined;

			runtime.loadDevice.mockReset().mockImplementation(async () => {
				addressSeenByRuntime = (await bindings.findByProperty(ids.property)).read?.address;
			});

			await service.update(device.id, toUpdate({ category: DeviceCategory.SWITCHER, channels: [relayAt(1, 7, ids)] }));

			expect(runtime.loadDevice).toHaveBeenCalledTimes(1);
			expect(runtime.loadDevice).toHaveBeenCalledWith(device.id);
			expect(addressSeenByRuntime).toBe(7);
		});

		it('flushes queued history before a kept property changes its data type', async () => {
			const device = await createRelays([1]);
			const ids = idsOf(device);
			const emitted = jest.spyOn(events, 'emit');
			const dataTypeAtFlush: DataTypeType[] = [];

			values.flushHistory.mockImplementation(async () => {
				dataTypeAtFlush.push(
					(await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: ids.property })).dataType,
				);
			});

			const relay1 = relayAt(1, 1, ids);
			const [property] = relay1.properties as Plain[];
			const raw = { register_type: holding, address: 1, data_type: ModbusDataType.UINT16 };

			await service.update(
				device.id,
				toUpdate({
					category: DeviceCategory.SWITCHER,
					channels: [
						{
							...relay1,
							properties: [
								{
									...property,
									data_type: DataTypeType.UCHAR,
									read: raw,
									write: { ...raw, write_function: ModbusWriteFunction.SINGLE },
								},
							],
						},
					],
				}),
			);

			expect(dataTypeAtFlush).toEqual([DataTypeType.BOOL]);
			expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: ids.property })).dataType).toBe(
				DataTypeType.UCHAR,
			);
			expect(emitted).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_UPDATED,
				expect.objectContaining({ id: ids.property }),
			);
		});

		it('treats a null id like an omitted one', async () => {
			const device = await createRelays([1]);
			const relay2 = relayAt(2, 2);
			const [property] = relay2.properties as Plain[];
			const body = {
				category: DeviceCategory.SWITCHER,
				channels: [relayAt(1, 1, idsOf(device)), { ...relay2, id: null, properties: [{ ...property, id: null }] }],
			};

			// Through the DTO transform, as the controller receives it, and as a plain object a caller might pass.
			for (const dto of [toUpdate(body), body as unknown as UpdateModbusDeviceStructureDto]) {
				const updated = await service.update(device.id, dto);

				expect(updated.channels.filter((channel) => channel.identifier === 'relay_2')).toHaveLength(1);
			}
		});

		it('keeps template provenance', async () => {
			const device = await createRelays([1], 1, {
				template_id: 'eletechsup-n4d8b08',
				template_revision: '1.2.0+3f2a9c1b',
			});

			const updated = await service.update(
				device.id,
				toUpdate({ category: DeviceCategory.SWITCHER, channels: [relayAt(1, 3, idsOf(device))] }),
			);

			expect(updated).toMatchObject({
				name: device.name,
				endpointId: endpoint.id,
				unitId: 1,
				templateId: 'eletechsup-n4d8b08',
				templateRevision: '1.2.0+3f2a9c1b',
			});
		});
	});

	describe('endpoint and unit uniqueness in the database', () => {
		beforeEach(async () => {
			// `synchronize` does not build the migration's partial index; this is its statement from
			// 1000000000054-AddModbusDevices, whose own spec covers the migration.
			await database.query(
				`CREATE UNIQUE INDEX "IDX_devices_modbus_endpoint_unit" ON "devices_module_devices" ("modbusEndpointId", "modbusUnitId") WHERE "type" = 'ModbusDeviceEntity'`,
			);
		});

		it('stores the discriminator the index condition names', async () => {
			const device = await service.create(toDto(relayBoard(endpoint.id, 4)));

			expect(await database.query(`SELECT "type" FROM "devices_module_devices" WHERE "id" = ?`, [device.id])).toEqual([
				{ type: 'ModbusDeviceEntity' },
			]);
		});

		it('maps a duplicate the service check missed to a unit_id error and keeps nothing', async () => {
			await service.create(toDto(relayBoard(endpoint.id, 4)));

			// Simulate a concurrent writer that slipped past the service check.
			jest.spyOn(database.getRepository(ModbusDeviceEntity), 'findOne').mockResolvedValueOnce(null);

			expect(await reasonsOf(service.create(toDto(relayBoard(endpoint.id, 4))))).toEqual([
				{ field: 'unit_id', reason: expect.stringContaining('already used') as string },
			]);
			expect(await counts()).toEqual({ devices: 1, channels: 9, properties: 11, bindings: 16 });
		});
	});
});
