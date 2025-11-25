import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DATA_SOURCES_DEVICE_PLUGIN_NAME } from '../data-sources-device-channel.constants';

@ApiSchema({ name: 'DataSourcesDeviceChannelPluginUpdateConfig' })
export class DeviceChannelUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: DATA_SOURCES_DEVICE_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DATA_SOURCES_DEVICE_PLUGIN_NAME;
}
