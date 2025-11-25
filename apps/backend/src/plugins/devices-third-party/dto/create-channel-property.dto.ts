import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginCreateChannelProperty' })
export class CreateThirdPartyChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		example: DEVICES_THIRD_PARTY_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_THIRD_PARTY_TYPE;
}
