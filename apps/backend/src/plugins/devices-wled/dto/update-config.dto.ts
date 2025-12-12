import { Expose, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEFAULT_COMMAND_DEBOUNCE_MS, DEFAULT_CONNECTION_TIMEOUT_MS, DEVICES_WLED_PLUGIN_NAME } from '../devices-wled.constants';

/**
 * WLED device host update DTO
 */
@ApiSchema({ name: 'DevicesWledPluginUpdateConfigDeviceHost' })
export class WledUpdateDeviceHostDto {
	@ApiProperty({
		description: 'WLED device hostname or IP address',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString({ message: '[{"field":"host","reason":"Host must be a valid string."}]' })
	host: string;

	@ApiPropertyOptional({
		description: 'Optional name for the device',
		example: 'Living Room LEDs',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	name?: string | null;

	@ApiPropertyOptional({
		description: 'Optional device identifier',
		example: 'wled-aabbcc',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"identifier","reason":"Identifier must be a valid string."}]' })
	identifier?: string | null;
}

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
	@IsOptional()
	@IsInt({ message: '[{"field":"interval","reason":"Polling interval must be a whole number."}]' })
	@Min(5000, {
		message: '[{"field":"interval","reason":"Polling interval minimum value must be at least 5000ms."}]',
	})
	interval?: number;
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
		description: 'List of WLED device hosts to connect to',
		type: [WledUpdateDeviceHostDto],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"devices","reason":"Devices must be an array."}]' })
	@ValidateNested({ each: true })
	@Type(() => WledUpdateDeviceHostDto)
	devices?: WledUpdateDeviceHostDto[];

	@ApiPropertyOptional({
		description: 'Timeout configuration',
		type: () => WledUpdateTimeoutsDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => WledUpdateTimeoutsDto)
	timeouts?: WledUpdateTimeoutsDto;

	@ApiPropertyOptional({
		description: 'Polling configuration',
		type: () => WledUpdatePollingDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => WledUpdatePollingDto)
	polling?: WledUpdatePollingDto;
}
