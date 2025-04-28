import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';

export class UpdateThirdPartyChannelDto extends UpdateChannelDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: 'third-party';
}
