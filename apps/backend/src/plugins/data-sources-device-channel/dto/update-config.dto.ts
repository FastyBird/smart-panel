import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DATA_SOURCES_DEVICE_PLUGIN_NAME } from '../data-sources-device-channel.constants';

export class DeviceChannelUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DATA_SOURCES_DEVICE_PLUGIN_NAME;
}
