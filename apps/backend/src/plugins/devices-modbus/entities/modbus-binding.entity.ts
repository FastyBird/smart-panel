import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	ModbusBindingRole,
	ModbusByteOrder,
	ModbusDataType,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';

/** An array of pairs, because JSON object keys cannot be booleans. */
export type ModbusValueMapEntry = { raw: number; value: string | number | boolean };

type Plain = Record<string, unknown>;

const fromEither =
	<T>(snake: string, camel: string) =>
	({ obj }: { obj: Plain }): T =>
		(obj[snake] ?? obj[camel]) as T;

@ApiSchema({ name: 'DevicesModbusPluginDataBinding' })
@Entity('devices_modbus_bindings')
@Unique('UQ_devices_modbus_binding_property_role', ['propertyId', 'role'])
export class ModbusBindingEntity extends BaseEntity {
	@ApiProperty({ name: 'property_id', description: 'Bound channel property', type: 'string', format: 'uuid' })
	@Expose({ name: 'property_id' })
	@IsString()
	@Transform(fromEither<string>('property_id', 'propertyId'), { toClassOnly: true })
	@Column({ type: 'varchar' })
	propertyId: string;

	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'propertyId', foreignKeyConstraintName: 'FK_devices_modbus_binding_property' })
	property?: ChannelPropertyEntity;

	@ApiProperty({ name: 'device_id', description: 'Owning device', type: 'string', format: 'uuid' })
	@Expose({ name: 'device_id' })
	@IsString()
	@Transform(fromEither<string>('device_id', 'deviceId'), { toClassOnly: true })
	@Index('IDX_devices_modbus_binding_device')
	@Column({ type: 'varchar' })
	deviceId: string;

	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'deviceId', foreignKeyConstraintName: 'FK_devices_modbus_binding_device' })
	device?: DeviceEntity;

	@ApiProperty({ description: 'Binding role', enum: ModbusBindingRole, example: ModbusBindingRole.READ })
	@Expose()
	@IsEnum(ModbusBindingRole)
	@Column({ type: 'varchar' })
	role: ModbusBindingRole;

	@ApiProperty({
		name: 'register_type',
		description: 'Register table',
		enum: ModbusRegisterType,
		example: ModbusRegisterType.HOLDING_REGISTER,
	})
	@Expose({ name: 'register_type' })
	@IsEnum(ModbusRegisterType)
	@Transform(fromEither<ModbusRegisterType>('register_type', 'registerType'), { toClassOnly: true })
	@Column({ type: 'varchar' })
	registerType: ModbusRegisterType;

	@ApiProperty({ description: '0-based PDU address (0-65535)', type: 'integer', example: 100 })
	@Expose()
	@IsInt()
	@Column({ type: 'integer' })
	address: number;

	@ApiProperty({
		name: 'data_type',
		description: 'Value data type',
		enum: ModbusDataType,
		example: ModbusDataType.UINT16,
	})
	@Expose({ name: 'data_type' })
	@IsEnum(ModbusDataType)
	@Transform(fromEither<ModbusDataType>('data_type', 'dataType'), { toClassOnly: true })
	@Column({ type: 'varchar' })
	dataType: ModbusDataType;

	@ApiPropertyOptional({ description: 'Bit index within a register', type: 'integer', nullable: true, example: null })
	@Expose()
	@IsOptional()
	@IsInt()
	@Column({ type: 'integer', nullable: true })
	bit: number | null;

	@ApiPropertyOptional({
		name: 'byte_order',
		description: 'Byte order override',
		enum: ModbusByteOrder,
		nullable: true,
		example: ModbusByteOrder.BIG,
	})
	@Expose({ name: 'byte_order' })
	@IsOptional()
	@IsEnum(ModbusByteOrder)
	@Transform(fromEither<ModbusByteOrder | null>('byte_order', 'byteOrder'), { toClassOnly: true })
	@Column({ type: 'varchar', nullable: true })
	byteOrder: ModbusByteOrder | null;

	@ApiPropertyOptional({
		name: 'word_order',
		description: 'Word order override',
		enum: ModbusByteOrder,
		nullable: true,
		example: ModbusByteOrder.BIG,
	})
	@Expose({ name: 'word_order' })
	@IsOptional()
	@IsEnum(ModbusByteOrder)
	@Transform(fromEither<ModbusByteOrder | null>('word_order', 'wordOrder'), { toClassOnly: true })
	@Column({ type: 'varchar', nullable: true })
	wordOrder: ModbusByteOrder | null;

	@ApiProperty({ description: 'Multiplier applied to the raw value', type: 'number', example: 1 })
	@Expose()
	@IsNumber()
	@Column({ type: 'float', default: 1 })
	scale: number;

	@ApiProperty({ description: 'Offset added after scaling', type: 'number', example: 0 })
	@Expose()
	@IsNumber()
	@Column({ type: 'float', default: 0 })
	offset: number;

	@ApiProperty({ description: 'Invert a boolean value', type: 'boolean', example: false })
	@Expose()
	@IsBoolean()
	@Column({ type: 'boolean', default: false })
	invert: boolean;

	@ApiPropertyOptional({
		name: 'value_map',
		description: 'Raw value to property value mapping',
		type: 'array',
		items: {
			type: 'object',
			properties: {
				raw: { type: 'number' },
				value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
			},
			required: ['raw', 'value'],
		},
		nullable: true,
		example: null,
	})
	@Expose({ name: 'value_map' })
	@IsOptional()
	@Transform(fromEither<ModbusValueMapEntry[] | null>('value_map', 'valueMap'), { toClassOnly: true })
	@Column({ type: 'simple-json', nullable: true })
	valueMap: ModbusValueMapEntry[] | null;

	@ApiPropertyOptional({
		name: 'write_function',
		description: 'Write function code selection',
		enum: ModbusWriteFunction,
		nullable: true,
		example: ModbusWriteFunction.SINGLE,
	})
	@Expose({ name: 'write_function' })
	@IsOptional()
	@IsEnum(ModbusWriteFunction)
	@Transform(fromEither<ModbusWriteFunction | null>('write_function', 'writeFunction'), { toClassOnly: true })
	@Column({ type: 'varchar', nullable: true })
	writeFunction: ModbusWriteFunction | null;

	@ApiPropertyOptional({
		name: 'poll_interval_ms',
		description: 'Per-binding poll interval override in milliseconds',
		type: 'integer',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'poll_interval_ms' })
	@IsOptional()
	@IsInt()
	@Transform(fromEither<number | null>('poll_interval_ms', 'pollIntervalMs'), { toClassOnly: true })
	@Column({ type: 'integer', nullable: true })
	pollIntervalMs: number | null;
}
