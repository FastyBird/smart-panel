import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgMdnsConfig' })
export class ShellyNgMdnsConfigModel {
	@ApiProperty({
		description: 'Whether mDNS discovery is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;

	@ApiPropertyOptional({
		description: 'Network interface for mDNS discovery',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	interface: string | null = null;
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgWebsocketsConfig' })
export class ShellyNgWebsocketsConfigModel {
	@ApiProperty({
		name: 'request_timeout',
		description: 'Request timeout in seconds',
		example: 60,
	})
	@Expose({ name: 'request_timeout' })
	@IsInt()
	@Min(1)
	requestTimeout: number = 60; // seconds

	@ApiProperty({
		name: 'ping_interval',
		description: 'Ping interval in seconds',
		example: 60,
	})
	@Expose({ name: 'ping_interval' })
	@IsInt()
	@Min(0)
	pingInterval: number = 60; // seconds

	@ApiProperty({
		name: 'reconnect_interval',
		description: 'Reconnect interval sequence in seconds',
		isArray: true,
		example: [5, 10, 30, 60, 300, 600],
	})
	@Expose({ name: 'reconnect_interval' })
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	@Min(1, { each: true })
	reconnectInterval: number[] = [5, 10, 30, 60, 5 * 60, 10 * 60]; // seconds
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgConfig' })
export class ShellyNgConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		example: DEVICES_SHELLY_NG_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_SHELLY_NG_PLUGIN_NAME;

	@ApiProperty({
		description: 'mDNS configuration',
		type: () => ShellyNgMdnsConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ShellyNgMdnsConfigModel)
	mdns: ShellyNgMdnsConfigModel = new ShellyNgMdnsConfigModel();

	@ApiProperty({
		description: 'WebSockets configuration',
		type: () => ShellyNgWebsocketsConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ShellyNgWebsocketsConfigModel)
	websockets: ShellyNgWebsocketsConfigModel = new ShellyNgWebsocketsConfigModel();
}

/**
 * Alias for DevicesShellyNgPluginConfig (OpenAPI spec compatibility)
 */
@ApiSchema({ name: 'DevicesShellyNgPluginConfig' })
export class DevicesShellyNgPluginConfig extends ShellyNgConfigModel {}
