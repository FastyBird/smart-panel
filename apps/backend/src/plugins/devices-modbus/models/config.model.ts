import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_MODBUS_PLUGIN_NAME, MODBUS_DEFAULTS, MODBUS_LIMITS } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginDataConfig' })
export class ModbusConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_MODBUS_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_MODBUS_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;

	@ApiProperty({
		name: 'default_connect_timeout_ms',
		description: 'Connect timeout used for new endpoints that do not set their own, in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose({ name: 'default_connect_timeout_ms' })
	@IsInt()
	@Min(1)
	@Max(MODBUS_LIMITS.MAX_TIMING_MS)
	defaultConnectTimeoutMs: number = MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS;

	@ApiProperty({
		name: 'default_request_timeout_ms',
		description: 'Request timeout used for new endpoints that do not set their own, in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose({ name: 'default_request_timeout_ms' })
	@IsInt()
	@Min(1)
	@Max(MODBUS_LIMITS.MAX_TIMING_MS)
	defaultRequestTimeoutMs: number = MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS;

	@ApiProperty({
		name: 'default_poll_interval_ms',
		description: 'Poll interval suggested for new devices, in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
		minimum: MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS,
		maximum: MODBUS_LIMITS.MAX_POLL_INTERVAL_MS,
	})
	@Expose({ name: 'default_poll_interval_ms' })
	@IsInt()
	@Min(MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS)
	@Max(MODBUS_LIMITS.MAX_POLL_INTERVAL_MS)
	defaultPollIntervalMs: number = MODBUS_DEFAULTS.POLL_INTERVAL_MS;
}
