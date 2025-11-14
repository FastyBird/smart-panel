import { Expose } from 'class-transformer';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export class CreateShellyV1ChannelDto extends CreateChannelDto {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}
}
