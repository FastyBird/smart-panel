import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsDefined,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateBy,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	MODBUS_DEFAULTS,
	MODBUS_LIMITS,
	ModbusByteOrder,
	ModbusFraming,
	ModbusRegisterType,
} from '../devices-modbus.constants';

import { ModbusBindingDto } from './binding.dto';

const MAX_POINTS = 256;

const isProbeValue = (value: unknown): boolean => ['string', 'number', 'boolean'].includes(typeof value);

/** The target forms (a saved endpoint or unsaved details) and the unit shared by every probe request. */
abstract class ProbeModbusTargetDto {
	@ApiPropertyOptional({
		name: 'endpoint_id',
		description: 'Saved endpoint to probe; exclusive with host, port and framing',
		type: 'string',
		format: 'uuid',
		example: '9b2f6d2e-6a4f-4a53-9a0e-3a1f6c1b7e10',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"endpoint_id","reason":"Endpoint ID must be a valid UUID (version 4)."}]' })
	endpoint_id?: string;

	@ApiPropertyOptional({
		description: 'Host name or IP address of unsaved connection details',
		type: 'string',
		example: '10.10.0.230',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"host","reason":"Host must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"host","reason":"Host must be a non-empty string."}]' })
	@MaxLength(255, { message: '[{"field":"host","reason":"Host must be at most 255 characters."}]' })
	host?: string;

	@ApiPropertyOptional({
		description: 'TCP port of unsaved connection details',
		type: 'integer',
		example: MODBUS_DEFAULTS.PORT,
		minimum: 1,
		maximum: 65535,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"port","reason":"Port must be an integer."}]' })
	@Min(1, { message: '[{"field":"port","reason":"Port must be at least 1."}]' })
	@Max(65535, { message: '[{"field":"port","reason":"Port must be at most 65535."}]' })
	port?: number;

	@ApiPropertyOptional({
		description: 'Wire framing of unsaved connection details',
		enum: ModbusFraming,
		example: ModbusFraming.TCP,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusFraming, { message: '[{"field":"framing","reason":"Framing must be tcp or rtu_over_tcp."}]' })
	framing?: ModbusFraming;

	@ApiPropertyOptional({
		name: 'connect_timeout_ms',
		description: 'Connect timeout in milliseconds (unsaved connection details)',
		type: 'integer',
		example: MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"connect_timeout_ms","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"connect_timeout_ms","reason":"Value must be at least 1."}]' })
	@Max(MODBUS_LIMITS.MAX_TIMING_MS, {
		message: '[{"field":"connect_timeout_ms","reason":"Value must be at most 60000."}]',
	})
	connect_timeout_ms?: number;

	@ApiPropertyOptional({
		name: 'request_timeout_ms',
		description: 'Request timeout in milliseconds (unsaved connection details)',
		type: 'integer',
		example: MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"request_timeout_ms","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"request_timeout_ms","reason":"Value must be at least 1."}]' })
	@Max(MODBUS_LIMITS.MAX_TIMING_MS, {
		message: '[{"field":"request_timeout_ms","reason":"Value must be at most 60000."}]',
	})
	request_timeout_ms?: number;

	@ApiProperty({
		name: 'unit_id',
		description: 'Modbus unit (slave) ID',
		type: 'integer',
		example: 1,
		minimum: 0,
		maximum: 255,
	})
	@Expose()
	@IsInt({ message: '[{"field":"unit_id","reason":"Unit ID must be an integer."}]' })
	@Min(0, { message: '[{"field":"unit_id","reason":"Unit ID must be at least 0."}]' })
	@Max(255, { message: '[{"field":"unit_id","reason":"Unit ID must be at most 255."}]' })
	unit_id: number;
}

@ApiSchema({ name: 'DevicesModbusPluginProbeRead' })
export class ProbeModbusReadDto extends ProbeModbusTargetDto {
	@ApiProperty({
		name: 'register_type',
		description: 'Register table',
		enum: ModbusRegisterType,
		example: ModbusRegisterType.HOLDING_REGISTER,
	})
	@Expose()
	@IsEnum(ModbusRegisterType, {
		message:
			'[{"field":"register_type","reason":"Register type must be coil, discrete_input, input_register or holding_register."}]',
	})
	register_type: ModbusRegisterType;

	@ApiProperty({ description: '0-based PDU address', type: 'integer', example: 0, minimum: 0, maximum: 65535 })
	@Expose()
	@IsInt({ message: '[{"field":"address","reason":"Address must be an integer."}]' })
	@Min(0, { message: '[{"field":"address","reason":"Address must be at least 0."}]' })
	@Max(65535, { message: '[{"field":"address","reason":"Address must be at most 65535."}]' })
	address: number;

	@ApiProperty({
		description: 'Number of registers or bits to read (at most 125 registers or 2000 bits)',
		type: 'integer',
		example: 3,
		minimum: 1,
	})
	@Expose()
	@IsInt({ message: '[{"field":"count","reason":"Count must be an integer."}]' })
	@Min(1, { message: '[{"field":"count","reason":"Count must be at least 1."}]' })
	count: number;
}

@ApiSchema({ name: 'DevicesModbusPluginProbePoint' })
export class ProbeModbusPointDto {
	@ApiProperty({
		description: 'Caller-chosen key echoed in the result',
		type: 'string',
		example: 'di_1',
		minLength: 1,
		maxLength: 64,
	})
	@Expose()
	@IsString({ message: '[{"field":"key","reason":"Key must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"key","reason":"Key must be a non-empty string."}]' })
	@MaxLength(64, { message: '[{"field":"key","reason":"Key must be at most 64 characters."}]' })
	key: string;

	@ApiProperty({ description: 'How the point is read and decoded', type: () => ModbusBindingDto })
	@Expose()
	@IsDefined({ message: '[{"field":"binding","reason":"Binding is required."}]' })
	@ValidateNested()
	@Type(() => ModbusBindingDto)
	binding: ModbusBindingDto;
}

@ApiSchema({ name: 'DevicesModbusPluginProbePoints' })
export class ProbeModbusPointsDto extends ProbeModbusTargetDto {
	@ApiPropertyOptional({
		name: 'byte_order',
		description: 'Default byte order for points without an override',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.BYTE_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"byte_order","reason":"Order must be big or little."}]' })
	byte_order?: ModbusByteOrder;

	@ApiPropertyOptional({
		name: 'word_order',
		description: 'Default word order for points without an override',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.WORD_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"word_order","reason":"Order must be big or little."}]' })
	word_order?: ModbusByteOrder;

	@ApiPropertyOptional({
		name: 'max_read_registers',
		description: 'Most registers requested in one read',
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
		description: 'Most bits requested in one read',
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
		description: 'Largest gap of unused addresses a single read may span',
		type: 'integer',
		example: MODBUS_DEFAULTS.MAX_READ_GAP,
		minimum: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"max_read_gap","reason":"Value must be an integer."}]' })
	@Min(0, { message: '[{"field":"max_read_gap","reason":"Value must be at least 0."}]' })
	max_read_gap?: number;

	@ApiProperty({
		description: 'Points to read',
		type: () => [ProbeModbusPointDto],
		minItems: 1,
		maxItems: MAX_POINTS,
	})
	@Expose()
	@IsArray({ message: '[{"field":"points","reason":"Points must be an array."}]' })
	@ArrayMinSize(1, { message: '[{"field":"points","reason":"At least one point is required."}]' })
	@ArrayMaxSize(MAX_POINTS, {
		message: `[{"field":"points","reason":"At most ${MAX_POINTS} points can be read at once."}]`,
	})
	@ValidateNested({ each: true })
	@Type(() => ProbeModbusPointDto)
	points: ProbeModbusPointDto[];
}

@ApiSchema({ name: 'DevicesModbusPluginProbeWrite' })
export class ProbeModbusWriteDto extends ProbeModbusTargetDto {
	@ApiProperty({ description: 'Where and how the value is written', type: () => ModbusBindingDto })
	@Expose()
	@IsDefined({ message: '[{"field":"binding","reason":"Binding is required."}]' })
	@ValidateNested()
	@Type(() => ModbusBindingDto)
	binding: ModbusBindingDto;

	@ApiProperty({
		description: 'Property value to encode and write',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: 99,
	})
	@Expose()
	@IsDefined({ message: '[{"field":"value","reason":"Value must be a string, number or boolean."}]' })
	@ValidateBy({
		name: 'isProbeValue',
		validator: {
			validate: isProbeValue,
			defaultMessage: () => '[{"field":"value","reason":"Value must be a string, number or boolean."}]',
		},
	})
	value: string | number | boolean;

	@ApiPropertyOptional({
		name: 'byte_order',
		description: 'Default byte order when the binding has no override',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.BYTE_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"byte_order","reason":"Order must be big or little."}]' })
	byte_order?: ModbusByteOrder;

	@ApiPropertyOptional({
		name: 'word_order',
		description: 'Default word order when the binding has no override',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.WORD_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"word_order","reason":"Order must be big or little."}]' })
	word_order?: ModbusByteOrder;
}

@ApiSchema({ name: 'DevicesModbusPluginReqProbeRead' })
export class ReqProbeModbusReadDto {
	@ApiProperty({ description: 'Probe read data', type: () => ProbeModbusReadDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Request data is required."}]' })
	@ValidateNested()
	@Type(() => ProbeModbusReadDto)
	data: ProbeModbusReadDto;
}

@ApiSchema({ name: 'DevicesModbusPluginReqProbePoints' })
export class ReqProbeModbusPointsDto {
	@ApiProperty({ description: 'Probe points data', type: () => ProbeModbusPointsDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Request data is required."}]' })
	@ValidateNested()
	@Type(() => ProbeModbusPointsDto)
	data: ProbeModbusPointsDto;
}

@ApiSchema({ name: 'DevicesModbusPluginReqProbeWrite' })
export class ReqProbeModbusWriteDto {
	@ApiProperty({ description: 'Probe write data', type: () => ProbeModbusWriteDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Request data is required."}]' })
	@ValidateNested()
	@Type(() => ProbeModbusWriteDto)
	data: ProbeModbusWriteDto;
}
