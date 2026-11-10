import { Expose } from 'class-transformer';
import {
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateIf,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_MODBUS_TYPE, MODBUS_DEFAULTS, MODBUS_LIMITS, ModbusByteOrder } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginUpdateDevice' })
export class UpdateModbusDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: typeof DEVICES_MODBUS_TYPE;

	@ApiPropertyOptional({
		name: 'endpoint_id',
		description: 'Modbus endpoint the device is attached to',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	// Omitted keeps the current endpoint; a Modbus device always has one, so `null` must fail validation here.
	@ValidateIf((_, value) => value !== undefined)
	@IsUUID('4', { message: '[{"field":"endpoint_id","reason":"Value must be a valid UUID."}]' })
	endpoint_id?: string;

	@ApiPropertyOptional({
		name: 'unit_id',
		description: 'Modbus unit (slave) ID',
		type: 'integer',
		example: MODBUS_DEFAULTS.UNIT_ID,
		minimum: 0,
		maximum: 255,
	})
	@Expose()
	// Omitted keeps the current unit; a Modbus device always has one, so `null` must fail validation here.
	@ValidateIf((_, value) => value !== undefined)
	@IsInt({ message: '[{"field":"unit_id","reason":"Value must be an integer."}]' })
	@Min(0, { message: '[{"field":"unit_id","reason":"Value must be at least 0."}]' })
	@Max(255, { message: '[{"field":"unit_id","reason":"Value must be at most 255."}]' })
	unit_id?: number;

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
		example: MODBUS_DEFAULTS.BYTE_ORDER,
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

	@ApiPropertyOptional({
		name: 'template_id',
		description: 'Template the device was created from',
		type: 'string',
		example: 'template',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"template_id","reason":"Value must be a string."}]' })
	template_id?: string;

	@ApiPropertyOptional({
		name: 'template_revision',
		description: 'Template revision applied: the template version and a hash of its content',
		type: 'string',
		example: '1.2.0+3f2a9c1b',
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
}
