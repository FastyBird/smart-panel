import { plainToInstance } from 'class-transformer';
import { DataSource, EntityManager, FindOptionsWhere, In } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	ChannelDataInput,
	DeviceValidationService,
	ValidationIssue,
	ValidationIssueSeverity,
} from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import {
	DEVICES_MODBUS_PLUGIN_NAME,
	DEVICES_MODBUS_TYPE,
	ModbusBindingRole,
	ModbusDataType,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusValidationException } from '../devices-modbus.exceptions';
import { ModbusBindingDto } from '../dto/binding.dto';
import {
	CreateModbusDeviceStructureChannelDto,
	CreateModbusDeviceStructureDto,
	CreateModbusDeviceStructurePropertyDto,
} from '../dto/create-device-structure.dto';
import { CreateModbusDeviceDto } from '../dto/create-device.dto';
import {
	ModbusChannelEntity,
	ModbusChannelPropertyEntity,
	ModbusDeviceEntity,
} from '../entities/devices-modbus.entity';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import { registerSpan } from '../lib/codec';

import { ModbusEndpointsService } from './modbus-endpoints.service';
import { ModbusRuntimeService } from './modbus-runtime.service';

type Issue = { field: string; reason: string };

type StaticValue = { propertyId: string; value: string | number | boolean };

const ADDRESS_SPACE = 65536;

const BIT_TABLES = new Set([ModbusRegisterType.COIL, ModbusRegisterType.DISCRETE_INPUT]);
const WRITABLE_TABLES = new Set([ModbusRegisterType.COIL, ModbusRegisterType.HOLDING_REGISTER]);

const NUMERIC_DATA_TYPES = new Set([
	DataTypeType.CHAR,
	DataTypeType.UCHAR,
	DataTypeType.SHORT,
	DataTypeType.USHORT,
	DataTypeType.INT,
	DataTypeType.UINT,
	DataTypeType.FLOAT,
]);

/** Defaults of the `device_information` channel the service adds when the request carries none. */
const DEVICE_INFORMATION_DEFAULTS = {
	MANUFACTURER: 'Generic',
	MODEL: 'Modbus device',
} as const;

const span = (binding: ModbusBindingDto): number =>
	BIT_TABLES.has(binding.register_type) ? 1 : registerSpan(binding.data_type);

const isUnitCollision = (error: unknown): boolean => {
	const message = `${error instanceof Error ? error.message : ''} ${
		(error as { driverError?: { message?: string } })?.driverError?.message ?? ''
	}`;

	return message.includes('UNIQUE constraint failed') && message.includes('modbusUnitId');
};

/**
 * Creates a Modbus device with its channels, properties and register bindings as one unit: the request is validated
 * completely before anything is written, and every row is written in one transaction through the core device
 * creation context, so a failure leaves nothing behind.
 */
