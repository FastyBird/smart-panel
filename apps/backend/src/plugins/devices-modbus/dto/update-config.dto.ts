import { Expose } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_MODBUS_PLUGIN_NAME, MODBUS_DEFAULTS, MODBUS_LIMITS } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginUpdateConfig' })
export class ModbusUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_MODBUS_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_MODBUS_PLUGIN_NAME;

	@ApiPropertyOptional({
		name: 'default_connect_timeout_ms',
		description: 'Connect timeout used for new endpoints that do not set their own, in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose({ name: 'default_connect_timeout_ms' })
	@IsOptional()
	@IsInt({ message: '[{"field":"default_connect_timeout_ms","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"default_connect_timeout_ms","reason":"Value must be at least 1."}]' })
	@Max(MODBUS_LIMITS.MAX_TIMING_MS, {
		message: '[{"field":"default_connect_timeout_ms","reason":"Value must be at most 60000."}]',
	})
	defaultConnectTimeoutMs?: number;

	@ApiPropertyOptional({
		name: 'default_request_timeout_ms',
		description: 'Request timeout used for new endpoints that do not set their own, in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose({ name: 'default_request_timeout_ms' })
	@IsOptional()
	@IsInt({ message: '[{"field":"default_request_timeout_ms","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"default_request_timeout_ms","reason":"Value must be at least 1."}]' })
	@Max(MODBUS_LIMITS.MAX_TIMING_MS, {
		message: '[{"field":"default_request_timeout_ms","reason":"Value must be at most 60000."}]',
	})
	defaultRequestTimeoutMs?: number;

	@ApiPropertyOptional({
		name: 'default_poll_interval_ms',
		description: 'Poll interval suggested for new devices, in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
		minimum: MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS,
		maximum: MODBUS_LIMITS.MAX_POLL_INTERVAL_MS,
	})
	@Expose({ name: 'default_poll_interval_ms' })
	@IsOptional()
	@IsInt({ message: '[{"field":"default_poll_interval_ms","reason":"Value must be an integer."}]' })
	@Min(MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS, {
		message: '[{"field":"default_poll_interval_ms","reason":"Value must be at least 100."}]',
	})
	@Max(MODBUS_LIMITS.MAX_POLL_INTERVAL_MS, {
		message: '[{"field":"default_poll_interval_ms","reason":"Value must be at most 86400000."}]',
	})
	defaultPollIntervalMs?: number;
}
