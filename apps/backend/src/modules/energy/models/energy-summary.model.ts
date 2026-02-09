import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'EnergyModuleDataEnergySummary' })
export class EnergySummaryModel {
	@ApiProperty({
		name: 'total_consumption_kwh',
		description: 'Total energy consumption in kWh for the requested range.',
		type: 'number',
		format: 'float',
		example: 12.45,
	})
	@Expose({ name: 'total_consumption_kwh' })
	@IsNumber()
	totalConsumptionKwh: number;

	@ApiProperty({
		name: 'total_production_kwh',
		description: 'Total energy production in kWh for the requested range.',
		type: 'number',
		format: 'float',
		example: 3.21,
	})
	@Expose({ name: 'total_production_kwh' })
	@IsNumber()
	totalProductionKwh: number;

	@ApiPropertyOptional({
		name: 'last_updated_at',
		description: 'Timestamp of the most recent delta record in ISO 8601 format.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2026-02-09T12:05:00Z',
	})
	@Expose({ name: 'last_updated_at' })
	@IsOptional()
	@IsString()
	lastUpdatedAt: string | null;
}
