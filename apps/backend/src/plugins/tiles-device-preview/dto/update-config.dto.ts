import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { TILES_DEVICE_PREVIEW_PLUGIN_NAME } from '../tiles-device-preview.constants';

@ApiSchema({ name: 'TilesDevicePreviewPluginUpdateConfig' })
export class DevicePreviewUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: TILES_DEVICE_PREVIEW_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof TILES_DEVICE_PREVIEW_PLUGIN_NAME;
}
