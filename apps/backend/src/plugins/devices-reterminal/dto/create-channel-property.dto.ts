import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_RETERMINAL_TYPE } from '../devices-reterminal.constants';

@ApiSchema({ name: 'DevicesReTerminalPluginCreateChannelProperty' })
export class CreateReTerminalChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_RETERMINAL_TYPE,
		example: DEVICES_RETERMINAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_RETERMINAL_TYPE;
}
