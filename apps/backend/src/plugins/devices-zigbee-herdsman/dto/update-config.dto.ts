import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import {
	ADAPTER_TYPES,
	ALLOWED_CHANNELS_MAX,
	ALLOWED_CHANNELS_MIN,
	AdapterType,
	DEFAULT_BATTERY_DEVICE_TIMEOUT,
	DEFAULT_BAUD_RATE,
	DEFAULT_CHANNEL,
	DEFAULT_COMMAND_RETRIES,
	DEFAULT_MAINS_DEVICE_TIMEOUT,
	DEFAULT_PERMIT_JOIN_TIMEOUT,
	DEFAULT_SERIAL_PORT,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
} from '../devices-zigbee-herdsman.constants';

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginUpdateConfigSerial' })
export class ZhUpdateSerialDto {
	@ApiPropertyOptional({ description: 'Serial port path', example: DEFAULT_SERIAL_PORT })
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"path","reason":"Path must be a valid string."}]' })
	path?: string;

	@ApiPropertyOptional({ description: 'Baud rate', example: DEFAULT_BAUD_RATE, name: 'baud_rate' })
	@Expose({ name: 'baud_rate' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"baud_rate","reason":"Baud rate must be a whole number."}]' })
	@Min(9600, { message: '[{"field":"baud_rate","reason":"Baud rate minimum value must be at least 9600."}]' })
	baudRate?: number;

	@ApiPropertyOptional({ description: 'Adapter type', enum: ADAPTER_TYPES, name: 'adapter_type' })
	@Expose({ name: 'adapter_type' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(ADAPTER_TYPES, { message: '[{"field":"adapter_type","reason":"Adapter type must be a valid adapter."}]' })
	adapterType?: AdapterType;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginUpdateConfigNetwork' })
export class ZhUpdateNetworkDto {
	@ApiPropertyOptional({
		description: 'Zigbee channel',
		example: DEFAULT_CHANNEL,
		minimum: ALLOWED_CHANNELS_MIN,
		maximum: ALLOWED_CHANNELS_MAX,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"channel","reason":"Channel must be a whole number."}]' })
	@Min(ALLOWED_CHANNELS_MIN, {
		message: `[{"field":"channel","reason":"Channel minimum value must be at least ${ALLOWED_CHANNELS_MIN}."}]`,
	})
	@Max(ALLOWED_CHANNELS_MAX, {
		message: `[{"field":"channel","reason":"Channel maximum value must be at most ${ALLOWED_CHANNELS_MAX}."}]`,
	})
	channel?: number;
}

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginUpdateConfigDiscovery' })
export class ZhUpdateDiscoveryDto {
	@ApiPropertyOptional({
		description: 'Default permit join timeout in seconds',
		example: DEFAULT_PERMIT_JOIN_TIMEOUT,
		name: 'permit_join_timeout',
	})
	@Expose({ name: 'permit_join_timeout' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({
		message: '[{"field":"permit_join_timeout","reason":"Permit join timeout must be a whole number."}]',
	})
	@Min(0, {
		message: '[{"field":"permit_join_timeout","reason":"Permit join timeout minimum value must be at least 0."}]',
	})
	permitJoinTimeout?: number;

	@ApiPropertyOptional({
		description: 'Offline timeout for mains-powered devices in seconds',
		example: DEFAULT_MAINS_DEVICE_TIMEOUT,
		name: 'mains_device_timeout',
	})
	@Expose({ name: 'mains_device_timeout' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({
		message: '[{"field":"mains_device_timeout","reason":"Mains device timeout must be a whole number."}]',
	})
	@Min(60, {
		message: '[{"field":"mains_device_timeout","reason":"Mains device timeout minimum value must be at least 60."}]',
	})
	mainsDeviceTimeout?: number;

	@ApiPropertyOptional({
		description: 'Offline timeout for battery devices in seconds',
		example: DEFAULT_BATTERY_DEVICE_TIMEOUT,
		name: 'battery_device_timeout',
	})
	@Expose({ name: 'battery_device_timeout' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({
		message: '[{"field":"battery_device_timeout","reason":"Battery device timeout must be a whole number."}]',
	})
	@Min(60, {
		message:
			'[{"field":"battery_device_timeout","reason":"Battery device timeout minimum value must be at least 60."}]',
	})
	batteryDeviceTimeout?: number;

	@ApiPropertyOptional({
		description: 'Command retry attempts',
		example: DEFAULT_COMMAND_RETRIES,
		name: 'command_retries',
	})
	@Expose({ name: 'command_retries' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"command_retries","reason":"Command retries must be a whole number."}]' })
	@Min(1, { message: '[{"field":"command_retries","reason":"Command retries minimum value must be at least 1."}]' })
	commandRetries?: number;

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

@ApiSchema({ name: 'DevicesZigbeeHerdsmanPluginUpdateConfig' })
export class ZigbeeHerdsmanUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({ description: 'Plugin type identifier', example: DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME })
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME;

	@ApiPropertyOptional({ description: 'Serial port configuration', type: () => ZhUpdateSerialDto })
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => ZhUpdateSerialDto)
	serial?: ZhUpdateSerialDto;

	@ApiPropertyOptional({ description: 'Network configuration', type: () => ZhUpdateNetworkDto })
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => ZhUpdateNetworkDto)
	network?: ZhUpdateNetworkDto;

	@ApiPropertyOptional({ description: 'Discovery configuration', type: () => ZhUpdateDiscoveryDto })
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => ZhUpdateDiscoveryDto)
	discovery?: ZhUpdateDiscoveryDto;

	@ApiPropertyOptional({
		description: 'Path to zigbee-herdsman database file',
		name: 'database_path',
	})
	@Expose({ name: 'database_path' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"database_path","reason":"Database path must be a valid string."}]' })
	databasePath?: string;
}
