import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginShellyV1DiscoveryConfig' })
export class ShellyV1DiscoveryConfigModel {
	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Network interface to use for discovery',
		example: 'eth0',
		nullable: true,
	})
	interface: string | null = null;

	@Expose()
	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({
		description: 'Whether device discovery is enabled',
		example: true,
	})
	enabled: boolean = true;
}

@ApiSchema({ name: 'DevicesShellyV1PluginShellyV1TimeoutsConfig' })
export class ShellyV1TimeoutsConfigModel {
	@Expose({ name: 'request_timeout' })
	@IsInt()
	@Min(1)
	@ApiProperty({
		name: 'request_timeout',
		description: 'Request timeout in seconds',
		example: 10,
		minimum: 1,
	})
	requestTimeout: number = 10; // seconds

	@Expose({ name: 'stale_timeout' })
	@IsInt()
	@Min(1)
	@ApiProperty({
		name: 'stale_timeout',
		description: 'Stale timeout in seconds',
		example: 30,
		minimum: 1,
	})
	staleTimeout: number = 30; // seconds
}

@ApiSchema({ name: 'DevicesShellyV1PluginShellyV1Config' })
export class ShellyV1ConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_SHELLY_V1_PLUGIN_NAME,
	})
	type: string = DEVICES_SHELLY_V1_PLUGIN_NAME;

	@Expose()
	@ValidateNested()
	@Type(() => ShellyV1DiscoveryConfigModel)
	@ApiProperty({
		description: 'Discovery configuration',
		type: () => ShellyV1DiscoveryConfigModel,
	})
	discovery: ShellyV1DiscoveryConfigModel = new ShellyV1DiscoveryConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => ShellyV1TimeoutsConfigModel)
	@ApiProperty({
		description: 'Timeouts configuration',
		type: () => ShellyV1TimeoutsConfigModel,
	})
	timeouts: ShellyV1TimeoutsConfigModel = new ShellyV1TimeoutsConfigModel();
}
