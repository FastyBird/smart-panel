import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';

export class ShellyV1UpdatePluginConfigDiscoveryDto {
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Discovery enabled attribute must be a boolean."}]' })
	enabled?: boolean;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"interface","reason":"Discovery interface must be a valid string."}]' })
	interface?: string | null;
}

export class ShellyV1UpdatePluginConfigTimeoutsDto {
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"request_timeout","reason":"Request timeout must be a whole number."}]' })
	@Min(1, {
		message: '[{"field":"request_timeout","reason":"Request timeout minimum value must be greater than 0."}]',
	})
	request_timeout?: number;

	@Expose()
	@IsOptional()
	@IsInt({
		message: '[{"field":"status_update_interval","reason":"Status update interval must be a whole number."}]',
	})
	@Min(1, {
		message:
			'[{"field":"status_update_interval","reason":"Status update interval minimum value must be greater than 0."}]',
	})
	status_update_interval?: number;
}

export class ShellyV1UpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_SHELLY_V1_PLUGIN_NAME;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyV1UpdatePluginConfigDiscoveryDto)
	discovery?: ShellyV1UpdatePluginConfigDiscoveryDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyV1UpdatePluginConfigTimeoutsDto)
	timeouts?: ShellyV1UpdatePluginConfigTimeoutsDto;
}
