import { Expose } from 'class-transformer';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

export class CreateShellyV1ChannelPropertyDto extends CreateChannelPropertyDto {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}
}
