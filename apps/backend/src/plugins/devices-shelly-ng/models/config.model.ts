import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';

export class ShellyNgMdnsConfigModel {
	@Expose()
	@IsBoolean()
	enabled: boolean = true;

	@Expose()
	@IsOptional()
	@IsString()
	interface: string | null = null;
}

export class ShellyNgWebsocketsConfigModel {
	@Expose({ name: 'request_timeout' })
	@IsInt()
	@Min(1)
	requestTimeout: number = 10; // seconds

	@Expose({ name: 'ping_interval' })
	@IsInt()
	@Min(0)
	pingInterval: number = 60; // seconds

	@Expose({ name: 'reconnect_interval' })
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	@Min(1, { each: true })
	reconnectInterval: number[] = [5, 10, 30, 60, 5 * 60, 10 * 60]; // seconds
}

export class ShellyNgConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	type: string = DEVICES_SHELLY_NG_PLUGIN_NAME;

	@Expose()
	@ValidateNested()
	@Type(() => ShellyNgMdnsConfigModel)
	mdns: ShellyNgMdnsConfigModel = new ShellyNgMdnsConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => ShellyNgWebsocketsConfigModel)
	websockets: ShellyNgWebsocketsConfigModel = new ShellyNgWebsocketsConfigModel();
}
