import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginUpdateChannel' })
export class UpdateThirdPartyChannelDto extends UpdateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_THIRD_PARTY_TYPE,
		example: DEVICES_THIRD_PARTY_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: typeof DEVICES_THIRD_PARTY_TYPE;
}
