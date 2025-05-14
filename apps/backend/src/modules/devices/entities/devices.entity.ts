import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
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
import { Column, Entity, ManyToOne, OneToMany, TableInheritance, Unique } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';

@Entity('devices_module_devices')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class DeviceEntity extends BaseEntity {
	@Expose()
	@IsEnum(DeviceCategory)
	@Column({
		type: 'text',
		enum: DeviceCategory,
		default: DeviceCategory.GENERIC,
	})
	category: DeviceCategory;

	@Expose()
	@IsString()
	@Column()
	name: string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description: string | null = null;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DeviceControlEntity)
	@OneToMany(() => DeviceControlEntity, (control) => control.device, { cascade: true, onDelete: 'CASCADE' })
	controls: DeviceControlEntity[];

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@OneToMany(() => ChannelEntity, (channel) => channel.device, { cascade: true, onDelete: 'CASCADE' })
	channels: ChannelEntity[];

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@Entity('devices_module_devices_controls')
@Unique(['name', 'device'])
export class DeviceControlEntity extends BaseEntity {
	@Expose()
	@IsString()
	@Column()
	name: string;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity }) => value.id, { toPlainOnly: true })
	@ManyToOne(() => DeviceEntity, (device) => device.controls, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;
}

@Entity('devices_module_channels')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class ChannelEntity extends BaseEntity {
	@Expose()
	@IsEnum(ChannelCategory)
	@Column({
		type: 'text',
		enum: ChannelCategory,
		default: ChannelCategory.GENERIC,
	})
	category: ChannelCategory;

	@Expose()
	@IsString()
	@Column()
	name: string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description: string | null = null;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity }) => value.id, { toPlainOnly: true })
	@ManyToOne(() => DeviceEntity, (device) => device.channels, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ChannelControlEntity)
	@OneToMany(() => ChannelControlEntity, (control) => control.channel, { cascade: true, onDelete: 'CASCADE' })
	controls: ChannelControlEntity[];

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@OneToMany(() => ChannelPropertyEntity, (property) => property.channel, { cascade: true, onDelete: 'CASCADE' })
	properties: ChannelPropertyEntity[];

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@Entity('devices_module_channels_controls')
@Unique(['name', 'channel'])
export class ChannelControlEntity extends BaseEntity {
	@Expose()
	@IsString()
	@Column()
	name: string;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelEntity)
	@IsInstance(ChannelEntity, { message: '[{"field":"channel","Channel":"Card must be a valid ChannelEntity."}]' })
	@Transform(({ value }: { value: ChannelEntity }) => value.id, { toPlainOnly: true })
	@ManyToOne(() => ChannelEntity, (channel) => channel.controls, { onDelete: 'CASCADE' })
	channel: ChannelEntity | string;
}

@Entity('devices_module_channels_properties')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class ChannelPropertyEntity extends BaseEntity {
	@Expose()
	@IsEnum(PropertyCategory)
	@Column({
		type: 'text',
		enum: PropertyCategory,
		default: PropertyCategory.GENERIC,
	})
	category: PropertyCategory;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	name: string | null = null;

	@Expose()
	@IsEnum(PermissionType, { each: true })
	@ArrayNotEmpty()
	@Column({
		type: 'simple-array',
		default: `${PermissionType.READ_ONLY}`,
	})
	permissions: PermissionType[];

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

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	unit: string | null = null;

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
	format: string[] | number[] | null = null;

	@Expose()
	@IsOptional()
	@Column({ type: 'text', nullable: true })
	invalid: string | boolean | number | null = null;

	@Expose()
	@IsOptional()
	@IsNumber()
	@Column({ type: 'real', nullable: true })
	step: number | null = null;

	@Expose()
	@IsOptional()
	value: string | boolean | number | null = null;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelEntity)
	@IsInstance(ChannelEntity, { message: '[{"field":"channel","Channel":"Card must be a valid ChannelEntity."}]' })
	@Transform(({ value }: { value: ChannelEntity }) => value.id, { toPlainOnly: true })
	@ManyToOne(() => ChannelEntity, (channel) => channel.properties, { onDelete: 'CASCADE' })
	channel: ChannelEntity | string;

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}
