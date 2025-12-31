import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ChildEntity, Column, Index } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SceneActionEntity } from '../../../modules/scenes/entities/scenes.entity';
import { SCENES_LOCAL_TYPE } from '../scenes-local.constants';

@ApiSchema({ name: 'ScenesLocalPluginDataSceneAction' })
@ChildEntity(SCENES_LOCAL_TYPE)
export class LocalSceneActionEntity extends SceneActionEntity {
	@ApiProperty({
		name: 'device_id',
		description: 'Target device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'device_id' })
	@IsUUID('4', { message: '[{"field":"device_id","reason":"Device ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ type: 'varchar', length: 36 })
	deviceId: string;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'Target channel identifier (optional, auto-detected if omitted)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { channel_id?: string; channelId?: string } }) => obj.channel_id ?? obj.channelId, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', length: 36, nullable: true })
	channelId: string | null;

	@ApiProperty({
		name: 'property_id',
		description: 'Target property identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440002',
	})
	@Expose({ name: 'property_id' })
	@IsUUID('4', { message: '[{"field":"property_id","reason":"Property ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { property_id?: string; propertyId?: string } }) => obj.property_id ?? obj.propertyId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ type: 'varchar', length: 36 })
	propertyId: string;

	@ApiProperty({
		description: 'Value to set on the property',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: true,
	})
	@Expose()
	@IsString({ message: '[{"field":"value","reason":"Value must be a string, number, or boolean."}]' })
	@Column({ type: 'text' })
	value: string | number | boolean;

	@ApiProperty({
		description: 'Action type',
		type: 'string',
		default: SCENES_LOCAL_TYPE,
		example: SCENES_LOCAL_TYPE,
	})
	@Expose()
	get type(): string {
		return SCENES_LOCAL_TYPE;
	}
}
