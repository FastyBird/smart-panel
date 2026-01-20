import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import {
	DEFAULT_COMMAND_DEBOUNCE_MS,
	DEFAULT_CONNECTION_TIMEOUT_MS,
	DEVICES_WLED_PLUGIN_NAME,
} from '../devices-wled.constants';

/**
 * WLED timeouts update DTO
 */
@ApiSchema({ name: 'DevicesWledPluginUpdateConfigTimeouts' })
export class WledUpdateTimeoutsDto {
	@ApiPropertyOptional({
		description: 'Connection timeout in milliseconds',
		example: DEFAULT_CONNECTION_TIMEOUT_MS,
		minimum: 1000,
		name: 'connection_timeout',
	})
	@Expose({ name: 'connection_timeout' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"connection_timeout","reason":"Connection timeout must be a whole number."}]' })
	@Min(1000, {
		message: '[{"field":"connection_timeout","reason":"Connection timeout minimum value must be at least 1000ms."}]',
	})
	connectionTimeout?: number;

	@ApiPropertyOptional({
		description: 'Command debounce delay in milliseconds',
		example: DEFAULT_COMMAND_DEBOUNCE_MS,
		minimum: 0,
		name: 'command_debounce',
	})
	@Expose({ name: 'command_debounce' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"command_debounce","reason":"Command debounce must be a whole number."}]' })
	@Min(0, {
		message: '[{"field":"command_debounce","reason":"Command debounce minimum value must be at least 0ms."}]',
	})
	commandDebounce?: number;
}

/**
 * WLED polling update DTO
 */
@ApiSchema({ name: 'DevicesWledPluginUpdateConfigPolling' })
export class WledUpdatePollingDto {
	@ApiPropertyOptional({
		description: 'State polling interval in milliseconds',
		example: 30000,
		minimum: 5000,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"interval","reason":"Polling interval must be a whole number."}]' })
	@Min(5000, {
		message: '[{"field":"interval","reason":"Polling interval minimum value must be at least 5000ms."}]',
	})
	interval?: number;
}

/**
 * WLED mDNS discovery update DTO
 */
@ApiSchema({ name: 'DevicesWledPluginUpdateConfigMdns' })
export class WledUpdateMdnsDto {
	@ApiPropertyOptional({
		description: 'Whether mDNS discovery is enabled',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Network interface for mDNS discovery (null for all interfaces)',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"interface","reason":"Interface must be a valid string."}]' })
	interface?: string | null;

	@ApiPropertyOptional({
		description: 'Automatically add discovered devices to the system',
		example: false,
		name: 'auto_add',
	})
	@Expose({ name: 'auto_add' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"auto_add","reason":"Auto add must be a boolean value."}]' })
	autoAdd?: boolean;
}

/**
 * WLED WebSocket update DTO
 */
@ApiSchema({ name: 'DevicesWledPluginUpdateConfigWebSocket' })
export class WledUpdateWebSocketDto {
	@ApiPropertyOptional({
		description: 'Whether to use WebSocket for real-time state updates',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'WebSocket reconnection interval in milliseconds',
		example: 5000,
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
 * Main WLED plugin configuration update DTO
 */
@ApiSchema({ name: 'DevicesWledPluginUpdateConfig' })
export class WledUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_WLED_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_WLED_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Timeout configuration',
		type: () => WledUpdateTimeoutsDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => WledUpdateTimeoutsDto)
	timeouts?: WledUpdateTimeoutsDto;

	@ApiPropertyOptional({
		description: 'Polling configuration',
		type: () => WledUpdatePollingDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => WledUpdatePollingDto)
	polling?: WledUpdatePollingDto;

	@ApiPropertyOptional({
		description: 'mDNS discovery configuration',
		type: () => WledUpdateMdnsDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => WledUpdateMdnsDto)
	mdns?: WledUpdateMdnsDto;

	@ApiPropertyOptional({
		description: 'WebSocket configuration',
		type: () => WledUpdateWebSocketDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => WledUpdateWebSocketDto)
	websocket?: WledUpdateWebSocketDto;
}
