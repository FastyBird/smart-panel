import { Expose, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MODBUS_DEFAULTS, MODBUS_LIMITS, ModbusFraming } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginCreateEndpoint' })
export class CreateModbusEndpointDto {
	@ApiProperty({ description: 'Endpoint display name', type: 'string', example: 'Boiler room gateway' })
	@Expose()
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@MaxLength(255, { message: '[{"field":"name","reason":"Name must be at most 255 characters."}]' })
	name: string;

	@ApiProperty({ description: 'Host name or IP address', type: 'string', example: '10.10.0.230' })
	@Expose()
	@IsString({ message: '[{"field":"host","reason":"Host must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"host","reason":"Host must be a non-empty string."}]' })
	@MaxLength(255, { message: '[{"field":"host","reason":"Host must be at most 255 characters."}]' })
	host: string;

	@ApiPropertyOptional({
		description: 'TCP port',
		type: 'integer',
		example: MODBUS_DEFAULTS.PORT,
		minimum: 1,
		maximum: 65535,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"port","reason":"Port must be an integer."}]' })
	@Min(1, { message: '[{"field":"port","reason":"Port must be at least 1."}]' })
	@Max(65535, { message: '[{"field":"port","reason":"Port must be at most 65535."}]' })
	port?: number;

	@ApiPropertyOptional({ description: 'Wire framing', enum: ModbusFraming, example: ModbusFraming.TCP })
	@Expose()
	@IsOptional()
	@IsEnum(ModbusFraming, { message: '[{"field":"framing","reason":"Framing must be tcp or rtu_over_tcp."}]' })
	framing?: ModbusFraming;

	@ApiPropertyOptional({
		name: 'connect_timeout_ms',
		description: 'Connect timeout in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"connect_timeout_ms","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"connect_timeout_ms","reason":"Value must be at least 1."}]' })
	@Max(MODBUS_LIMITS.MAX_TIMING_MS, {
		message: '[{"field":"connect_timeout_ms","reason":"Value must be at most 60000."}]',
	})
	connect_timeout_ms?: number;

	@ApiPropertyOptional({
		name: 'request_timeout_ms',
		description: 'Request timeout in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"request_timeout_ms","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"request_timeout_ms","reason":"Value must be at least 1."}]' })
	@Max(MODBUS_LIMITS.MAX_TIMING_MS, {
		message: '[{"field":"request_timeout_ms","reason":"Value must be at most 60000."}]',
	})
	request_timeout_ms?: number;

	@ApiPropertyOptional({
		name: 'inter_request_delay_ms',
		description:
			'Pause between consecutive requests in milliseconds; defaults by framing (0 for tcp, 20 for rtu_over_tcp)',
		type: 'integer',
		example: MODBUS_DEFAULTS.INTER_REQUEST_DELAY_MS_TCP,
		minimum: 0,
		maximum: MODBUS_LIMITS.MAX_TIMING_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"inter_request_delay_ms","reason":"Value must be an integer."}]' })
	@Min(0, { message: '[{"field":"inter_request_delay_ms","reason":"Value must be at least 0."}]' })
	@Max(MODBUS_LIMITS.MAX_TIMING_MS, {
		message: '[{"field":"inter_request_delay_ms","reason":"Value must be at most 60000."}]',
	})
	inter_request_delay_ms?: number;

	@ApiPropertyOptional({
		name: 'max_in_flight',
		description: 'Maximum concurrent requests on the connection; always 1 for rtu_over_tcp',
		type: 'integer',
		example: MODBUS_DEFAULTS.MAX_IN_FLIGHT,
		minimum: 1,
		maximum: MODBUS_LIMITS.MAX_IN_FLIGHT,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"max_in_flight","reason":"Value must be an integer."}]' })
	@Min(1, { message: '[{"field":"max_in_flight","reason":"Value must be at least 1."}]' })
	@Max(MODBUS_LIMITS.MAX_IN_FLIGHT, { message: '[{"field":"max_in_flight","reason":"Value must be at most 16."}]' })
	max_in_flight?: number;

	@ApiPropertyOptional({ description: 'Whether the endpoint is polled', type: 'boolean', example: true })
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { enabled?: unknown } }) => obj.enabled, { toClassOnly: true })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'DevicesModbusPluginReqCreateEndpoint' })
export class ReqCreateModbusEndpointDto {
	@ApiProperty({ description: 'Endpoint data', type: () => CreateModbusEndpointDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateModbusEndpointDto)
	data: CreateModbusEndpointDto;
}
