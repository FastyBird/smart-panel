import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

@ApiSchema({ name: 'DevicesVirtualPluginUpdateChannel' })
export class UpdateVirtualChannelDto extends UpdateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: typeof DEVICES_VIRTUAL_TYPE;
}
