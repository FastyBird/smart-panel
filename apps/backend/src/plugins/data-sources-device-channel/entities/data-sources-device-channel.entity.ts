import { Exclude, Expose, Transform, Type } from 'class-transformer';
import { IsInstance, IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { ChildEntity, Column, ManyToOne, RelationId } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { DataSourceEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DATA_SOURCES_DEVICE_TYPE } from '../data-sources-device-channel.constants';

@ApiSchema({ name: 'DataSourcesDeviceChannelPluginDataDeviceChannelDataSource' })
@ChildEntity()
export class DeviceChannelDataSourceEntity extends DataSourceEntity {
	@ApiProperty({
		description: 'Device ID or entity',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@Transform(({ value }: { value: DeviceEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;

	@ApiProperty({
		description: 'Channel ID or entity',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@Type(() => ChannelEntity)
	@Transform(({ value }: { value: ChannelEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelEntity)
	@IsInstance(ChannelEntity, { message: '[{"field":"channel","reason":"Channel must be a valid ChannelEntity."}]' })
	@ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
	channel: ChannelEntity | string;

	@ApiProperty({
		description: 'Property ID or entity',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@Type(() => ChannelPropertyEntity)
	@Transform(
		({ value }: { value: ChannelPropertyEntity | string }) => (typeof value === 'string' ? value : value?.id),
		{ toPlainOnly: true },
	)
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"property","reason":"Property must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelPropertyEntity)
	@IsInstance(ChannelPropertyEntity, {
		message: '[{"field":"property","reason":"Property must be a valid ChannelPropertyEntity."}]',
	})
	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	property: ChannelPropertyEntity | string;

	@ApiPropertyOptional({
		description: 'Icon name',
		type: 'string',
		nullable: true,
		example: 'mdi:lightbulb',
	})
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

	@ApiProperty({
		description: 'Data source type',
		type: 'string',
		default: DATA_SOURCES_DEVICE_TYPE,
		example: DATA_SOURCES_DEVICE_TYPE,
	})
	@Expose()
	get type(): string {
		return DATA_SOURCES_DEVICE_TYPE;
	}
}
