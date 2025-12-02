import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DATA_SOURCES_DEVICE_PLUGIN_NAME } from '../data-sources-device-channel.constants';

@ApiSchema({ name: 'DataSourcesDeviceChannelPluginDataConfig' })
export class DeviceChannelConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: DATA_SOURCES_DEVICE_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DATA_SOURCES_DEVICE_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
