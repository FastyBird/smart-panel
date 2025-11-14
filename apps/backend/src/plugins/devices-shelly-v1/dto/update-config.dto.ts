import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';
import { ShellyV1DiscoveryConfigModel, ShellyV1TimeoutsConfigModel } from '../models/config.model';

export class ShellyV1UpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_SHELLY_V1_PLUGIN_NAME;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyV1DiscoveryConfigModel)
	discovery?: ShellyV1DiscoveryConfigModel;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyV1TimeoutsConfigModel)
	timeouts?: ShellyV1TimeoutsConfigModel;
}
