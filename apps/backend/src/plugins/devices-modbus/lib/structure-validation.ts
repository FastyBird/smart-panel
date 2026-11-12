import { plainToInstance } from 'class-transformer';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	ChannelDataInput,
	ValidationIssue,
	ValidationIssueSeverity,
} from '../../../modules/devices/services/device-validation.service';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import {
	MODBUS_DEFAULTS,
	MODBUS_LIMITS,
	ModbusBindingRole,
	ModbusDataType,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusBindingDto } from '../dto/binding.dto';
import {
	CreateModbusDeviceStructureChannelDto,
	CreateModbusDeviceStructureDto,
	CreateModbusDeviceStructurePropertyDto,
} from '../dto/create-device-structure.dto';

import type { ModbusButtonEvent } from './button-synthesizer';
import { registerSpan } from './codec';

export type ModbusStructureIssue = { field: string; reason: string };

/** Judges a device structure against the core device specification; the service backs it with `DeviceValidationService`. */
export type SpecificationValidator = (input: {
	category: DeviceCategory;
	channels: ChannelDataInput[];
}) => ValidationIssue[];

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

/** Defaults of the `device_information` channel added when the request carries none. */
const DEVICE_INFORMATION_DEFAULTS = {
	MANUFACTURER: 'Generic',
	MODEL: 'Modbus device',
} as const;

const span = (binding: ModbusBindingDto): number =>
	BIT_TABLES.has(binding.register_type) ? 1 : registerSpan(binding.data_type);

/**
 * The read planner never splits a value, so every register read binding must fit into one request: a 32-bit value
 * needs `max_read_registers` of at least 2.
 */
export function readLimitIssue(
	maxReadRegisters: number,
	reads: Array<{ registerType: ModbusRegisterType; dataType: ModbusDataType }>,
): ModbusStructureIssue | null {
	const widest = Math.max(
		0,
		...reads.filter((read) => !BIT_TABLES.has(read.registerType)).map((read) => registerSpan(read.dataType)),
	);

	return widest > maxReadRegisters
		? {
				field: 'max_read_registers',
				reason: `A read binding spans two registers, so max_read_registers must be at least ${widest}.`,
			}
		: null;
}

/**
 * The core requires a `device_information` channel with `manufacturer`, `model` and `serial_number` on every
 * device, and its connectivity service only adds the connection `status` property to whatever channel of that
 * category exists. Unless the request brings its own, a real channel is created here with the three required
 * properties as static values, so the stored device passes the core validation. The serial number defaults to the
 * endpoint address and unit, which is the device's identity on the bus.
 */
export function withDeviceInformation(
	dto: CreateModbusDeviceStructureDto,
	serialNumber: string,
): CreateModbusDeviceStructureDto {
	if (dto.channels.some((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION)) {
		return dto;
	}

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

/**
 * `keptStatic` names the properties a points update keeps as stored static values: sent with their ID, without a
 * value and without bindings. They are not read from the device, so they need no read binding.
 */
export function validateModbusStructure(
	dto: CreateModbusDeviceStructureDto,
	validateSpecification: SpecificationValidator,
	keptStatic: ReadonlySet<string> = new Set(),
): ModbusStructureIssue[] {
	const issues: ModbusStructureIssue[] = [];
	const writes: { binding: ModbusBindingDto; field: string }[] = [];
	const ids = new Set<string>();
	const channelIdentifiers = new Set<string>();
	const readBindings: ModbusBindingDto[] = [];

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

			issues.push(
				...validateProperty(channel, property, field, property.id !== undefined && keptStatic.has(property.id)),
			);

			if (property.read) {
				readBindings.push(property.read);
				issues.push(...validateBinding(property.read, ModbusBindingRole.READ, `${field}.read`));
				issues.push(...validateLongPress(property.read, isButtonEvent(channel, property), `${field}.read`));
			}

			if (property.write) {
				issues.push(...validateBinding(property.write, ModbusBindingRole.WRITE, `${field}.write`));
				writes.push({ binding: property.write, field: `${field}.write` });
			}
		});
	});

	const readLimit = readLimitIssue(
		dto.max_read_registers ?? MODBUS_DEFAULTS.MAX_READ_REGISTERS,
		readBindings.map((binding) => ({ registerType: binding.register_type, dataType: binding.data_type })),
	);

	if (readLimit) {
		issues.push(readLimit);
	}

	if (readBindings.length === 0) {
		issues.push({
			field: 'channels',
			reason: 'A device needs at least one read binding, so its connection state reflects the device.',
		});
	}

	issues.push(...validateWriteTargets(writes));
	issues.push(...specificationIssues(dto, validateSpecification));

	return issues;
}

/** The events the runtime synthesises from a button level; a declared format has to offer all of them. */
const BUTTON_EVENTS: readonly ModbusButtonEvent[] = ['down', 'up', 'press', 'long_press'];

