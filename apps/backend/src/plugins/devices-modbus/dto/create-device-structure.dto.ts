import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { MODBUS_DEFAULTS, MODBUS_LIMITS, ModbusByteOrder } from '../devices-modbus.constants';

import { ModbusBindingDto } from './binding.dto';

const nullToUndefined = ({ value }: { value: unknown }): unknown => (value === null ? undefined : value);

@ApiSchema({ name: 'DevicesModbusPluginCreateDeviceStructureProperty' })
export class CreateModbusDeviceStructurePropertyDto {
	@ApiPropertyOptional({ description: 'Property ID', type: 'string', format: 'uuid' })
	@Expose()
	@Transform(nullToUndefined)
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiPropertyOptional({ description: 'Property identifier', type: 'string', example: 'on' })
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"identifier","reason":"Identifier must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"identifier","reason":"Identifier must be a non-empty string."}]' })
	identifier?: string;

	@ApiPropertyOptional({ description: 'Property name', type: 'string', example: 'Relay state' })
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name?: string;

	@ApiProperty({ description: 'Property category', enum: PropertyCategory, example: PropertyCategory.ON })
	@Expose()
	@IsEnum(PropertyCategory, {
		message: '[{"field":"category","reason":"Category must be a valid property category."}]',
	})
	category: PropertyCategory;

	@ApiProperty({ name: 'data_type', description: 'Property data type', enum: DataTypeType, example: DataTypeType.BOOL })
	@Expose()
	@IsEnum(DataTypeType, { message: '[{"field":"data_type","reason":"Data type must be a valid data type."}]' })
	data_type: DataTypeType;

	@ApiProperty({
		description: 'Property permissions',
		enum: PermissionType,
		isArray: true,
		example: [PermissionType.READ_WRITE],
	})
	@Expose()
	@IsArray({ message: '[{"field":"permissions","reason":"Permissions must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"permissions","reason":"Permissions array cannot be empty."}]' })
	@IsEnum(PermissionType, {
		each: true,
		message: '[{"field":"permissions","reason":"Each permission must be a valid permission type."}]',
	})
	permissions: PermissionType[];

