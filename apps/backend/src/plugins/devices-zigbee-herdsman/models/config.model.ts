import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	ADAPTER_TYPES,
	ALLOWED_CHANNELS_MAX,
	ALLOWED_CHANNELS_MIN,
	AdapterType,
	DEFAULT_ADAPTER_TYPE,
	DEFAULT_BATTERY_DEVICE_TIMEOUT,
	DEFAULT_BAUD_RATE,
	DEFAULT_CHANNEL,
	DEFAULT_COMMAND_RETRIES,
	DEFAULT_DATABASE_PATH,
	DEFAULT_MAINS_DEVICE_TIMEOUT,
	DEFAULT_PERMIT_JOIN_TIMEOUT,
	DEFAULT_SERIAL_PORT,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
} from '../devices-zigbee-herdsman.constants';

/**
 * Serial port configuration
 */
@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataSerialConfig' })
export class ZhSerialConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Serial port path to Zigbee coordinator',
		example: DEFAULT_SERIAL_PORT,
	})
	path: string = DEFAULT_SERIAL_PORT;

	@Expose({ name: 'baud_rate' })
	@IsInt()
	@Min(9600)
	@ApiProperty({
		name: 'baud_rate',
		description: 'Serial port baud rate',
		example: DEFAULT_BAUD_RATE,
	})
	baudRate: number = DEFAULT_BAUD_RATE;

	@Expose({ name: 'adapter_type' })
	@IsEnum(ADAPTER_TYPES)
	@ApiProperty({
		name: 'adapter_type',
		description: 'Zigbee adapter type',
		enum: ADAPTER_TYPES,
		example: DEFAULT_ADAPTER_TYPE,
	})
	adapterType: AdapterType = DEFAULT_ADAPTER_TYPE;
}

/**
 * Zigbee network configuration
 */
@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataNetworkConfig' })
export class ZhNetworkConfigModel {
	@Expose()
	@IsInt()
	@Min(ALLOWED_CHANNELS_MIN)
	@Max(ALLOWED_CHANNELS_MAX)
	@ApiProperty({
		description: 'Zigbee channel (11-26, recommended: 11, 15, 20, 25)',
		example: DEFAULT_CHANNEL,
		minimum: ALLOWED_CHANNELS_MIN,
		maximum: ALLOWED_CHANNELS_MAX,
	})
	channel: number = DEFAULT_CHANNEL;

	@Expose({ name: 'pan_id' })
	@IsOptional()
	@IsInt()
	@ApiPropertyOptional({
		name: 'pan_id',
		description: 'PAN ID (auto-generated if not set)',
		nullable: true,
	})
	panId: number | null = null;

	@Expose({ name: 'extended_pan_id' })
	@IsOptional()
	@IsArray()
	@ApiPropertyOptional({
		name: 'extended_pan_id',
		description: 'Extended PAN ID (auto-generated if not set)',
		type: [Number],
		nullable: true,
	})
	extendedPanId: number[] | null = null;

	@Expose({ name: 'network_key' })
	@IsOptional()
	@IsArray()
	networkKey: number[] | null = null;
}

/**
 * Discovery/join configuration
 */
@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataDiscoveryConfig' })
export class ZhDiscoveryConfigModel {
	@Expose({ name: 'permit_join_timeout' })
	@IsInt()
	@Min(0)
	@ApiProperty({
		name: 'permit_join_timeout',
		description: 'Default permit join timeout in seconds (0 = disabled, max 254)',
		example: DEFAULT_PERMIT_JOIN_TIMEOUT,
	})
	permitJoinTimeout: number = DEFAULT_PERMIT_JOIN_TIMEOUT;

	@Expose({ name: 'mains_device_timeout' })
	@IsInt()
	@Min(60)
	@ApiProperty({
		name: 'mains_device_timeout',
		description: 'Offline timeout for mains-powered devices in seconds',
		example: DEFAULT_MAINS_DEVICE_TIMEOUT,
	})
	mainsDeviceTimeout: number = DEFAULT_MAINS_DEVICE_TIMEOUT;

	@Expose({ name: 'battery_device_timeout' })
	@IsInt()
	@Min(60)
	@ApiProperty({
		name: 'battery_device_timeout',
		description: 'Offline timeout for battery-powered devices in seconds',
		example: DEFAULT_BATTERY_DEVICE_TIMEOUT,
	})
	batteryDeviceTimeout: number = DEFAULT_BATTERY_DEVICE_TIMEOUT;

	@Expose({ name: 'command_retries' })
	@IsInt()
	@Min(1)
	@ApiProperty({
		name: 'command_retries',
		description: 'Number of command retry attempts for unreliable devices',
		example: DEFAULT_COMMAND_RETRIES,
	})
	commandRetries: number = DEFAULT_COMMAND_RETRIES;

	@Expose({ name: 'sync_on_startup' })
	@IsBoolean()
	@ApiProperty({
		name: 'sync_on_startup',
		description: 'Synchronize all devices on startup',
		example: true,
	})
	syncOnStartup: boolean = true;
}

/**
 * Main plugin configuration model
 */
@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginDataConfig' })
export class ZigbeeHerdsmanConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	})
	type: string = DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME;

	@Expose()
	@ValidateNested()
	@Type(() => ZhSerialConfigModel)
	@ApiProperty({
		description: 'Serial port configuration',
		type: () => ZhSerialConfigModel,
	})
	serial: ZhSerialConfigModel = new ZhSerialConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => ZhNetworkConfigModel)
	@ApiProperty({
		description: 'Zigbee network configuration',
		type: () => ZhNetworkConfigModel,
	})
	network: ZhNetworkConfigModel = new ZhNetworkConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => ZhDiscoveryConfigModel)
	@ApiProperty({
		description: 'Discovery and join configuration',
		type: () => ZhDiscoveryConfigModel,
	})
	discovery: ZhDiscoveryConfigModel = new ZhDiscoveryConfigModel();

	@Expose({ name: 'database_path' })
	@IsString()
	@ApiProperty({
		name: 'database_path',
		description: 'Path to zigbee-herdsman database file',
		example: DEFAULT_DATABASE_PATH,
	})
	databasePath: string = DEFAULT_DATABASE_PATH;
}
