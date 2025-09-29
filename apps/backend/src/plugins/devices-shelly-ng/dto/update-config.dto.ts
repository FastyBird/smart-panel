import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';

export class ShellyNgUpdatePluginConfigMdnsDto {
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"MDNS enabled attribute must be a boolean."}]' })
	enabled?: boolean;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"interface","reason":"MDNS interface must be a valid string."}]' })
	interface?: string | null;
}

export class ShellyNgUpdatePluginConfigWebsocketsDto {
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"request_timeout","reason":"Websockets request timeout must be a whole number."}]' })
	@Min(1, {
		message:
			'[{"field":"request_timeout","reason":"Websockets request timeout minimum value must be greater than 0."}]',
	})
	request_timeout?: number;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"ping_interval","reason":"Websockets ping interval must be a whole number."}]' })
	@Min(0, {
		message: '[{"field":"ping_interval","reason":"Websockets ping interval minimum value must be greater than 0."}]',
	})
	ping_interval?: number;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"reconnect_interval","reason":"Websockets reconnect interval must an array."}]' })
	@ArrayNotEmpty({
		message: '[{"field":"reconnect_interval","reason":"Websockets reconnect interval must be not empty array."}]',
	})
	@IsInt({
		each: true,
		message:
			'[{"field":"reconnect_interval","reason":"Websockets reconnect interval each item must be a whole number."}]',
	})
	@Min(1, {
		each: true,
		message:
			'[{"field":"reconnect_interval","reason":"Websockets reconnect interval each item minimum value must be greater than 0."}]',
	})
	reconnect_interval: number[];
}

export class ShellyNgUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_SHELLY_NG_PLUGIN_NAME;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyNgUpdatePluginConfigMdnsDto)
	mdns: ShellyNgUpdatePluginConfigMdnsDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyNgUpdatePluginConfigWebsocketsDto)
	websockets: ShellyNgUpdatePluginConfigWebsocketsDto;
}
