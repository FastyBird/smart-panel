import { Expose, Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/update-config.dto';
import { ShellyV1DiscoveryConfigModel, ShellyV1TimeoutsConfigModel } from '../models/config.model';

export class ShellyV1UpdatePluginConfigDto extends UpdatePluginConfigDto {
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
