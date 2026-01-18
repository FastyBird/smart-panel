import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginUpdateConfigDiscovery' })
export class ShellyV1UpdatePluginConfigDiscoveryDto {
	@ApiPropertyOptional({
		description: 'Enable device discovery',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Discovery enabled attribute must be a boolean."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Network interface to use for device discovery',
		example: 'eth0',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"interface","reason":"Discovery interface must be a valid string."}]' })
	interface?: string | null;
}

@ApiSchema({ name: 'DevicesShellyV1PluginUpdateConfigTimeouts' })
export class ShellyV1UpdatePluginConfigTimeoutsDto {
	@ApiPropertyOptional({
		description: 'Request timeout in milliseconds',
		example: 5000,
		minimum: 1,
		name: 'request_timeout',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"request_timeout","reason":"Request timeout must be a whole number."}]' })
	@Min(1, {
		message: '[{"field":"request_timeout","reason":"Request timeout minimum value must be greater than 0."}]',
	})
	request_timeout?: number;

	@ApiPropertyOptional({
		description: 'Stale timeout interval in milliseconds',
		example: 30000,
		minimum: 1,
		name: 'stale_timeout',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({
		message: '[{"field":"stale_timeout","reason":"Stale timeout interval must be a whole number."}]',
	})
	@Min(1, {
		message: '[{"field":"stale_timeout","reason":"Stale timeout interval minimum value must be greater than 0."}]',
	})
	stale_timeout?: number;
}

@ApiSchema({ name: 'DevicesShellyV1PluginUpdateConfig' })
export class ShellyV1UpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: 'devices-shelly-v1',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_SHELLY_V1_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Device discovery configuration',
		type: () => ShellyV1UpdatePluginConfigDiscoveryDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyV1UpdatePluginConfigDiscoveryDto)
	discovery?: ShellyV1UpdatePluginConfigDiscoveryDto;

	@ApiPropertyOptional({
		description: 'Timeout configuration',
		type: () => ShellyV1UpdatePluginConfigTimeoutsDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => ShellyV1UpdatePluginConfigTimeoutsDto)
	timeouts?: ShellyV1UpdatePluginConfigTimeoutsDto;
}
