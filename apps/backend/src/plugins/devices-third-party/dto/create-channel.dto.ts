import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';

export class CreateThirdPartyChannelDto extends CreateChannelDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: 'third-party';
}
