import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';

export class CreateThirdPartyChannelPropertyDto extends CreateChannelPropertyDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: 'third-party';
}
