import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';

export class UpdateThirdPartyChannelPropertyDto extends UpdateChannelPropertyDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	type: 'third-party';
}
