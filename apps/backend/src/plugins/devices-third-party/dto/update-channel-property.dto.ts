import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginUpdateChannelProperty' })
export class UpdateThirdPartyChannelPropertyDto extends UpdateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_THIRD_PARTY_TYPE,
		example: DEVICES_THIRD_PARTY_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	type: typeof DEVICES_THIRD_PARTY_TYPE;
}
