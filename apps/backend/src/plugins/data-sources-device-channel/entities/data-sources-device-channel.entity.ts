import { Exclude, Expose, Transform, Type } from 'class-transformer';
import { IsInstance, IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { ChildEntity, Column, ManyToOne, RelationId } from 'typeorm';

import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { DataSourceEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

@ChildEntity()
export class DeviceChannelDataSourceEntity extends DataSourceEntity {
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
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelEntity)
	@IsInstance(ChannelEntity, { message: '[{"field":"channel","reason":"Channel must be a valid ChannelEntity."}]' })
	@Transform(({ value }: { value: ChannelEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@Type(() => ChannelEntity)
	@ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
	channel: ChannelEntity | string;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"property","reason":"Property must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelPropertyEntity)
	@IsInstance(ChannelPropertyEntity, {
		message: '[{"field":"property","reason":"Property must be a valid ChannelPropertyEntity."}]',
	})
	@Type(() => ChannelPropertyEntity)
	@Transform(
		({ value }: { value: ChannelPropertyEntity | string }) => (typeof value === 'string' ? value : value?.id),
		{ toPlainOnly: true },
	)
	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	property: ChannelPropertyEntity | string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@Exclude({ toPlainOnly: true })
	@RelationId((entity: DeviceChannelDataSourceEntity) => entity.device)
	deviceId: string;

	@Exclude({ toPlainOnly: true })
	@RelationId((entity: DeviceChannelDataSourceEntity) => entity.channel)
	channelId: string;

	@Exclude({ toPlainOnly: true })
	@RelationId((entity: DeviceChannelDataSourceEntity) => entity.property)
	propertyId: string;

	@Expose()
	get type(): string {
		return 'device-channel';
	}
}
