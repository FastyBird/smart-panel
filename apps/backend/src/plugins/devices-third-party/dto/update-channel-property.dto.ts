import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

export class UpdateThirdPartyChannelPropertyDto extends UpdateChannelPropertyDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	type: typeof DEVICES_THIRD_PARTY_TYPE;
}
