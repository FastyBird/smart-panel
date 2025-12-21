import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	DEFAULT_MQTT_BASE_TOPIC,
	DEFAULT_MQTT_CONNECT_TIMEOUT,
	DEFAULT_MQTT_KEEPALIVE,
	DEFAULT_MQTT_PORT,
	DEFAULT_MQTT_RECONNECT_INTERVAL,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
} from '../devices-zigbee2mqtt.constants';

/**
 * Zigbee2MQTT MQTT connection configuration
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataMqttConfig' })
export class Z2mMqttConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'MQTT broker hostname or IP address',
		example: 'localhost',
	})
	host: string = 'localhost';

	@Expose()
	@IsInt()
	@Min(1)
	@ApiProperty({
		description: 'MQTT broker port',
		example: DEFAULT_MQTT_PORT,
		minimum: 1,
	})
	port: number = DEFAULT_MQTT_PORT;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'MQTT username for authentication',
		nullable: true,
		example: null,
	})
	username: string | null = null;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'MQTT password for authentication',
		nullable: true,
		example: null,
	})
	password: string | null = null;

	@Expose({ name: 'base_topic' })
	@IsString()
	@ApiProperty({
		name: 'base_topic',
		description: 'Zigbee2MQTT base topic',
		example: DEFAULT_MQTT_BASE_TOPIC,
	})
	baseTopic: string = DEFAULT_MQTT_BASE_TOPIC;

	@Expose({ name: 'client_id' })
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		name: 'client_id',
		description: 'MQTT client identifier (auto-generated if not specified)',
		nullable: true,
		example: null,
	})
	clientId: string | null = null;

	@Expose({ name: 'clean_session' })
	@IsBoolean()
	@ApiProperty({
		name: 'clean_session',
		description: 'Start with a clean MQTT session',
		example: true,
	})
	cleanSession: boolean = true;

	@Expose()
	@IsInt()
	@Min(10)
	@ApiProperty({
		description: 'MQTT keepalive interval in seconds',
		example: DEFAULT_MQTT_KEEPALIVE,
		minimum: 10,
	})
	keepalive: number = DEFAULT_MQTT_KEEPALIVE;

	@Expose({ name: 'connect_timeout' })
	@IsInt()
	@Min(1000)
	@ApiProperty({
		name: 'connect_timeout',
		description: 'Connection timeout in milliseconds',
		example: DEFAULT_MQTT_CONNECT_TIMEOUT,
		minimum: 1000,
	})
	connectTimeout: number = DEFAULT_MQTT_CONNECT_TIMEOUT;

	@Expose({ name: 'reconnect_interval' })
	@IsInt()
	@Min(1000)
	@ApiProperty({
		name: 'reconnect_interval',
		description: 'Reconnection interval in milliseconds',
		example: DEFAULT_MQTT_RECONNECT_INTERVAL,
		minimum: 1000,
	})
	reconnectInterval: number = DEFAULT_MQTT_RECONNECT_INTERVAL;
}

/**
 * Zigbee2MQTT TLS/SSL configuration
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataTlsConfig' })
export class Z2mTlsConfigModel {
	@Expose()
	@IsBoolean()
	@ApiProperty({
		description: 'Whether TLS is enabled',
		example: false,
	})
	enabled: boolean = false;

	@Expose({ name: 'reject_unauthorized' })
	@IsBoolean()
	@ApiProperty({
		name: 'reject_unauthorized',
		description: 'Reject unauthorized SSL certificates',
		example: true,
	})
	rejectUnauthorized: boolean = true;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'CA certificate content or path',
		nullable: true,
		example: null,
	})
	ca: string | null = null;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Client certificate content or path',
		nullable: true,
		example: null,
	})
	cert: string | null = null;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Client private key content or path',
		nullable: true,
		example: null,
	})
	key: string | null = null;
}

/**
 * Zigbee2MQTT device discovery configuration
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataDiscoveryConfig' })
export class Z2mDiscoveryConfigModel {
	@Expose({ name: 'auto_add' })
	@IsBoolean()
	@ApiProperty({
		name: 'auto_add',
		description: 'Automatically add discovered devices to the system',
		example: true,
	})
	autoAdd: boolean = true;

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
 * Main Zigbee2MQTT plugin configuration model
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataConfig' })
export class Zigbee2mqttConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	})
	type: string = DEVICES_ZIGBEE2MQTT_PLUGIN_NAME;

	@Expose()
	@ValidateNested()
	@Type(() => Z2mMqttConfigModel)
	@ApiProperty({
		description: 'MQTT connection configuration',
		type: () => Z2mMqttConfigModel,
	})
	mqtt: Z2mMqttConfigModel = new Z2mMqttConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => Z2mTlsConfigModel)
	@ApiProperty({
		description: 'TLS/SSL configuration',
		type: () => Z2mTlsConfigModel,
	})
	tls: Z2mTlsConfigModel = new Z2mTlsConfigModel();

	@Expose()
	@ValidateNested()
	@Type(() => Z2mDiscoveryConfigModel)
	@ApiProperty({
		description: 'Device discovery configuration',
		type: () => Z2mDiscoveryConfigModel,
	})
	discovery: Z2mDiscoveryConfigModel = new Z2mDiscoveryConfigModel();
}
