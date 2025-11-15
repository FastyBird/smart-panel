import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export class UpdateShellyV1ChannelPropertyDto extends UpdateChannelPropertyDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_SHELLY_V1_TYPE;
}
