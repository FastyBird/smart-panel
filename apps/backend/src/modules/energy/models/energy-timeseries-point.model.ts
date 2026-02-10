import { Expose } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'EnergyModuleDataTimeseriesPoint' })
export class EnergyTimeseriesPointModel {
	@ApiProperty({
		name: 'interval_start',
		description: 'Start of the time interval in ISO 8601 format.',
		type: 'string',
		format: 'date-time',
		example: '2026-02-09T12:00:00.000Z',
	})
	@Expose({ name: 'interval_start' })
	@IsString()
	intervalStart: string;

	@ApiProperty({
		name: 'interval_end',
		description: 'End of the time interval in ISO 8601 format.',
		type: 'string',
		format: 'date-time',
		example: '2026-02-09T13:00:00.000Z',
	})
	@Expose({ name: 'interval_end' })
	@IsString()
	intervalEnd: string;

	@ApiProperty({
		name: 'consumption_delta_kwh',
		description: 'Energy consumption delta for this interval in kWh.',
		type: 'number',
		format: 'float',
		example: 0.75,
	})
	@Expose({ name: 'consumption_delta_kwh' })
	@IsNumber()
	consumptionDeltaKwh: number;

	@ApiProperty({
		name: 'production_delta_kwh',
		description: 'Energy production delta for this interval in kWh.',
		type: 'number',
		format: 'float',
		example: 0.25,
	})
	@Expose({ name: 'production_delta_kwh' })
	@IsNumber()
	productionDeltaKwh: number;
}
