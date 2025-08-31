import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { TILES_DEVICE_PREVIEW_PLUGIN_NAME } from '../tiles-device-preview.constants';

export class DevicePreviewUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof TILES_DEVICE_PREVIEW_PLUGIN_NAME;
}
