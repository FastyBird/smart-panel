import { Expose } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'EnergyModuleDataEnergyDeltaItem' })
export class EnergyDeltaItemModel {
	@ApiProperty({
		name: 'interval_start',
		description: 'Start of the time interval in ISO 8601 format.',
		type: 'string',
		format: 'date-time',
		example: '2026-02-09T12:00:00Z',
	})
	@Expose({ name: 'interval_start' })
	@IsString()
	intervalStart: string;

	@ApiProperty({
		name: 'interval_end',
		description: 'End of the time interval in ISO 8601 format.',
		type: 'string',
		format: 'date-time',
		example: '2026-02-09T12:05:00Z',
	})
	@Expose({ name: 'interval_end' })
	@IsString()
	intervalEnd: string;

	@ApiProperty({
		name: 'consumption_delta_kwh',
		description: 'Energy consumption delta for this interval in kWh.',
		type: 'number',
		format: 'float',
		example: 0.125,
	})
	@Expose({ name: 'consumption_delta_kwh' })
	@IsNumber()
	consumptionDeltaKwh: number;

	@ApiProperty({
		name: 'production_delta_kwh',
		description: 'Energy production delta for this interval in kWh.',
		type: 'number',
		format: 'float',
		example: 0.05,
	})
	@Expose({ name: 'production_delta_kwh' })
	@IsNumber()
	productionDeltaKwh: number;

	@ApiProperty({
		name: 'grid_import_delta_kwh',
		description: 'Grid import energy delta for this interval in kWh. 0 if no grid metrics.',
		type: 'number',
		format: 'float',
		example: 0.1,
	})
	@Expose({ name: 'grid_import_delta_kwh' })
	@IsNumber()
	gridImportDeltaKwh: number;

	@ApiProperty({
		name: 'grid_export_delta_kwh',
		description: 'Grid export energy delta for this interval in kWh. 0 if no grid metrics.',
		type: 'number',
		format: 'float',
		example: 0.02,
	})
	@Expose({ name: 'grid_export_delta_kwh' })
	@IsNumber()
	gridExportDeltaKwh: number;
}
