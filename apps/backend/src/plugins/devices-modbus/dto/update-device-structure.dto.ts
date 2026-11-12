import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { MODBUS_DEFAULTS, MODBUS_LIMITS, ModbusByteOrder } from '../devices-modbus.constants';

import { CreateModbusDeviceStructureChannelDto } from './create-device-structure.dto';

/**
 * The points of an existing Modbus device. Channels and properties that carry an `id` are updated in place and keep
 * it; channels of the device that are not listed are removed, and every register binding is replaced. Name, room,
 * endpoint and unit stay with the core device PATCH.
 */
@ApiSchema({ name: 'DevicesModbusPluginUpdateDeviceStructure' })
export class UpdateModbusDeviceStructureDto {
	@ApiProperty({
		description: 'Device category. The generic category is reserved and refused.',
		enum: DeviceCategory,
		example: DeviceCategory.SWITCHER,
	})
	@Expose()
	@IsEnum(DeviceCategory, { message: '[{"field":"category","reason":"Category must be a valid device category."}]' })
	category: DeviceCategory;

	@ApiPropertyOptional({
		name: 'poll_interval_ms',
		description: 'Poll interval in milliseconds; left unchanged when omitted',
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
		description: 'Default byte order; left unchanged when omitted',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.BYTE_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"byte_order","reason":"Order must be big or little."}]' })
	byte_order?: ModbusByteOrder;

	@ApiPropertyOptional({
		name: 'word_order',
		description: 'Default word order; left unchanged when omitted',
		enum: ModbusByteOrder,
		example: MODBUS_DEFAULTS.WORD_ORDER,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ModbusByteOrder, { message: '[{"field":"word_order","reason":"Order must be big or little."}]' })
	word_order?: ModbusByteOrder;

	@ApiProperty({
		description:
			'Device channels without the device_information channel, which the device keeps. A channel or property with an id must belong to this device and keeps that id; channels of the device that are not listed are removed.',
		type: () => [CreateModbusDeviceStructureChannelDto],
	})
	@Expose()
	@IsArray({ message: '[{"field":"channels","reason":"Channels must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"channels","reason":"A device needs at least one channel."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateModbusDeviceStructureChannelDto)
	channels: CreateModbusDeviceStructureChannelDto[];
}

@ApiSchema({ name: 'DevicesModbusPluginReqUpdateDeviceStructure' })
export class ReqUpdateModbusDeviceStructureDto {
	@ApiProperty({ description: 'Device points data', type: () => UpdateModbusDeviceStructureDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateModbusDeviceStructureDto)
	data: UpdateModbusDeviceStructureDto;
}
