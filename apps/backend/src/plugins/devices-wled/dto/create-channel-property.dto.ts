import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

@ApiSchema({ name: 'DevicesWledPluginCreateChannelProperty' })
export class CreateWledChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_WLED_TYPE,
		example: DEVICES_WLED_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_WLED_TYPE;
}