/** The one `ev` property that may be read: the level the button events are synthesised from. */
const isButtonEvent = (
	channel: CreateModbusDeviceStructureChannelDto,
	property: CreateModbusDeviceStructurePropertyDto,
): boolean =>
	channel.category === ChannelCategory.BUTTON &&
	property.category === PropertyCategory.EVENT &&
	(property.permissions ?? []).includes(PermissionType.EVENT_ONLY);

function validateProperty(
	channel: CreateModbusDeviceStructureChannelDto,
	property: CreateModbusDeviceStructurePropertyDto,
	field: string,
	keptStatic: boolean,
): ModbusStructureIssue[] {
	const issues: ModbusStructureIssue[] = [];
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

		if (!matchesDataType(property.static_value, property.data_type, property.format)) {
			issues.push({
				field: `${field}.static_value`,
				reason: `Static value does not match the ${property.data_type} data type.`,
			});
		}

		return issues;
	}

	const buttonEvent = isButtonEvent(channel, property);

	if (buttonEvent && property.format !== undefined && property.format !== null) {
		const missing = BUTTON_EVENTS.filter((event) => !(property.format as unknown[]).includes(event));

		if (missing.length > 0) {
			issues.push({
				field: `${field}.format`,
				reason: `A button event format must contain every synthesised event; missing: ${missing.join(', ')}.`,
			});
		}
	}

	if (canRead && !property.read && !keptStatic) {
		issues.push({
			field: `${field}.read`,
			reason: 'A readable property needs a read binding, so every command is confirmed by reading the device.',
		});
	}

	if (property.read && !canRead && !buttonEvent) {
		issues.push({
			field: `${field}.read`,
			reason: permissions.includes(PermissionType.EVENT_ONLY)
				? 'Only the button event property takes a read binding among event properties.'
				: 'A read binding needs the ro or rw permission.',
		});
	}

	if (property.write && !canWrite) {
		issues.push({ field: `${field}.write`, reason: 'A write binding needs the rw or wo permission.' });
	}

	return issues;
}

/** A button event is synthesised from a boolean level, and only that binding takes a long-press time. */
function validateLongPress(binding: ModbusBindingDto, buttonEvent: boolean, field: string): ModbusStructureIssue[] {
	const issues: ModbusStructureIssue[] = [];
	const bitTable = BIT_TABLES.has(binding.register_type);
	const hasBit = binding.bit !== undefined && binding.bit !== null;

	if (buttonEvent && !(bitTable || (hasBit && binding.data_type === ModbusDataType.BOOL))) {
		issues.push({
			field: `${field}.data_type`,
			reason: 'A button event reads a boolean level: use a coil, a discrete input or a register bit.',
		});
	}

	if (buttonEvent && binding.value_map) {
		issues.push({
			field: `${field}.value_map`,
			reason: 'A button event reads a boolean level and takes no value map; use invert to flip it.',
		});
	}

	if (binding.long_press_ms !== undefined && binding.long_press_ms !== null) {
		if (!buttonEvent) {
			issues.push({
				field: `${field}.long_press_ms`,
				reason: 'A long-press time applies to the read binding of a button event only.',
			});
		} else if (
			!Number.isInteger(binding.long_press_ms) ||
			binding.long_press_ms < MODBUS_LIMITS.MIN_LONG_PRESS_MS ||
			binding.long_press_ms > MODBUS_LIMITS.MAX_LONG_PRESS_MS
		) {
			issues.push({
				field: `${field}.long_press_ms`,
				reason: `Long press must be an integer between ${MODBUS_LIMITS.MIN_LONG_PRESS_MS} and ${MODBUS_LIMITS.MAX_LONG_PRESS_MS} ms.`,
			});
		}
	}

	return issues;
}

function matchesDataType(
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

function validateBinding(binding: ModbusBindingDto, role: ModbusBindingRole, field: string): ModbusStructureIssue[] {
	const issues: ModbusStructureIssue[] = [];
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

	if (binding.scale === 0) {
		issues.push({ field: `${field}.scale`, reason: 'Scale cannot be 0, it would turn every value into 0.' });
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
function validateWriteTargets(writes: { binding: ModbusBindingDto; field: string }[]): ModbusStructureIssue[] {
	const issues: ModbusStructureIssue[] = [];

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
function specificationIssues(
	dto: CreateModbusDeviceStructureDto,
	validate: SpecificationValidator,
): ModbusStructureIssue[] {
	const channels: ChannelDataInput[] = dto.channels.map((channel, index) => ({
		id: String(index),
		category: channel.category,
		properties: channel.properties.map((property) => ({
			category: property.category,
			dataType: property.data_type,
			permissions: property.permissions,
		})),
	}));

	return validate({ category: dto.category, channels })
		.filter((issue) => issue.severity === ValidationIssueSeverity.ERROR)
		.map((issue) => ({ field: specificationField(dto, issue), reason: issue.message }));
}

function specificationField(dto: CreateModbusDeviceStructureDto, issue: ValidationIssue): string {
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
