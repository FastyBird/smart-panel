import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

@ApiSchema({ name: 'DevicesWledPluginUpdateChannel' })
export class UpdateWledChannelDto extends UpdateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_WLED_TYPE,
		example: DEVICES_WLED_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof DEVICES_WLED_TYPE;
}
