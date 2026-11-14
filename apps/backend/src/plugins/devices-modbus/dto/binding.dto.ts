import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	MODBUS_DEFAULTS,
	MODBUS_LIMITS,
	ModbusByteOrder,
	ModbusDataType,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginCreateValueMapEntry' })
export class ModbusValueMapEntryDto {
	@ApiProperty({ description: 'Raw value read from or written to the device', type: 'number', example: 1 })
	@Expose()
	@IsNumber({}, { message: '[{"field":"raw","reason":"Raw value must be a number."}]' })
	raw: number;

	@ApiProperty({
		description: 'Property value the raw value stands for',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: true,
	})
	@Expose()
	@IsDefined({ message: '[{"field":"value","reason":"Value must be a string, number or boolean."}]' })
	value: string | number | boolean;
}

@ApiSchema({ name: 'DevicesModbusPluginCreateBinding' })
export class ModbusBindingDto {
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

	@ApiProperty({ description: '0-based PDU address', type: 'integer', example: 1, minimum: 0, maximum: 65535 })
	@Expose()
	@IsInt({ message: '[{"field":"address","reason":"Address must be an integer."}]' })
	@Min(0, { message: '[{"field":"address","reason":"Address must be at least 0."}]' })
	@Max(65535, { message: '[{"field":"address","reason":"Address must be at most 65535."}]' })
	address: number;

	@ApiProperty({
		name: 'data_type',
		description: 'Value data type',
		enum: ModbusDataType,
		example: ModbusDataType.UINT16,
	})
	@Expose()
	@IsEnum(ModbusDataType, {
		message: '[{"field":"data_type","reason":"Data type must be bool, int16, uint16, int32, uint32 or float32."}]',
	})
	data_type: ModbusDataType;

	@ApiPropertyOptional({
		description: 'Bit index within a register (read bindings only)',
		type: 'integer',
		minimum: 0,
		maximum: 15,
		example: 0,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"bit","reason":"Bit must be an integer."}]' })
	@Min(0, { message: '[{"field":"bit","reason":"Bit must be at least 0."}]' })
	@Max(15, { message: '[{"field":"bit","reason":"Bit must be at most 15."}]' })
	bit?: number;

	@ApiPropertyOptional({
		name: 'byte_order',
		description: 'Byte order override; the device default applies when omitted',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.BYTE_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"byte_order","reason":"Order must be big or little."}]' })
	byte_order?: ModbusByteOrder;

	@ApiPropertyOptional({
		name: 'word_order',
		description: 'Word order override; the device default applies when omitted',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.WORD_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"word_order","reason":"Order must be big or little."}]' })
	word_order?: ModbusByteOrder;

	@ApiPropertyOptional({ description: 'Multiplier applied to the raw value', type: 'number', example: 1 })
	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"scale","reason":"Scale must be a number."}]' })
	scale?: number;

	@ApiPropertyOptional({ description: 'Offset added after scaling', type: 'number', example: 0 })
	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"offset","reason":"Offset must be a number."}]' })
	offset?: number;

	@ApiPropertyOptional({ description: 'Invert a boolean value', type: 'boolean', example: false })
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { invert?: unknown } }) => obj.invert, { toClassOnly: true })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"invert","reason":"Invert must be a boolean."}]' })
	invert?: boolean;

	@ApiPropertyOptional({
		name: 'value_map',
		description: 'Raw value to property value mapping; exclusive with scale and offset',
		type: () => [ModbusValueMapEntryDto],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"value_map","reason":"Value map must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"value_map","reason":"Value map must not be empty."}]' })
	@ValidateNested({ each: true })
	@Type(() => ModbusValueMapEntryDto)
	value_map?: ModbusValueMapEntryDto[];

	@ApiPropertyOptional({
		name: 'write_function',
		description: 'Write function code selection (write bindings)',
		enum: ModbusWriteFunction,
		example: ModbusWriteFunction.SINGLE,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusWriteFunction, {
		message: '[{"field":"write_function","reason":"Write function must be single or multiple."}]',
	})
	write_function?: ModbusWriteFunction;

	@ApiPropertyOptional({
		name: 'poll_interval_ms',
		description: 'Per-binding poll interval override in milliseconds',
		type: 'integer',
		minimum: MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS,
		maximum: MODBUS_LIMITS.MAX_POLL_INTERVAL_MS,
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
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
		name: 'long_press_ms',
		description:
			'Hold time in milliseconds after which a press counts as a long press. Allowed on the read binding of a button event only; the default applies when omitted',
		type: 'integer',
		minimum: MODBUS_LIMITS.MIN_LONG_PRESS_MS,
		maximum: MODBUS_LIMITS.MAX_LONG_PRESS_MS,
		example: MODBUS_DEFAULTS.LONG_PRESS_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"long_press_ms","reason":"Value must be an integer."}]' })
	@Min(MODBUS_LIMITS.MIN_LONG_PRESS_MS, {
		message: '[{"field":"long_press_ms","reason":"Long press must be at least 100 ms."}]',
	})
	@Max(MODBUS_LIMITS.MAX_LONG_PRESS_MS, {
		message: '[{"field":"long_press_ms","reason":"Long press must be at most 10000 ms."}]',
	})
	long_press_ms?: number;
}
