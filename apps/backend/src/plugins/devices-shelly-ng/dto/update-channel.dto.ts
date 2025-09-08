import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import type { components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type UpdateShellyNgChannel = components['schemas']['DevicesShellyNgPluginUpdateShellyNgChannel'];

export class UpdateShellyNgChannelDto extends UpdateChannelDto implements UpdateShellyNgChannel {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: typeof DEVICES_SHELLY_NG_TYPE;
}
