import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_MODBUS_TYPE, ModbusByteOrder } from '../devices-modbus.constants';

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
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['endpoint_id'] ?? obj['modbusEndpointId'] ?? null) as string | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', nullable: true })
	modbusEndpointId: string | null;

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
		({ obj }: { obj: Record<string, unknown> }) => (obj['unit_id'] ?? obj['modbusUnitId'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'integer', nullable: true })
	modbusUnitId: number | null;

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
			(obj['poll_interval_ms'] ?? obj['modbusPollIntervalMs'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'integer', nullable: true })
	modbusPollIntervalMs: number | null;

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
			(obj['byte_order'] ?? obj['modbusByteOrder'] ?? null) as ModbusByteOrder | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', nullable: true })
	modbusByteOrder: ModbusByteOrder | null;

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
			(obj['word_order'] ?? obj['modbusWordOrder'] ?? null) as ModbusByteOrder | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', nullable: true })
	modbusWordOrder: ModbusByteOrder | null;

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
			(obj['max_read_registers'] ?? obj['modbusMaxReadRegisters'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'integer', nullable: true })
	modbusMaxReadRegisters: number | null;

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
			(obj['max_read_bits'] ?? obj['modbusMaxReadBits'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'integer', nullable: true })
	modbusMaxReadBits: number | null;

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
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['max_read_gap'] ?? obj['modbusMaxReadGap'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'integer', nullable: true })
	modbusMaxReadGap: number | null;

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
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['template_id'] ?? obj['modbusTemplateId'] ?? null) as string | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', nullable: true })
	modbusTemplateId: string | null;

	@ApiPropertyOptional({
		name: 'template_revision',
		description: 'Template revision applied',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'template_revision' })
	@IsOptional()
	@IsInt()
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) =>
			(obj['template_revision'] ?? obj['modbusTemplateRevision'] ?? null) as number | null,
		{ toClassOnly: true },
	)
	@Column({ type: 'integer', nullable: true })
	modbusTemplateRevision: number | null;

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
