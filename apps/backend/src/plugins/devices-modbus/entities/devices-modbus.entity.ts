import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_MODBUS_TYPE, ModbusByteOrder } from '../devices-modbus.constants';

/**
 * Each Modbus property is named the camelCase of its wire name (`unitId` <- `unit_id`): the core `PATCH /devices/:id`
 * keeps only entity fields whose snake_case name the request carried, so a `modbusUnitId` property would be silently
 * dropped from every update. The columns keep their `modbus` prefix on the shared STI table.
 */
@ApiSchema({ name: 'DevicesModbusPluginDataDevice' })
@ChildEntity()
export class ModbusDeviceEntity extends DeviceEntity {
	@ApiPropertyOptional({
		name: 'endpoint_id',
		description: 'Modbus endpoint the device is attached to',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'endpoint_id' })
	@IsOptional()
	@IsUUID()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) => (obj['endpoint_id'] ?? obj['endpointId'] ?? null) as string | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusEndpointId', type: 'varchar', nullable: true })
	endpointId: string | null;

	@ApiPropertyOptional({
		name: 'unit_id',
		description: 'Modbus unit (slave) ID, 0-255',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'unit_id' })
	@IsOptional()
	@IsInt()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) => (obj['unit_id'] ?? obj['unitId'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusUnitId', type: 'integer', nullable: true })
	unitId: number | null;

	@ApiPropertyOptional({
		name: 'poll_interval_ms',
		description: 'Poll interval in milliseconds',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'poll_interval_ms' })
	@IsOptional()
	@IsInt()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['poll_interval_ms'] ?? obj['pollIntervalMs'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusPollIntervalMs', type: 'integer', nullable: true })
	pollIntervalMs: number | null;

	@ApiPropertyOptional({
		name: 'byte_order',
		description: 'Default byte order',
		enum: ModbusByteOrder,
		nullable: true,
		example: null,
	})
	@Expose({ name: 'byte_order' })
	@IsOptional()
	@IsEnum(ModbusByteOrder)
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['byte_order'] ?? obj['byteOrder'] ?? null) as ModbusByteOrder | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusByteOrder', type: 'varchar', nullable: true })
	byteOrder: ModbusByteOrder | null;

	@ApiPropertyOptional({
		name: 'word_order',
		description: 'Default word order',
		enum: ModbusByteOrder,
		nullable: true,
		example: null,
	})
	@Expose({ name: 'word_order' })
	@IsOptional()
	@IsEnum(ModbusByteOrder)
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['word_order'] ?? obj['wordOrder'] ?? null) as ModbusByteOrder | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusWordOrder', type: 'varchar', nullable: true })
	wordOrder: ModbusByteOrder | null;

	@ApiPropertyOptional({
		name: 'max_read_registers',
		description: 'Maximum registers per read request',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'max_read_registers' })
	@IsOptional()
	@IsInt()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['max_read_registers'] ?? obj['maxReadRegisters'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusMaxReadRegisters', type: 'integer', nullable: true })
	maxReadRegisters: number | null;

	@ApiPropertyOptional({
		name: 'max_read_bits',
		description: 'Maximum bits per read request',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'max_read_bits' })
	@IsOptional()
	@IsInt()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['max_read_bits'] ?? obj['maxReadBits'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusMaxReadBits', type: 'integer', nullable: true })
	maxReadBits: number | null;

	@ApiPropertyOptional({
		name: 'max_read_gap',
		description: 'Maximum gap merged into one read request',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'max_read_gap' })
	@IsOptional()
	@IsInt()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) => (obj['max_read_gap'] ?? obj['maxReadGap'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusMaxReadGap', type: 'integer', nullable: true })
	maxReadGap: number | null;

	@ApiPropertyOptional({
		name: 'template_id',
		description: 'Template the device was created from',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'template_id' })
	@IsOptional()
	@IsString()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) => (obj['template_id'] ?? obj['templateId'] ?? null) as string | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusTemplateId', type: 'varchar', nullable: true })
	templateId: string | null;

	@ApiPropertyOptional({
		name: 'template_revision',
		description: 'Template revision applied: the template version and a hash of its content',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'template_revision' })
	@IsOptional()
	@IsString()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['template_revision'] ?? obj['templateRevision'] ?? null) as string | null,
		{ toClassOnly: true },
	)
	@Column({ name: 'modbusTemplateRevision', type: 'varchar', nullable: true })
	templateRevision: string | null;

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_MODBUS_TYPE;
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataChannel' })
@ChildEntity()
export class ModbusChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_MODBUS_TYPE;
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataChannelProperty' })
@ChildEntity()
export class ModbusChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_MODBUS_TYPE;
	}
}
