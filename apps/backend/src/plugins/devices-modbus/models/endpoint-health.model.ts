import { Expose, Transform } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { EndpointConnectionState, EndpointHealth } from '../runtime/endpoint-connection';

const STATES: EndpointConnectionState[] = ['connecting', 'connected', 'backoff', 'stopped'];

@ApiSchema({ name: 'DevicesModbusPluginDataEndpointHealth' })
export class ModbusEndpointHealthModel implements EndpointHealth {
	@ApiProperty({ description: 'Connection state', enum: STATES, example: 'connected' })
	@Expose()
	state: EndpointConnectionState;

	@ApiProperty({
		name: 'last_error',
		description: 'Last connection or request error',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'last_error' })
	lastError: string | null;

	@ApiProperty({
		name: 'last_error_at',
		description: 'When the last error happened',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'last_error_at' })
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastErrorAt: Date | null;

	@ApiProperty({
		name: 'average_latency_ms',
		description: 'Moving average of successful request round-trips in milliseconds; null until the first success',
		type: 'number',
		nullable: true,
		example: 12.5,
	})
	@Expose({ name: 'average_latency_ms' })
	averageLatencyMs: number | null;

	@ApiProperty({ description: 'Requests sent on the wire', type: 'integer', example: 120 })
	@Expose()
	requests: number;

	@ApiProperty({ description: 'Requests that ended with a timeout', type: 'integer', example: 0 })
	@Expose()
	timeouts: number;

	@ApiProperty({
		description: 'Whether the endpoint is overloaded by the polling load',
		type: 'boolean',
		example: false,
	})
	@Expose()
	overloaded: boolean;

	static stopped(): ModbusEndpointHealthModel {
		return Object.assign(new ModbusEndpointHealthModel(), {
			state: 'stopped',
			lastError: null,
			lastErrorAt: null,
			averageLatencyMs: null,
			requests: 0,
			timeouts: 0,
			overloaded: false,
		} satisfies EndpointHealth);
	}

	static from(health: EndpointHealth): ModbusEndpointHealthModel {
		return Object.assign(new ModbusEndpointHealthModel(), health);
	}
}

@ApiSchema({ name: 'DevicesModbusPluginResEndpointHealth' })
export class ModbusEndpointHealthResponseModel extends BaseSuccessResponseModel<ModbusEndpointHealthModel> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusEndpointHealthModel })
	@Expose()
	declare data: ModbusEndpointHealthModel;
}
