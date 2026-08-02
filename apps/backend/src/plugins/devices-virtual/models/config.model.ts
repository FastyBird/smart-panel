import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';

@ApiSchema({ name: 'DevicesVirtualPluginDataConfig' })
export class VirtualConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_VIRTUAL_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_VIRTUAL_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
