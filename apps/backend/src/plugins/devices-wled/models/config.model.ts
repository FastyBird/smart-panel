import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	DEFAULT_COMMAND_DEBOUNCE_MS,
	DEFAULT_CONNECTION_TIMEOUT_MS,
	DEFAULT_POLLING_INTERVAL_MS,
	DEVICES_WLED_PLUGIN_NAME,
} from '../devices-wled.constants';

/**
 * WLED device host configuration
 */
@ApiSchema({ name: 'DevicesWledPluginDataDeviceHost' })
export class WledDeviceHostConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'WLED device hostname or IP address',
		example: '192.168.1.100',
	})
	host: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Optional name for the device',
		example: 'Living Room LEDs',
		nullable: true,
	})
	name?: string | null;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Optional device identifier (auto-generated from MAC if not provided)',
		example: 'wled-aabbcc',
		nullable: true,
	})
	identifier?: string | null;
}

/**
 * WLED timeouts configuration
 */
@ApiSchema({ name: 'DevicesWledPluginDataTimeoutsConfig' })
export class WledTimeoutsConfigModel {
	@Expose({ name: 'connection_timeout' })
	@IsInt()
	@Min(1000)
	@ApiProperty({
		name: 'connection_timeout',
		description: 'Connection timeout in milliseconds',
		example: DEFAULT_CONNECTION_TIMEOUT_MS,
		minimum: 1000,
	})
	connectionTimeout: number = DEFAULT_CONNECTION_TIMEOUT_MS;

	@Expose({ name: 'command_debounce' })
	@IsInt()
	@Min(0)
	@ApiProperty({
		name: 'command_debounce',
		description: 'Command debounce delay in milliseconds (for rapid property changes)',
		example: DEFAULT_COMMAND_DEBOUNCE_MS,
		minimum: 0,
	})
	commandDebounce: number = DEFAULT_COMMAND_DEBOUNCE_MS;
}

/**
 * WLED polling configuration
 */
@ApiSchema({ name: 'DevicesWledPluginDataPollingConfig' })
export class WledPollingConfigModel {
	@Expose()
	@IsInt()
	@Min(5000)
	@ApiProperty({
		description: 'State polling interval in milliseconds',
		example: DEFAULT_POLLING_INTERVAL_MS,
		minimum: 5000,
	})
	interval: number = DEFAULT_POLLING_INTERVAL_MS;
}

/**
 * Main WLED plugin configuration model
 */
@ApiSchema({ name: 'DevicesWledPluginDataConfig' })
export class WledConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_WLED_PLUGIN_NAME,
	})
	type: string = DEVICES_WLED_PLUGIN_NAME;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => WledDeviceHostConfigModel)
	@ApiProperty({
		description: 'List of WLED device hosts to connect to',
		type: [WledDeviceHostConfigModel],
	})
	devices: WledDeviceHostConfigModel[] = [];

	@Expose()
	@ValidateNested()
	@Type(() => WledTimeoutsConfigModel)
	@ApiProperty({
		description: 'Timeouts configuration',
		type: () => WledTimeoutsConfigModel,
	})
	timeouts: WledTimeoutsConfigModel = new WledTimeoutsConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => WledPollingConfigModel)
	@ApiProperty({
		description: 'Polling configuration',
		type: () => WledPollingConfigModel,
	})
	polling: WledPollingConfigModel = new WledPollingConfigModel();
}
