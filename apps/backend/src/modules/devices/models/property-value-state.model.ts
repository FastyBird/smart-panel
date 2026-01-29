import { Expose } from 'class-transformer';

import { ApiPropertyOptional } from '@nestjs/swagger';

export type PropertyValueTrend = 'rising' | 'falling' | 'stable';

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
