import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgUpdatePluginConfigMdns' })
export class ShellyNgUpdatePluginConfigMdnsDto {
	@ApiPropertyOptional({
		description: 'Enable MDNS discovery',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"MDNS enabled attribute must be a boolean."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'MDNS network interface',
		example: 'eth0',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"interface","reason":"MDNS interface must be a valid string."}]' })
	interface?: string | null;
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgUpdatePluginConfigWebsockets' })
export class ShellyNgUpdatePluginConfigWebsocketsDto {
	@ApiPropertyOptional({
		description: 'Websocket request timeout in milliseconds',
		example: 5000,
		minimum: 1,
		name: 'request_timeout',
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"request_timeout","reason":"Websockets request timeout must be a whole number."}]' })
	@Min(1, {
		message:
			'[{"field":"request_timeout","reason":"Websockets request timeout minimum value must be greater than 0."}]',
	})
	request_timeout?: number;

	@ApiPropertyOptional({
		description: 'Websocket ping interval in milliseconds',
		example: 30000,
		minimum: 0,
		name: 'ping_interval',
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"ping_interval","reason":"Websockets ping interval must be a whole number."}]' })
	@Min(0, {
		message: '[{"field":"ping_interval","reason":"Websockets ping interval minimum value must be greater than 0."}]',
	})
	ping_interval?: number;

	@ApiPropertyOptional({
		description: 'Websocket reconnect interval values in milliseconds',
		example: [1000, 2000, 5000, 10000],
		isArray: true,
		type: Number,
		name: 'reconnect_interval',
	})
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

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgUpdatePluginConfig' })
export class ShellyNgUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		example: DEVICES_SHELLY_NG_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_SHELLY_NG_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'MDNS configuration',
		type: () => ShellyNgUpdatePluginConfigMdnsDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyNgUpdatePluginConfigMdnsDto)
	mdns: ShellyNgUpdatePluginConfigMdnsDto;

	@ApiPropertyOptional({
		description: 'Websockets configuration',
		type: () => ShellyNgUpdatePluginConfigWebsocketsDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyNgUpdatePluginConfigWebsocketsDto)
	websockets: ShellyNgUpdatePluginConfigWebsocketsDto;
}

/**
 * Alias for DevicesShellyNgPluginUpdateConfig (OpenAPI spec compatibility)
 */
@ApiSchema({ name: 'DevicesShellyNgPluginUpdateConfig' })
export class DevicesShellyNgPluginUpdateConfig extends ShellyNgUpdatePluginConfigDto {}
