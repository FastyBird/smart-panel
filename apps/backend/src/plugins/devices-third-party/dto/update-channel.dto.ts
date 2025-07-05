import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

export class UpdateThirdPartyChannelDto extends UpdateChannelDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: typeof DEVICES_THIRD_PARTY_TYPE;
}
