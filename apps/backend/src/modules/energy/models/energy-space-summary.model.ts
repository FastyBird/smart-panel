import { Expose } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'EnergyModuleDataSpaceSummary' })
export class EnergySpaceSummaryModel {
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

	@ApiProperty({
		name: 'total_grid_import_kwh',
		description: 'Total energy imported from the public grid in kWh. 0 if no grid metrics.',
		type: 'number',
		format: 'float',
		example: 8.5,
	})
	@Expose({ name: 'total_grid_import_kwh' })
	@IsNumber()
	totalGridImportKwh: number;

	@ApiProperty({
		name: 'total_grid_export_kwh',
		description: 'Total energy exported to the public grid in kWh. 0 if no grid metrics.',
		type: 'number',
		format: 'float',
		example: 1.2,
	})
	@Expose({ name: 'total_grid_export_kwh' })
	@IsNumber()
	totalGridExportKwh: number;

	@ApiProperty({
		name: 'net_kwh',
		description: 'Net energy in kWh (consumption - production). Positive means net consumption.',
		type: 'number',
		format: 'float',
		example: 9.24,
	})
	@Expose({ name: 'net_kwh' })
	@IsNumber()
	netKwh: number;

	@ApiProperty({
		name: 'net_grid_kwh',
		description:
			'Net grid energy in kWh (grid_import - grid_export). Positive means net import from grid. 0 if no grid metrics.',
		type: 'number',
		format: 'float',
		example: 7.3,
	})
	@Expose({ name: 'net_grid_kwh' })
	@IsNumber()
	netGridKwh: number;

	@ApiProperty({
		name: 'has_grid_metrics',
		description: 'Whether grid import/export metrics are available. When false, grid values are 0.',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_grid_metrics' })
	@IsBoolean()
	hasGridMetrics: boolean;

	@ApiProperty({
		description: 'The requested time range.',
		type: 'string',
		enum: ['today', 'yesterday', 'week', 'month'],
		example: 'today',
	})
	@Expose()
	@IsString()
	range: string;

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

	@ApiPropertyOptional({
		name: 'previous_consumption_kwh',
		description: 'Total consumption in kWh for the previous equivalent period. Null if no previous data.',
		type: 'number',
		format: 'float',
		nullable: true,
		example: 11.2,
	})
	@Expose({ name: 'previous_consumption_kwh' })
	@IsOptional()
	@IsNumber()
	previousConsumptionKwh: number | null;

	@ApiPropertyOptional({
		name: 'consumption_change_percent',
		description:
			'Percentage change in consumption vs previous period. Positive = increase, negative = decrease. Null if no previous data.',
		type: 'number',
		format: 'float',
		nullable: true,
		example: 8.5,
	})
	@Expose({ name: 'consumption_change_percent' })
	@IsOptional()
	@IsNumber()
	consumptionChangePercent: number | null;

	@ApiPropertyOptional({
		name: 'previous_production_kwh',
		description: 'Total production in kWh for the previous equivalent period. Null if no previous data.',
		type: 'number',
		format: 'float',
		nullable: true,
		example: 2.8,
	})
	@Expose({ name: 'previous_production_kwh' })
	@IsOptional()
	@IsNumber()
	previousProductionKwh: number | null;

	@ApiPropertyOptional({
		name: 'production_change_percent',
		description:
			'Percentage change in production vs previous period. Positive = increase, negative = decrease. Null if no previous data.',
		type: 'number',
		format: 'float',
		nullable: true,
		example: -5.2,
	})
	@Expose({ name: 'production_change_percent' })
	@IsOptional()
	@IsNumber()
	productionChangePercent: number | null;
}
