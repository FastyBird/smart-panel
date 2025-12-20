import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	DEFAULT_COMMAND_DEBOUNCE_MS,
	DEFAULT_CONNECTION_TIMEOUT_MS,
	DEFAULT_POLLING_INTERVAL_MS,
	DEVICES_WLED_PLUGIN_NAME,
} from '../devices-wled.constants';

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
 * WLED mDNS discovery configuration
 */
@ApiSchema({ name: 'DevicesWledPluginDataMdnsConfig' })
export class WledMdnsConfigModel {
	@Expose()
	@IsBoolean()
	@ApiProperty({
		description: 'Whether mDNS discovery is enabled',
		example: true,
	})
	enabled: boolean = true;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Network interface for mDNS discovery (null for all interfaces)',
		nullable: true,
		example: null,
	})
	interface: string | null = null;

	@Expose({ name: 'auto_add' })
	@IsBoolean()
	@ApiProperty({
		name: 'auto_add',
		description: 'Automatically add discovered devices to the system',
		example: false,
	})
	autoAdd: boolean = false;
}

/**
 * WLED WebSocket configuration
 */
@ApiSchema({ name: 'DevicesWledPluginDataWebSocketConfig' })
export class WledWebSocketConfigModel {
	@Expose()
	@IsBoolean()
	@ApiProperty({
		description: 'Whether to use WebSocket for real-time state updates',
		example: true,
	})
	enabled: boolean = true;

	@Expose({ name: 'reconnect_interval' })
	@IsInt()
	@Min(1000)
	@ApiProperty({
		name: 'reconnect_interval',
		description: 'WebSocket reconnection interval in milliseconds',
		example: 5000,
		minimum: 1000,
	})
	reconnectInterval: number = 5000;
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

	@Expose()
	@ValidateNested()
	@Type(() => WledMdnsConfigModel)
	@ApiProperty({
		description: 'mDNS discovery configuration',
		type: () => WledMdnsConfigModel,
	})
	mdns: WledMdnsConfigModel = new WledMdnsConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => WledWebSocketConfigModel)
	@ApiProperty({
		description: 'WebSocket configuration',
		type: () => WledWebSocketConfigModel,
	})
	websocket: WledWebSocketConfigModel = new WledWebSocketConfigModel();
}
