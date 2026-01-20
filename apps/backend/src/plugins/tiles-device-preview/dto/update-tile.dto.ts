import { Expose, Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateSingleTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { ValidateDeviceExists } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { TILES_DEVICE_PREVIEW_TYPE } from '../tiles-device-preview.constants';

@ApiSchema({ name: 'TilesDevicePreviewPluginUpdateDevicePreviewTile' })
export class UpdateDevicePreviewTileDto extends UpdateSingleTileDto {
	@ApiProperty({
		description: 'Tile type',
		type: 'string',
		default: TILES_DEVICE_PREVIEW_TYPE,
		example: TILES_DEVICE_PREVIEW_TYPE,
	})
	readonly type: typeof TILES_DEVICE_PREVIEW_TYPE;

	@ApiPropertyOptional({
		description: 'Device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;

	@ApiPropertyOptional({
		description: 'Tile icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-lightbulb',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;
}

@ApiSchema({ name: 'TilesDevicePreviewPluginReqUpdateDevicePreviewTile' })
export class ReqUpdateDevicePreviewTileDto {
	@ApiProperty({
		description: 'Device preview tile update data',
		type: () => UpdateDevicePreviewTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDevicePreviewTileDto)
	data: UpdateDevicePreviewTileDto;
}
