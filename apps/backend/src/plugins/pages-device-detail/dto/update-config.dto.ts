import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { PAGES_DEVICE_DETAIL_PLUGIN_NAME } from '../pages-device-detail.constants';

@ApiSchema({ name: 'PagesDeviceDetailPluginUpdateConfig' })
export class DeviceDetailUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: PAGES_DEVICE_DETAIL_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof PAGES_DEVICE_DETAIL_PLUGIN_NAME;
}
