import { Exclude, Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { ChildEntity, Column, ManyToOne, RelationId } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { TILES_DEVICE_PREVIEW_TYPE } from '../tiles-device-preview.constants';

@ApiSchema({ name: 'TilesDevicePreviewPluginDataDevicePreviewTile' })
@ChildEntity()
export class DevicePreviewTileEntity extends TileEntity {
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
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE', eager: true })
	device: DeviceEntity | string;

	@ApiPropertyOptional({
		description: 'Tile icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-lightbulb',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@Exclude({ toPlainOnly: true })
	@RelationId((tile: DevicePreviewTileEntity) => tile.device)
	deviceId: string;

	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		example: TILES_DEVICE_PREVIEW_TYPE,
	})
	@Expose()
	get type(): string {
		return TILES_DEVICE_PREVIEW_TYPE;
	}
}
