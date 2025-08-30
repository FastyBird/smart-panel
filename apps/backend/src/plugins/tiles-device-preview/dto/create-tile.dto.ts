import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { ValidateDeviceExists } from '../../../modules/devices/validators/device-exists-constraint.validator';
import type { components } from '../../../openapi';
import { TILES_DEVICE_PREVIEW_TYPE } from '../tiles-device-preview.constants';

type CreateDevicePreviewTile = components['schemas']['TilesDevicePreviewPluginCreateDevicePreviewTile'];

export class CreateDevicePreviewTileDto extends CreateSingleTileDto implements CreateDevicePreviewTile {
	readonly type: typeof TILES_DEVICE_PREVIEW_TYPE;

	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;
}
