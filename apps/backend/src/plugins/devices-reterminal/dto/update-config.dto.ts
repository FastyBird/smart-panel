import { Expose, Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEFAULT_SENSOR_POLLING_INTERVAL_MS, DEVICES_RETERMINAL_PLUGIN_NAME } from '../devices-reterminal.constants';

/**
 * reTerminal polling update DTO
 */
@ApiSchema({ name: 'DevicesReTerminalPluginUpdateConfigPolling' })
export class ReTerminalUpdatePollingDto {
	@ApiPropertyOptional({
		description: 'Sensor polling interval in milliseconds',
		example: DEFAULT_SENSOR_POLLING_INTERVAL_MS,
		minimum: 1000,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"interval","reason":"Polling interval must be a whole number."}]' })
	@Min(1000, {
		message: '[{"field":"interval","reason":"Polling interval minimum value must be at least 1000ms."}]',
	})
	interval?: number;
}

/**
 * Main reTerminal plugin configuration update DTO
 */
@ApiSchema({ name: 'DevicesReTerminalPluginUpdateConfig' })
export class ReTerminalUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_RETERMINAL_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_RETERMINAL_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Polling configuration',
		type: () => ReTerminalUpdatePollingDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@ValidateNested()
	@Type(() => ReTerminalUpdatePollingDto)
	polling?: ReTerminalUpdatePollingDto;
}
