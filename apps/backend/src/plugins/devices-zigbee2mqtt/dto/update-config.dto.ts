import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import {
	DEFAULT_MQTT_BASE_TOPIC,
	DEFAULT_MQTT_CONNECT_TIMEOUT,
	DEFAULT_MQTT_KEEPALIVE,
	DEFAULT_MQTT_PORT,
	DEFAULT_MQTT_RECONNECT_INTERVAL,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
} from '../devices-zigbee2mqtt.constants';

/**
 * Zigbee2MQTT MQTT update DTO
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginUpdateConfigMqtt' })
export class Z2mUpdateMqttDto {
	@ApiPropertyOptional({
		description: 'MQTT broker hostname or IP address',
		example: 'localhost',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"host","reason":"Host must be a valid string."}]' })
	host?: string;

	@ApiPropertyOptional({
		description: 'MQTT broker port',
		example: DEFAULT_MQTT_PORT,
		minimum: 1,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"port","reason":"Port must be a whole number."}]' })
	@Min(1, { message: '[{"field":"port","reason":"Port minimum value must be at least 1."}]' })
	port?: number;

	@ApiPropertyOptional({
		description: 'MQTT username for authentication',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"username","reason":"Username must be a valid string."}]' })
	username?: string | null;

	@ApiPropertyOptional({
		description: 'MQTT password for authentication',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password must be a valid string."}]' })
	password?: string | null;

	@ApiPropertyOptional({
		description: 'Zigbee2MQTT base topic',
		example: DEFAULT_MQTT_BASE_TOPIC,
		name: 'base_topic',
	})
	@Expose({ name: 'base_topic' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"base_topic","reason":"Base topic must be a valid string."}]' })
	baseTopic?: string;

	@ApiPropertyOptional({
		description: 'MQTT client identifier (auto-generated if not specified)',
		nullable: true,
		example: null,
		name: 'client_id',
	})
	@Expose({ name: 'client_id' })
	@IsOptional()
	@IsString({ message: '[{"field":"client_id","reason":"Client ID must be a valid string."}]' })
	clientId?: string | null;

	@ApiPropertyOptional({
		description: 'Start with a clean MQTT session',
		example: true,
		name: 'clean_session',
	})
	@Expose({ name: 'clean_session' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"clean_session","reason":"Clean session must be a boolean value."}]' })
	cleanSession?: boolean;

	@ApiPropertyOptional({
		description: 'MQTT keepalive interval in seconds',
		example: DEFAULT_MQTT_KEEPALIVE,
		minimum: 10,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"keepalive","reason":"Keepalive must be a whole number."}]' })
	@Min(10, { message: '[{"field":"keepalive","reason":"Keepalive minimum value must be at least 10."}]' })
	keepalive?: number;

	@ApiPropertyOptional({
		description: 'Connection timeout in milliseconds',
		example: DEFAULT_MQTT_CONNECT_TIMEOUT,
		minimum: 1000,
		name: 'connect_timeout',
	})
	@Expose({ name: 'connect_timeout' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"connect_timeout","reason":"Connect timeout must be a whole number."}]' })
	@Min(1000, {
		message: '[{"field":"connect_timeout","reason":"Connect timeout minimum value must be at least 1000ms."}]',
	})
	connectTimeout?: number;

	@ApiPropertyOptional({
		description: 'Reconnection interval in milliseconds',
		example: DEFAULT_MQTT_RECONNECT_INTERVAL,
		minimum: 1000,
		name: 'reconnect_interval',
	})
	@Expose({ name: 'reconnect_interval' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"reconnect_interval","reason":"Reconnect interval must be a whole number."}]' })
	@Min(1000, {
		message: '[{"field":"reconnect_interval","reason":"Reconnect interval minimum value must be at least 1000ms."}]',
	})
	reconnectInterval?: number;
}

/**
 * Zigbee2MQTT TLS update DTO
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginUpdateConfigTls' })
export class Z2mUpdateTlsDto {
	@ApiPropertyOptional({
		description: 'Whether TLS is enabled',
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Reject unauthorized SSL certificates',
		example: true,
		name: 'reject_unauthorized',
	})
	@Expose({ name: 'reject_unauthorized' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"reject_unauthorized","reason":"Reject unauthorized must be a boolean value."}]' })
	rejectUnauthorized?: boolean;

	@ApiPropertyOptional({
		description: 'CA certificate content or path',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"ca","reason":"CA must be a valid string."}]' })
	ca?: string | null;

	@ApiPropertyOptional({
		description: 'Client certificate content or path',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"cert","reason":"Cert must be a valid string."}]' })
	cert?: string | null;

	@ApiPropertyOptional({
		description: 'Client private key content or path',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"key","reason":"Key must be a valid string."}]' })
	key?: string | null;
}

/**
 * Zigbee2MQTT discovery update DTO
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginUpdateConfigDiscovery' })
export class Z2mUpdateDiscoveryDto {
	@ApiPropertyOptional({
		description: 'Automatically add discovered devices to the system',
		example: true,
		name: 'auto_add',
	})
	@Expose({ name: 'auto_add' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"auto_add","reason":"Auto add must be a boolean value."}]' })
	autoAdd?: boolean;

	@ApiPropertyOptional({
		description: 'Synchronize all devices on startup',
		example: true,
		name: 'sync_on_startup',
	})
	@Expose({ name: 'sync_on_startup' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"sync_on_startup","reason":"Sync on startup must be a boolean value."}]' })
	syncOnStartup?: boolean;
}

/**
 * Main Zigbee2MQTT plugin configuration update DTO
 */
@ApiSchema({ name: 'DevicesZigbee2mqttPluginUpdateConfig' })
export class Zigbee2mqttUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_ZIGBEE2MQTT_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'MQTT configuration',
		type: () => Z2mUpdateMqttDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => Z2mUpdateMqttDto)
	mqtt?: Z2mUpdateMqttDto;

	@ApiPropertyOptional({
		description: 'TLS/SSL configuration',
		type: () => Z2mUpdateTlsDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => Z2mUpdateTlsDto)
	tls?: Z2mUpdateTlsDto;

	@ApiPropertyOptional({
		description: 'Device discovery configuration',
		type: () => Z2mUpdateDiscoveryDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => Z2mUpdateDiscoveryDto)
	discovery?: Z2mUpdateDiscoveryDto;
}
