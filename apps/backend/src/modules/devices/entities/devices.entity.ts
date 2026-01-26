import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInstance,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Validate,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, TableInheritance, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';

@ApiSchema({ name: 'DevicesModuleDataDeviceConnectionStatus' })
export class DeviceConnectionStatus {
	@ApiProperty({ description: 'Device online status', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	online: boolean = false;

	@ApiProperty({ description: 'Device connection state', enum: ConnectionState, example: ConnectionState.CONNECTED })
	@Expose()
	@IsEnum(ConnectionState)
	status: ConnectionState = ConnectionState.UNKNOWN;

	@ApiPropertyOptional({
		name: 'last_changed',
		description: 'Timestamp when connection state last changed',
		type: 'string',
		format: 'date-time',
		example: '2026-01-26T19:30:00.000Z',
		nullable: true,
	})
	@Expose({ name: 'last_changed' })
	@IsOptional()
	lastChanged: Date | null = null;
}

@ApiSchema({ name: 'DevicesModuleDataDevice' })
@Entity('devices_module_devices')
@Unique('UQ_devices_identifier_type', ['identifier', 'type'])
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class DeviceEntity extends BaseEntity {
	@ApiProperty({ description: 'Device category', enum: DeviceCategory, example: DeviceCategory.GENERIC })
	@Expose()
	@IsEnum(DeviceCategory)
	@Column({
		type: 'text',
		enum: DeviceCategory,
		default: DeviceCategory.GENERIC,
	})
	category: DeviceCategory;

	@ApiPropertyOptional({
		description: 'Device unique identifier',
		type: 'string',
		example: 'device-001',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	identifier: string | null;

	@ApiProperty({ description: 'Device name', type: 'string', example: 'Living Room Light' })
	@Expose()
	@IsString()
	@Column()
	name: string;

	@ApiPropertyOptional({
		description: 'Device description',
		type: 'string',
		example: 'Smart bulb in living room',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description: string | null;

	@ApiProperty({ description: 'Device enabled status', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	@Index()
	@Column({ nullable: false, default: true })
	enabled: boolean = true;

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room this device is located in (must be a space with type=room)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'room_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"room_id","reason":"Room ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { room_id?: string; roomId?: string } }) => obj.room_id ?? obj.roomId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ nullable: true, default: null })
	roomId: string | null;

	@ManyToOne(() => SpaceEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'roomId' })
	room: SpaceEntity | null;

	@ApiProperty({
		description: 'Device controls',
		type: 'array',
		items: { $ref: '#/components/schemas/DevicesModuleDataDeviceControl' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DeviceControlEntity)
	@OneToMany(() => DeviceControlEntity, (control) => control.device, { cascade: true, onDelete: 'CASCADE' })
	controls: DeviceControlEntity[];

	@ApiProperty({
		description: 'Device channels',
		type: 'array',
		items: { $ref: '#/components/schemas/DevicesModuleDataChannel' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@OneToMany(() => ChannelEntity, (channel) => channel.device, { cascade: true, onDelete: 'CASCADE' })
	channels: ChannelEntity[];

	@OneToMany('DeviceZoneEntity', 'device')
	deviceZones: import('./device-zone.entity').DeviceZoneEntity[];

	@ApiProperty({
		name: 'zone_ids',
		description: 'IDs of zones this device is assigned to',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['550e8400-e29b-41d4-a716-446655440000'],
	})
	@Expose({ name: 'zone_ids' })
	get zoneIds(): string[] {
		return (this.deviceZones ?? []).map((dz) => dz.zoneId);
	}

	@ApiProperty({ description: 'Device connection status', type: DeviceConnectionStatus })
	@Expose()
	@ValidateNested()
	@Type(() => DeviceConnectionStatus)
	status: DeviceConnectionStatus = new DeviceConnectionStatus();

	@ApiProperty({ description: 'Device type', type: 'string', example: 'device' })
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@ApiSchema({ name: 'DevicesModuleDataDeviceControl' })
@Entity('devices_module_devices_controls')
@Unique(['name', 'device'])
export class DeviceControlEntity extends BaseEntity {
	@ApiProperty({ description: 'Control name', type: 'string', example: 'power' })
	@Expose()
	@IsString()
	@Column()
	name: string;

	@ApiProperty({
		description: 'Device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => DeviceEntity, (device) => device.controls, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;
}

@ApiSchema({ name: 'DevicesModuleDataChannel' })
@Entity('devices_module_channels')
@Unique('UQ_channels_identifier_type', ['identifier', 'device'])
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class ChannelEntity extends BaseEntity {
	@ApiProperty({ description: 'Channel category', enum: ChannelCategory, example: ChannelCategory.GENERIC })
	@Expose()
	@IsEnum(ChannelCategory)
	@Column({
		type: 'text',
		enum: ChannelCategory,
		default: ChannelCategory.GENERIC,
	})
	category: ChannelCategory;

	@ApiPropertyOptional({
		description: 'Channel unique identifier',
		type: 'string',
		example: 'channel-001',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	identifier: string | null;

	@ApiProperty({ description: 'Channel name', type: 'string', example: 'Brightness' })
	@Expose()
	@IsString()
	@Column()
	name: string;

	@ApiPropertyOptional({
		description: 'Channel description',
		type: 'string',
		example: 'Light brightness control',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description: string | null;

	@ApiProperty({
		description: 'Device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => DeviceEntity, (device) => device.channels, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;

	@ApiPropertyOptional({
		name: 'parent',
		description: 'Parent channel identifier (for hierarchical channels like energy monitoring per switch)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'parent' })
	@IsOptional()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"parent","reason":"Parent must be a valid UUID (version 4)."}]' })
	@Transform(
		({ value }: { value: ChannelEntity | string | null }) =>
			value === null ? null : typeof value === 'string' ? value : value?.id,
		{ toPlainOnly: true },
	)
	@Transform(
		({ obj }: { obj: { parent?: string | null; parentId?: string | null } }) =>
			obj.parent !== undefined ? obj.parent : obj.parentId,
		{ toClassOnly: true },
	)
	@Index()
	@Column({ nullable: true, default: null })
	parentId: string | null;

	@ManyToOne(() => ChannelEntity, (channel) => channel.children, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'parentId' })
	parent: ChannelEntity | null;

	@OneToMany(() => ChannelEntity, (channel) => channel.parent)
	children: ChannelEntity[];

	@ApiProperty({
		description: 'Channel controls',
		type: 'array',
		items: { $ref: '#/components/schemas/DevicesModuleDataChannelControl' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ChannelControlEntity)
	@OneToMany(() => ChannelControlEntity, (control) => control.channel, { cascade: true, onDelete: 'CASCADE' })
	controls: ChannelControlEntity[];

	@ApiProperty({
		description: 'Channel properties',
		type: 'array',
		items: { $ref: '#/components/schemas/DevicesModuleDataChannelProperty' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@OneToMany(() => ChannelPropertyEntity, (property) => property.channel, { cascade: true, onDelete: 'CASCADE' })
	properties: ChannelPropertyEntity[];

	@ApiProperty({ description: 'Channel type', type: 'string', example: 'channel' })
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@ApiSchema({ name: 'DevicesModuleDataChannelControl' })
@Entity('devices_module_channels_controls')
@Unique(['name', 'channel'])
export class ChannelControlEntity extends BaseEntity {
	@ApiProperty({ description: 'Control name', type: 'string', example: 'brightness' })
	@Expose()
	@IsString()
	@Column()
	name: string;

	@ApiProperty({
		description: 'Channel identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelEntity)
	@IsInstance(ChannelEntity, { message: '[{"field":"channel","Channel":"Card must be a valid ChannelEntity."}]' })
	@Transform(({ value }: { value: ChannelEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => ChannelEntity, (channel) => channel.controls, { onDelete: 'CASCADE' })
	channel: ChannelEntity | string;
}

@ApiSchema({ name: 'DevicesModuleDataChannelProperty' })
@Entity('devices_module_channels_properties')
@Unique('UQ_channels_properties_identifier_type', ['identifier', 'channel'])
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class ChannelPropertyEntity extends BaseEntity {
	@ApiProperty({ description: 'Property category', enum: PropertyCategory, example: PropertyCategory.GENERIC })
	@Expose()
	@IsEnum(PropertyCategory)
	@Column({
		type: 'text',
		enum: PropertyCategory,
		default: PropertyCategory.GENERIC,
	})
	category: PropertyCategory;

	@ApiPropertyOptional({
		description: 'Property unique identifier',
		type: 'string',
		example: 'property-001',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	identifier: string | null;

	@ApiPropertyOptional({ description: 'Property name', type: 'string', example: 'Temperature', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	name: string | null;

	@ApiProperty({
		description: 'Property permissions',
		type: 'array',
		items: { type: 'string', enum: Object.values(PermissionType) },
		example: [PermissionType.READ_ONLY],
	})
	@Expose()
	@IsEnum(PermissionType, { each: true })
	@ArrayNotEmpty()
	@Column({
		type: 'simple-array',
		default: `${PermissionType.READ_ONLY}`,
	})
	permissions: PermissionType[];

	@ApiProperty({
		description: 'Property data type',
		name: 'data_type',
		enum: DataTypeType,
		example: DataTypeType.STRING,
	})
	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeType)
	@Transform(
		({ obj }: { obj: { data_type?: DataTypeType; dataType?: DataTypeType } }) => obj.data_type || obj.dataType,
		{ toClassOnly: true },
	)
	@Column({
		type: 'text',
		enum: DataTypeType,
		default: DataTypeType.UNKNOWN,
	})
	dataType: DataTypeType;

	@ApiPropertyOptional({ description: 'Property unit', type: 'string', example: '°C', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	unit: string | null;

	@ApiPropertyOptional({
		description: 'Property format constraints',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
		example: ['on', 'off'],
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateIf((o: { format?: unknown[] }): boolean =>
		o.format?.every((item: unknown): boolean => typeof item === 'string'),
	)
	@IsString({ each: true })
	@ValidateIf((o: { format?: unknown[] }): boolean =>
		o.format?.every((item: unknown): boolean => typeof item === 'number'),
	)
	@IsNumber({}, { each: true })
	@Column({ type: 'json', nullable: true })
	format: string[] | number[] | null;

	@ApiPropertyOptional({
		description: 'Invalid value indicator',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@Column({ type: 'text', nullable: true })
	invalid: string | boolean | number | null;

	@ApiPropertyOptional({ description: 'Property step value', type: 'number', example: 0.1, nullable: true })
	@Expose()
	@IsOptional()
	@IsNumber()
	@Column({ type: 'real', nullable: true })
	step: number | null;

	@ApiPropertyOptional({
		description: 'Property current value',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		example: 25.5,
	})
	@Expose()
	@IsOptional()
	value: string | boolean | number | null;

	@ApiProperty({
		description: 'Channel identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelEntity)
	@IsInstance(ChannelEntity, { message: '[{"field":"channel","Channel":"Card must be a valid ChannelEntity."}]' })
	@Transform(({ value }: { value: ChannelEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => ChannelEntity, (channel) => channel.properties, { onDelete: 'CASCADE' })
	channel: ChannelEntity | string;

	@ApiProperty({ description: 'Property type', type: 'string', example: 'property' })
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}
