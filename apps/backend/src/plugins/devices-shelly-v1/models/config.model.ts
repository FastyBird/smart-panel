import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';

export class ShellyV1DiscoveryConfigModel {
	@Expose()
	@IsOptional()
	@IsString()
	interface: string | null = null;
}

export class ShellyV1TimeoutsConfigModel {
	@Expose({ name: 'request_timeout' })
	@IsInt()
	@Min(1)
	requestTimeout: number = 10; // seconds

	@Expose({ name: 'stale_timeout' })
	@IsInt()
	@Min(1)
	staleTimeout: number = 30; // seconds
}

export class ShellyV1ConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	type: string = DEVICES_SHELLY_V1_PLUGIN_NAME;

	@Expose()
	@ValidateNested()
	@Type(() => ShellyV1DiscoveryConfigModel)
	discovery: ShellyV1DiscoveryConfigModel = new ShellyV1DiscoveryConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => ShellyV1TimeoutsConfigModel)
	timeouts: ShellyV1TimeoutsConfigModel = new ShellyV1TimeoutsConfigModel();
}