	@ApiPropertyOptional({ description: 'Property unit', type: 'string', example: '°C' })
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"unit","reason":"Unit must be a string."}]' })
	unit?: string;

	@ApiPropertyOptional({
		description: 'Property format',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		example: [0, 100],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"format","reason":"Format must be an array."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'string'))
	@IsString({ each: true, message: '[{"field":"format","reason":"Each format value must be a string."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'number'))
	@IsNumber({}, { each: true, message: '[{"field":"format","reason":"Each format value must be a number."}]' })
	format?: string[] | number[];

	@ApiPropertyOptional({
		name: 'static_value',
		description: 'Fixed value of a static property; a static property has no bindings',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: 'generic',
	})
	@Expose()
	@IsOptional()
	static_value?: string | number | boolean;

	@ApiPropertyOptional({ description: 'Read binding', type: () => ModbusBindingDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ModbusBindingDto)
	read?: ModbusBindingDto;

	@ApiPropertyOptional({ description: 'Write binding', type: () => ModbusBindingDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ModbusBindingDto)
	write?: ModbusBindingDto;
}

@ApiSchema({ name: 'DevicesModbusPluginCreateDeviceStructureChannel' })
export class CreateModbusDeviceStructureChannelDto {
	@ApiPropertyOptional({ description: 'Channel ID', type: 'string', format: 'uuid' })
	@Expose()
	@Transform(nullToUndefined)
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiPropertyOptional({ description: 'Channel identifier', type: 'string', example: 'relay_1' })
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"identifier","reason":"Identifier must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"identifier","reason":"Identifier must be a non-empty string."}]' })
	identifier?: string;

	@ApiProperty({ description: 'Channel name', type: 'string', example: 'Relay 1' })
	@Expose()
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@ApiProperty({ description: 'Channel category', enum: ChannelCategory, example: ChannelCategory.SWITCHER })
	@Expose()
	@IsEnum(ChannelCategory, { message: '[{"field":"category","reason":"Category must be a valid channel category."}]' })
	category: ChannelCategory;

	@ApiProperty({ description: 'Channel properties', type: () => [CreateModbusDeviceStructurePropertyDto] })
	@Expose()
	@IsArray({ message: '[{"field":"properties","reason":"Properties must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"properties","reason":"A channel needs at least one property."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateModbusDeviceStructurePropertyDto)
	properties: CreateModbusDeviceStructurePropertyDto[];
}

@ApiSchema({ name: 'DevicesModbusPluginCreateDeviceStructure' })
export class CreateModbusDeviceStructureDto {
	@ApiPropertyOptional({ description: 'Device ID', type: 'string', format: 'uuid' })
	@Expose()
	@Transform(nullToUndefined)
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({ description: 'Device name', type: 'string', example: 'Relay board' })
	@Expose()
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;

	@ApiProperty({
		description: 'Device category. The generic category is reserved and refused.',
		enum: DeviceCategory,
		example: DeviceCategory.SWITCHER,
	})
	@Expose()
	@IsEnum(DeviceCategory, { message: '[{"field":"category","reason":"Category must be a valid device category."}]' })
	category: DeviceCategory;

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room ID where this device is physically located',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"room_id","reason":"Room ID must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value !== null)
	room_id?: string | null;

	@ApiProperty({
		name: 'endpoint_id',
		description: 'Modbus endpoint the device is attached to',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"endpoint_id","reason":"Value must be a valid UUID."}]' })
	endpoint_id: string;

	@ApiProperty({
		name: 'unit_id',
		description: 'Modbus unit (slave) ID',
		type: 'integer',
		example: MODBUS_DEFAULTS.UNIT_ID,
		minimum: 0,
		maximum: 255,
	})
	@Expose()
	@IsInt({ message: '[{"field":"unit_id","reason":"Value must be an integer."}]' })
	@Min(0, { message: '[{"field":"unit_id","reason":"Value must be at least 0."}]' })
	@Max(255, { message: '[{"field":"unit_id","reason":"Value must be at most 255."}]' })
	unit_id: number;

	@ApiPropertyOptional({
		name: 'poll_interval_ms',
		description: 'Poll interval in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
		minimum: MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS,
		maximum: MODBUS_LIMITS.MAX_POLL_INTERVAL_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"poll_interval_ms","reason":"Value must be an integer."}]' })
	@Min(MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS, {
		message: '[{"field":"poll_interval_ms","reason":"Poll interval must be at least 100 ms."}]',
	})
	@Max(MODBUS_LIMITS.MAX_POLL_INTERVAL_MS, {
		message: '[{"field":"poll_interval_ms","reason":"Poll interval must be at most 86400000 ms (one day)."}]',
	})
	poll_interval_ms?: number;

	@ApiPropertyOptional({
		name: 'byte_order',
		description: 'Default byte order',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.BYTE_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"byte_order","reason":"Order must be big or little."}]' })
	byte_order?: ModbusByteOrder;

	@ApiPropertyOptional({
		name: 'word_order',
		description: 'Default word order',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.WORD_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"word_order","reason":"Order must be big or little."}]' })
	word_order?: ModbusByteOrder;

	@ApiPropertyOptional({
		name: 'max_read_registers',
		description: 'Maximum registers per read request',
		type: 'integer',
		example: MODBUS_DEFAULTS.MAX_READ_REGISTERS,
		minimum: 1,
		maximum: 125,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"max_read_registers","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"max_read_registers","reason":"Value must be at least 1."}]' })
	@Max(125, { message: '[{"field":"max_read_registers","reason":"Value must be at most 125."}]' })
	max_read_registers?: number;

	@ApiPropertyOptional({
		name: 'max_read_bits',
		description: 'Maximum bits per read request',
		type: 'integer',
		example: MODBUS_DEFAULTS.MAX_READ_BITS,
		minimum: 1,
		maximum: 2000,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"max_read_bits","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"max_read_bits","reason":"Value must be at least 1."}]' })
	@Max(2000, { message: '[{"field":"max_read_bits","reason":"Value must be at most 2000."}]' })
	max_read_bits?: number;

	@ApiPropertyOptional({
		name: 'max_read_gap',
		description: 'Maximum gap merged into one read request',
		type: 'integer',
		example: MODBUS_DEFAULTS.MAX_READ_GAP,
		minimum: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"max_read_gap","reason":"Value must be an integer."}]' })
	@Min(0, { message: '[{"field":"max_read_gap","reason":"Value must be at least 0."}]' })
	max_read_gap?: number;

	@ApiPropertyOptional({ name: 'template_id', description: 'Template the device was created from', type: 'string' })
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"template_id","reason":"Value must be a string."}]' })
	template_id?: string;

	@ApiPropertyOptional({
		name: 'template_revision',
		description:
			'Template revision applied: the first 16 lowercase hex characters of the SHA-256 of the template content',
		type: 'string',
		example: '3f2a9c1b7d4e6a05',
		minLength: 1,
		maxLength: MODBUS_LIMITS.TEMPLATE_REVISION_MAX_LENGTH,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"template_revision","reason":"Value must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"template_revision","reason":"Value must be a non-empty string."}]' })
	@MaxLength(MODBUS_LIMITS.TEMPLATE_REVISION_MAX_LENGTH, {
		message: '[{"field":"template_revision","reason":"Value must be at most 128 characters."}]',
	})
	template_revision?: string;

	@ApiPropertyOptional({
		name: 'manufacturer',
		description:
			'Manufacturer stored in the device_information channel when the request carries none; defaults to Generic',
		type: 'string',
		example: 'Eletechsup',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"manufacturer","reason":"Value must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"manufacturer","reason":"Value must be a non-empty string."}]' })
	manufacturer?: string;

	@ApiPropertyOptional({
		name: 'model',
		description:
			'Model stored in the device_information channel when the request carries none; defaults to Modbus device',
		type: 'string',
		example: 'N4D8B08',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"model","reason":"Value must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"model","reason":"Value must be a non-empty string."}]' })
	model?: string;

	@ApiPropertyOptional({
		name: 'serial_number',
		description:
			'Serial number stored in the device_information channel when the request carries none; defaults to <host>:<port>#<unit>',
		type: 'string',
		example: '10.10.0.230:502#1',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"serial_number","reason":"Value must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"serial_number","reason":"Value must be a non-empty string."}]' })
	serial_number?: string;

	@ApiProperty({ description: 'Device channels', type: () => [CreateModbusDeviceStructureChannelDto] })
	@Expose()
	@IsArray({ message: '[{"field":"channels","reason":"Channels must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"channels","reason":"A device needs at least one channel."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateModbusDeviceStructureChannelDto)
	channels: CreateModbusDeviceStructureChannelDto[];
}

@ApiSchema({ name: 'DevicesModbusPluginReqCreateDeviceStructure' })
export class ReqCreateModbusDeviceStructureDto {
	@ApiProperty({ description: 'Device structure data', type: () => CreateModbusDeviceStructureDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateModbusDeviceStructureDto)
	data: CreateModbusDeviceStructureDto;
}
