import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsString } from 'class-validator';
import { Column, Entity, Unique } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { MODBUS_DEFAULTS, ModbusFraming } from '../devices-modbus.constants';

const fromEither =
	<T>(snake: string, camel: string) =>
	({ obj }: { obj: Record<string, unknown> }): T =>
		(obj[snake] ?? obj[camel]) as T;

@ApiSchema({ name: 'DevicesModbusPluginDataEndpoint' })
@Entity('devices_modbus_endpoints')
@Unique('UQ_devices_modbus_endpoint_host_port', ['host', 'port'])
export class ModbusEndpointEntity extends BaseEntity {
	@ApiProperty({ description: 'Endpoint display name', type: 'string', example: 'Boiler room gateway' })
	@Expose()
	@IsString()
	@Column({ type: 'varchar' })
	name: string;

	@ApiProperty({ description: 'Host name or IP address', type: 'string', example: '10.10.0.230' })
	@Expose()
	@IsString()
	@Column({ type: 'varchar' })
	host: string;

	@ApiProperty({ description: 'TCP port', type: 'integer', example: MODBUS_DEFAULTS.PORT })
	@Expose()
	@IsInt()
	@Column({ type: 'integer' })
	port: number;

	@ApiProperty({ description: 'Wire framing', enum: ModbusFraming, example: ModbusFraming.TCP })
	@Expose()
	@IsEnum(ModbusFraming)
	@Column({ type: 'varchar' })
	framing: ModbusFraming;

	@ApiProperty({
		name: 'connect_timeout_ms',
		description: 'Connect timeout in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
	})
	@Expose({ name: 'connect_timeout_ms' })
	@IsInt()
	@Transform(fromEither<number>('connect_timeout_ms', 'connectTimeoutMs'), { toClassOnly: true })
	@Column({ type: 'integer' })
	connectTimeoutMs: number;

	@ApiProperty({
		name: 'request_timeout_ms',
		description: 'Request timeout in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
	})
	@Expose({ name: 'request_timeout_ms' })
	@IsInt()
	@Transform(fromEither<number>('request_timeout_ms', 'requestTimeoutMs'), { toClassOnly: true })
	@Column({ type: 'integer' })
	requestTimeoutMs: number;

	@ApiProperty({
		name: 'inter_request_delay_ms',
		description: 'Pause between consecutive requests in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.INTER_REQUEST_DELAY_MS_TCP,
	})
	@Expose({ name: 'inter_request_delay_ms' })
	@IsInt()
	@Transform(fromEither<number>('inter_request_delay_ms', 'interRequestDelayMs'), { toClassOnly: true })
	@Column({ type: 'integer' })
	interRequestDelayMs: number;

	@ApiProperty({
		name: 'max_in_flight',
		description: 'Maximum concurrent requests on the connection',
		type: 'integer',
		example: MODBUS_DEFAULTS.MAX_IN_FLIGHT,
	})
	@Expose({ name: 'max_in_flight' })
	@IsInt()
	@Transform(fromEither<number>('max_in_flight', 'maxInFlight'), { toClassOnly: true })
	@Column({ type: 'integer' })
	maxInFlight: number;

	@ApiProperty({ description: 'Whether the endpoint is polled', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	@Column({ type: 'boolean', default: true })
	enabled: boolean;
}
