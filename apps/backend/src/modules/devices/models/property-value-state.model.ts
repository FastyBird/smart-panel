import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PropertyValueTrend = 'rising' | 'falling' | 'stable';

export type PropertyProducerQuality = 'good' | 'degraded' | 'unavailable';

@Expose()
export class PropertyProducerState {
	@ApiProperty({ enum: ['good', 'degraded', 'unavailable'] })
	@Expose()
	quality: PropertyProducerQuality;

	@ApiProperty({ type: [String] })
	@Expose()
	reasons: string[];

	@ApiProperty({ name: 'sampled_at', type: String, format: 'date-time', nullable: true })
	@Expose({ name: 'sampled_at' })
	sampledAt: string | null;

	@ApiProperty({ name: 'evaluated_at', type: String, format: 'date-time' })
	@Expose({ name: 'evaluated_at' })
	evaluatedAt: string;

	@ApiProperty({ name: 'expires_at', type: String, format: 'date-time', nullable: true })
	@Expose({ name: 'expires_at' })
	expiresAt: string | null;

	@ApiProperty({ type: Number })
	@Expose()
	revision: number;
}

@Expose()
export class PropertyValueState {
	@ApiPropertyOptional({
		description: 'Property current value',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		example: 25.5,
	})
	@Expose()
	value: string | number | boolean | null;

	@ApiPropertyOptional({
		name: 'last_updated',
		description: 'ISO 8601 timestamp of the last measurement from InfluxDB',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2026-01-29T12:00:00.000Z',
	})
	@Expose({ name: 'last_updated' })
	lastUpdated: string | null;

	@ApiPropertyOptional({
		description: 'Value trend direction computed from recent data points',
		enum: ['rising', 'falling', 'stable'],
		nullable: true,
		example: 'stable',
	})
	@Expose()
	trend: PropertyValueTrend | null;

	@ApiPropertyOptional({
		type: () => PropertyProducerState,
		description: 'Opt-in derived producer quality and freshness',
	})
	@Expose()
	@Type(() => PropertyProducerState)
	producer?: PropertyProducerState;

	constructor(
		value: string | number | boolean | null = null,
		lastUpdated: string | null = null,
		trend: PropertyValueTrend | null = null,
	) {
		this.value = value;
		this.lastUpdated = lastUpdated;
		this.trend = trend;
	}
}

/** Detached snapshot, preserving optional producer metadata for plain structural state objects too. */
export function clonePropertyValueState(state: PropertyValueState): PropertyValueState {
	const copy = new PropertyValueState(state.value, state.lastUpdated, state.trend);
	if (state.producer)
		copy.producer = Object.assign(new PropertyProducerState(), state.producer, {
			reasons: [...state.producer.reasons],
		});
	return copy;
}
