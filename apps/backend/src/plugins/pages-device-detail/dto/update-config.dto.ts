import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { PAGES_DEVICE_DETAIL_PLUGIN_NAME } from '../pages-device-detail.constants';

export class DeviceDetailUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof PAGES_DEVICE_DETAIL_PLUGIN_NAME;
}
