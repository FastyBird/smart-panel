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
import { ChildEntity, Column, Entity, ManyToOne, OneToMany, TableInheritance, Unique } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import {
	ChannelCategoryEnum,
	DataTypeEnum,
	DeviceCategoryEnum,
	PermissionEnum,
	PropertyCategoryEnum,
} from '../devices.constants';

@Entity('devices_module_devices')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class DeviceEntity extends BaseEntity {
	@Expose()
	@IsEnum(DeviceCategoryEnum)
	@Column({
		type: 'text',
		enum: DeviceCategoryEnum,
		default: DeviceCategoryEnum.GENERIC,
	})
	category: DeviceCategoryEnum;

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
	@Type(() => ChannelEntity)
	@OneToMany(() => ChannelEntity, (channel) => channel.device, { cascade: true, onDelete: 'CASCADE' })
	channels: ChannelEntity[];

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@ChildEntity()
export class ThirdPartyDeviceEntity extends DeviceEntity {
	@Expose({ name: 'service_address' })
	@IsString()
	@Column()
	@Transform(
		({ obj }: { obj: { service_address?: string; serviceAddress?: string } }) =>
			obj.service_address || obj.serviceAddress,
		{ toClassOnly: true },
	)
	serviceAddress: string;

	@Expose()
	get type(): string {
		return 'third-party';
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
export class ChannelEntity extends BaseEntity {
	@Expose()
	@IsEnum(ChannelCategoryEnum)
	@Column({
		type: 'text',
		enum: ChannelCategoryEnum,
		default: ChannelCategoryEnum.GENERIC,
	})
	category: ChannelCategoryEnum;

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
	@Type(() => ChannelPropertyEntity)
	@OneToMany(() => ChannelPropertyEntity, (property) => property.channel, { cascade: true, onDelete: 'CASCADE' })
	properties: ChannelPropertyEntity[];
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
export class ChannelPropertyEntity extends BaseEntity {
	@Expose()
	@IsEnum(PropertyCategoryEnum)
	@Column({
		type: 'text',
		enum: PropertyCategoryEnum,
		default: PropertyCategoryEnum.GENERIC,
	})
	category: PropertyCategoryEnum;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	name: string | null = null;

	@Expose()
	@IsEnum(PermissionEnum, { each: true })
	@ArrayNotEmpty()
	@Column({
		type: 'simple-array',
		default: `${PermissionEnum.READ_ONLY}`,
	})
	permission: PermissionEnum[];

	@Expose({ name: 'data_type' })
	@IsEnum(DataTypeEnum)
	@Transform(
		({ obj }: { obj: { data_type?: DataTypeEnum; dataType?: DataTypeEnum } }) => obj.data_type || obj.dataType,
		{ toClassOnly: true },
	)
	@Column({
		type: 'text',
		enum: DataTypeEnum,
		default: DataTypeEnum.UNKNOWN,
	})
	dataType: DataTypeEnum;

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
}