@Injectable()
export class ModbusDeviceStructureService {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusDeviceStructureService');

	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly devicesService: DevicesService,
		private readonly deviceValidation: DeviceValidationService,
		private readonly endpoints: ModbusEndpointsService,
		private readonly runtime: ModbusRuntimeService,
		private readonly propertyValues: PropertyValueService,
	) {}

	async create(dto: CreateModbusDeviceStructureDto): Promise<ModbusDeviceEntity> {
		return this.lock.runExclusive(async () => {
			const endpoint = await this.endpoints.findOne(dto.endpoint_id);
			const structure = this.withDeviceInformation(dto, endpoint);
			const issues = [
				...this.validateStructure(structure),
				...(await this.validateAgainstDatabase(structure, endpoint)),
			];

			if (issues.length > 0) {
				throw new ModbusValidationException(issues.map((issue) => JSON.stringify(issue)));
			}

			const deviceId = dto.id ?? uuid();
			const statics: StaticValue[] = [];

			try {
				await DeviceCreationContext.run(
					(work) => this.dataSource.transaction(work),
					DEVICES_MODBUS_TYPE,
					async (context) => {
						await this.devicesService.create(this.toDeviceDto(dto, deviceId), context);

						for (const channel of structure.channels) {
							await this.insertChannel(context.manager, deviceId, channel, statics);
						}

						return deviceId;
					},
					() => this.activate(deviceId, statics),
				);
			} catch (error) {
				if (isUnitCollision(error)) {
					throw this.unitInUse(dto.unit_id);
				}

				throw error;
			}

			return (await this.devicesService.getOneOrThrow(deviceId)) as ModbusDeviceEntity;
		});
	}

	/**
	 * The core requires a `device_information` channel with `manufacturer`, `model` and `serial_number` on every
	 * device, and its connectivity service only adds the connection `status` property to whatever channel of that
	 * category exists. Unless the request brings its own, a real channel is created here with the three required
	 * properties as static values, so the stored device passes the core validation. The serial number defaults to the
	 * endpoint address and unit, which is the device's identity on the bus.
	 */
	private withDeviceInformation(
		dto: CreateModbusDeviceStructureDto,
		endpoint: ModbusEndpointEntity | null,
	): CreateModbusDeviceStructureDto {
		if (dto.channels.some((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION)) {
			return dto;
		}

		const serialNumber = endpoint ? `${endpoint.host}:${endpoint.port}#${dto.unit_id}` : `#${dto.unit_id}`;
		const values: [PropertyCategory, string][] = [
			[PropertyCategory.MANUFACTURER, dto.manufacturer ?? DEVICE_INFORMATION_DEFAULTS.MANUFACTURER],
			[PropertyCategory.MODEL, dto.model ?? DEVICE_INFORMATION_DEFAULTS.MODEL],
			[PropertyCategory.SERIAL_NUMBER, dto.serial_number ?? serialNumber],
		];

		const channel = plainToInstance(CreateModbusDeviceStructureChannelDto, {
			identifier: 'device_information',
			name: 'Device Information',
			category: ChannelCategory.DEVICE_INFORMATION,
			properties: values.map(([category, value]) => {
				const metadata = getPropertyMetadata(ChannelCategory.DEVICE_INFORMATION, category);

				return {
					identifier: category,
					category,
					data_type: metadata?.data_type ?? DataTypeType.STRING,
					permissions: metadata?.permissions ?? [PermissionType.READ_ONLY],
					static_value: value,
				};
			}),
		});

		return { ...dto, channels: [...dto.channels, channel] };
	}

	private toDeviceDto(dto: CreateModbusDeviceStructureDto, deviceId: string): CreateModbusDeviceDto {
		const fields: Record<string, unknown> = {
			id: deviceId,
			type: DEVICES_MODBUS_TYPE,
			name: dto.name,
			category: dto.category,
			room_id: dto.room_id,
			endpoint_id: dto.endpoint_id,
			unit_id: dto.unit_id,
			poll_interval_ms: dto.poll_interval_ms,
			byte_order: dto.byte_order,
			word_order: dto.word_order,
			max_read_registers: dto.max_read_registers,
			max_read_bits: dto.max_read_bits,
			max_read_gap: dto.max_read_gap,
			template_id: dto.template_id,
			template_revision: dto.template_revision,
		};

		return plainToInstance(
			CreateModbusDeviceDto,
			Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)),
		);
	}

	private async insertChannel(
		manager: EntityManager,
		deviceId: string,
		dto: CreateModbusDeviceStructureChannelDto,
		statics: StaticValue[],
	): Promise<void> {
		const channelId = dto.id ?? uuid();

		await manager.insert(
			ModbusChannelEntity,
			manager.create(ModbusChannelEntity, {
				id: channelId,
				device: deviceId,
				identifier: dto.identifier ?? null,
				name: dto.name,
				category: dto.category,
			}),
		);

		for (const property of dto.properties) {
			const propertyId = property.id ?? uuid();
			const metadata = getPropertyMetadata(dto.category, property.category);
			const specDefaults = metadata?.data_type === property.data_type ? metadata : null;

			await manager.insert(
				ModbusChannelPropertyEntity,
				manager.create(ModbusChannelPropertyEntity, {
					id: propertyId,
					channel: channelId,
					identifier: property.identifier ?? null,
					name: property.name ?? null,
					category: property.category,
					permissions: property.permissions,
					dataType: property.data_type,
					unit: property.unit ?? specDefaults?.unit ?? null,
					format: property.format ?? specDefaults?.format ?? null,
					step: specDefaults?.step ?? null,
				}),
			);

			if (property.static_value !== undefined && property.static_value !== null) {
				statics.push({ propertyId, value: property.static_value });
			}

			for (const [role, binding] of [
				[ModbusBindingRole.READ, property.read],
				[ModbusBindingRole.WRITE, property.write],
			] as const) {
				if (binding) {
					await manager.insert(ModbusBindingEntity, this.toBinding(manager, deviceId, propertyId, role, binding));
				}
			}
		}
	}

	private toBinding(
		manager: EntityManager,
		deviceId: string,
		propertyId: string,
		role: ModbusBindingRole,
		dto: ModbusBindingDto,
	): ModbusBindingEntity {
		return manager.create(ModbusBindingEntity, {
			id: uuid(),
			propertyId,
			deviceId,
			role,
			registerType: dto.register_type,
			address: dto.address,
			dataType: dto.data_type,
			bit: dto.bit ?? null,
			byteOrder: dto.byte_order ?? null,
			wordOrder: dto.word_order ?? null,
			scale: dto.scale ?? 1,
			offset: dto.offset ?? 0,
			invert: dto.invert ?? false,
			valueMap: dto.value_map ? dto.value_map.map(({ raw, value }) => ({ raw, value })) : null,
			writeFunction: dto.write_function ?? null,
			pollIntervalMs: dto.poll_interval_ms ?? null,
		});
	}

	/**
	 * Runs after COMMIT. The device exists at this point, so neither a static value write nor a runtime failure may
	 * turn the request into an error: both are logged, and the runtime loads the device again on its next start.
	 */
	private async activate(deviceId: string, statics: StaticValue[]): Promise<void> {
		if (statics.length > 0) {
			try {
				const properties = await this.dataSource
					.getRepository(ChannelPropertyEntity)
					.find({ where: { id: In(statics.map((entry) => entry.propertyId)) } });

				for (const entry of statics) {
					const property = properties.find((candidate) => candidate.id === entry.propertyId);

					if (property) {
						await this.propertyValues.write(property, entry.value);
					}
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to store static property values for device id=${deviceId}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}

		try {
			await this.runtime.loadDevice(deviceId);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Device id=${deviceId} was created but the runtime failed to load it`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	private unitInUse(unitId: number): ModbusValidationException {
		return new ModbusValidationException([
			JSON.stringify({
				field: 'unit_id',
				reason: `Unit ${unitId} is already used by another device on this endpoint.`,
			}),
		]);
	}

	private async validateAgainstDatabase(
		dto: CreateModbusDeviceStructureDto,
		endpoint: ModbusEndpointEntity | null,
	): Promise<Issue[]> {
		const issues: Issue[] = [];

		if (!endpoint) {
			issues.push({ field: 'endpoint_id', reason: 'Endpoint does not exist.' });
		} else {
			const existing = await this.dataSource.getRepository(ModbusDeviceEntity).findOne({
				where: { modbusEndpointId: dto.endpoint_id, modbusUnitId: dto.unit_id } as FindOptionsWhere<ModbusDeviceEntity>,
			});

			if (existing) {
				issues.push({
					field: 'unit_id',
					reason: `Unit ${dto.unit_id} is already used by device "${existing.name}" on this endpoint.`,
				});
			}
		}

		const channelIds = dto.channels.map((channel, index) => ({ id: channel.id, field: `channels[${index}].id` }));
		const propertyIds = dto.channels.flatMap((channel, index) =>
			channel.properties.map((property, propertyIndex) => ({
				id: property.id,
				field: `channels[${index}].properties[${propertyIndex}].id`,
			})),
		);

		for (const [entity, ids] of [
			[ChannelEntity, channelIds],
			[ChannelPropertyEntity, propertyIds],
		] as const) {
			const supplied = ids.filter((entry): entry is { id: string; field: string } => typeof entry.id === 'string');

			if (supplied.length === 0) {
				continue;
			}

			const taken = await this.dataSource
				.getRepository<ChannelEntity | ChannelPropertyEntity>(entity)
				.find({ select: { id: true }, where: { id: In(supplied.map((entry) => entry.id)) } });

			for (const entry of supplied) {
				if (taken.some((row) => row.id === entry.id)) {
					issues.push({ field: entry.field, reason: `ID ${entry.id} is already in use.` });
				}
			}
		}

		return issues;
	}

	private validateStructure(dto: CreateModbusDeviceStructureDto): Issue[] {
		const issues: Issue[] = [];
		const writes: { binding: ModbusBindingDto; field: string }[] = [];
		const ids = new Set<string>();
		const channelIdentifiers = new Set<string>();
		let reads = 0;

		const claimId = (id: string | undefined, field: string) => {
			if (id === undefined) return;

			if (ids.has(id)) {
				issues.push({ field, reason: `ID ${id} is used more than once in the request.` });
			}

			ids.add(id);
		};

		if (dto.id !== undefined) ids.add(dto.id);

		dto.channels.forEach((channel, channelIndex) => {
			const channelField = `channels[${channelIndex}]`;
			const propertyIdentifiers = new Set<string>();

			claimId(channel.id, `${channelField}.id`);

			if (channel.identifier !== undefined) {
				if (channelIdentifiers.has(channel.identifier)) {
					issues.push({ field: `${channelField}.identifier`, reason: 'Channel identifiers must be unique.' });
				}

				channelIdentifiers.add(channel.identifier);
			}

			channel.properties.forEach((property, propertyIndex) => {
				const field = `${channelField}.properties[${propertyIndex}]`;

				claimId(property.id, `${field}.id`);

				if (property.identifier !== undefined) {
					if (propertyIdentifiers.has(property.identifier)) {
						issues.push({
							field: `${field}.identifier`,
							reason: 'Property identifiers must be unique within a channel.',
						});
					}

					propertyIdentifiers.add(property.identifier);
				}

				issues.push(...this.validateProperty(property, field));

				if (property.read) {
					reads++;
					issues.push(...this.validateBinding(property.read, ModbusBindingRole.READ, `${field}.read`));
				}

				if (property.write) {
					issues.push(...this.validateBinding(property.write, ModbusBindingRole.WRITE, `${field}.write`));
					writes.push({ binding: property.write, field: `${field}.write` });
				}
			});
		});

		if (reads === 0) {
			issues.push({
				field: 'channels',
				reason: 'A device needs at least one read binding, so its connection state reflects the device.',
			});
		}

		issues.push(...this.validateWriteTargets(writes));
		issues.push(...this.validateSpecification(dto));

		return issues;
	}

	private validateProperty(property: CreateModbusDeviceStructurePropertyDto, field: string): Issue[] {
		const issues: Issue[] = [];
		const permissions = property.permissions ?? [];
		const canRead = permissions.some((p) => p === PermissionType.READ_ONLY || p === PermissionType.READ_WRITE);
		const canWrite = permissions.some((p) => p === PermissionType.READ_WRITE || p === PermissionType.WRITE_ONLY);

		if (property.static_value !== undefined && property.static_value !== null) {
			if (property.read) {
				issues.push({ field: `${field}.read`, reason: 'A static property cannot have a read binding.' });
			}

			if (property.write) {
				issues.push({ field: `${field}.write`, reason: 'A static property cannot have a write binding.' });
			}

			if (!this.matchesDataType(property.static_value, property.data_type, property.format)) {
				issues.push({
					field: `${field}.static_value`,
					reason: `Static value does not match the ${property.data_type} data type.`,
				});
			}

			return issues;
		}

		if (canRead && !property.read) {
			issues.push({
				field: `${field}.read`,
				reason: 'A readable property needs a read binding, so every command is confirmed by reading the device.',
			});
		}

		if (property.read && !canRead) {
			issues.push({ field: `${field}.read`, reason: 'A read binding needs the ro or rw permission.' });
		}

		if (property.write && !canWrite) {
			issues.push({ field: `${field}.write`, reason: 'A write binding needs the rw or wo permission.' });
		}

		return issues;
	}

	private matchesDataType(
		value: string | number | boolean,
		dataType: DataTypeType,
		format: string[] | number[] | undefined,
	): boolean {
		if (dataType === DataTypeType.BOOL) return typeof value === 'boolean';
		if (dataType === DataTypeType.STRING) return typeof value === 'string';
		if (dataType === DataTypeType.ENUM) {
			return typeof value === 'string' && (!format || (format as unknown[]).includes(value));
		}
		if (NUMERIC_DATA_TYPES.has(dataType)) return typeof value === 'number' && Number.isFinite(value);

		return true;
	}

	private validateBinding(binding: ModbusBindingDto, role: ModbusBindingRole, field: string): Issue[] {
		const issues: Issue[] = [];
		const bitTable = BIT_TABLES.has(binding.register_type);
		const hasBit = binding.bit !== undefined && binding.bit !== null;

		if (role === ModbusBindingRole.WRITE && !WRITABLE_TABLES.has(binding.register_type)) {
			issues.push({ field: `${field}.register_type`, reason: 'Only coils and holding registers can be written.' });
		}

		if (bitTable && binding.data_type !== ModbusDataType.BOOL) {
			issues.push({ field: `${field}.data_type`, reason: 'Coils and discrete inputs use the bool data type.' });
		}

		if (hasBit) {
			if (role === ModbusBindingRole.WRITE) {
				issues.push({ field: `${field}.bit`, reason: 'Bit-in-register bindings are read-only.' });
			} else if (bitTable) {
				issues.push({ field: `${field}.bit`, reason: 'Coils and discrete inputs do not take a bit index.' });
			} else if (binding.data_type !== ModbusDataType.BOOL) {
				issues.push({ field: `${field}.bit`, reason: 'A bit binding uses the bool data type.' });
			} else if (!Number.isInteger(binding.bit) || binding.bit < 0 || binding.bit > 15) {
				issues.push({ field: `${field}.bit`, reason: 'Bit must be between 0 and 15.' });
			}
		}

		if (binding.address + span(binding) > ADDRESS_SPACE) {
			issues.push({ field: `${field}.address`, reason: 'The binding runs past the end of the address space.' });
		}

		if (binding.value_map) {
			const scaled = (binding.scale !== undefined && binding.scale !== 1) || (binding.offset ?? 0) !== 0;
			const raws = binding.value_map.map((entry) => entry.raw);
			const values = binding.value_map.map((entry) => entry.value);

			if (binding.data_type === ModbusDataType.FLOAT32) {
				issues.push({ field: `${field}.value_map`, reason: 'A value map cannot be used with float32.' });
			} else if (scaled) {
				issues.push({ field: `${field}.value_map`, reason: 'A value map cannot be combined with scale or offset.' });
			} else if (new Set(raws).size !== raws.length) {
				issues.push({ field: `${field}.value_map`, reason: 'Value map raw values must be unique.' });
			} else if (new Set(values).size !== values.length) {
				issues.push({ field: `${field}.value_map`, reason: 'Value map values must be unique.' });
			} else if (values.some((value) => !['string', 'number', 'boolean'].includes(typeof value))) {
				issues.push({ field: `${field}.value_map`, reason: 'Value map values must be strings, numbers or booleans.' });
			}

			if (binding.invert) {
				issues.push({
					field: `${field}.invert`,
					reason: 'Invert cannot be combined with a value map; express the inversion in the map.',
				});
			}
		}

		if (binding.write_function !== undefined && binding.write_function !== null) {
			if (role === ModbusBindingRole.READ) {
				issues.push({ field: `${field}.write_function`, reason: 'A write function applies to write bindings only.' });
			} else if (binding.write_function === ModbusWriteFunction.SINGLE && span(binding) > 1) {
				issues.push({
					field: `${field}.write_function`,
					reason: 'A 32-bit value spans two registers and needs the multiple write function.',
				});
			}
		}

		return issues;
	}

	/** Two writes must never target the same coil or overlap on a holding register. */
	private validateWriteTargets(writes: { binding: ModbusBindingDto; field: string }[]): Issue[] {
		const issues: Issue[] = [];

		writes.forEach((current, index) => {
			const start = current.binding.address;
			const end = start + span(current.binding);

			const clash = writes.slice(0, index).some(({ binding }) => {
				if (binding.register_type !== current.binding.register_type) return false;

				const otherStart = binding.address;
				const otherEnd = otherStart + span(binding);

				return start < otherEnd && otherStart < end;
			});

			if (clash) {
				issues.push({
					field: `${current.field}.address`,
					reason: 'Another write binding in this device already targets this register or coil.',
				});
			}
		});

		return issues;
	}

	/**
	 * Checks the structure, including the `device_information` channel `withDeviceInformation` may have added, against
	 * the device specification. Only error-severity issues reject the request.
	 */
	private validateSpecification(dto: CreateModbusDeviceStructureDto): Issue[] {
		const channels: ChannelDataInput[] = dto.channels.map((channel, index) => ({
			id: String(index),
			category: channel.category,
			properties: channel.properties.map((property) => ({
				category: property.category,
				dataType: property.data_type,
				permissions: property.permissions,
			})),
		}));

		const result = this.deviceValidation.validateDeviceStructure({ category: dto.category, channels });

		return result.issues
			.filter((issue) => issue.severity === ValidationIssueSeverity.ERROR)
			.map((issue) => ({ field: this.specificationField(dto, issue), reason: issue.message }));
	}

	private specificationField(dto: CreateModbusDeviceStructureDto, issue: ValidationIssue): string {
		if (issue.channelId === undefined) {
			return 'channels';
		}

		const channelIndex = Number(issue.channelId);
		const channelField = `channels[${channelIndex}]`;

		if (issue.propertyCategory === undefined) {
			return channelField;
		}

		const propertyIndex = dto.channels[channelIndex].properties.findIndex(
			(property) => property.category === issue.propertyCategory,
		);

		return propertyIndex === -1 ? `${channelField}.properties` : `${channelField}.properties[${propertyIndex}]`;
	}
}
