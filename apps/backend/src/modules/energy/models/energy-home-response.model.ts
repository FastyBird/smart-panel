import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { EnergyBreakdownItemModel } from './energy-breakdown-item.model';
import { EnergySpaceSummaryModel } from './energy-space-summary.model';
import { EnergyTimeseriesPointModel } from './energy-timeseries-point.model';

@ApiSchema({
	name: 'EnergyModuleResHomeSummary',
	description: 'Response containing whole-home energy summary.',
})
export class EnergyHomeSummaryResponseModel extends BaseSuccessResponseModel<EnergySpaceSummaryModel> {
	@ApiProperty({
		description: 'Home energy summary data.',
		type: () => EnergySpaceSummaryModel,
	})
	@Expose()
	declare data: EnergySpaceSummaryModel;
}

@ApiSchema({
	name: 'EnergyModuleResHomeTimeseries',
	description: 'Response containing whole-home energy time-series.',
})
export class EnergyHomeTimeseriesResponseModel extends BaseSuccessResponseModel<EnergyTimeseriesPointModel[]> {
	@ApiProperty({
		description: 'List of time-series data points.',
		type: 'array',
		items: { $ref: '#/components/schemas/EnergyModuleDataTimeseriesPoint' },
	})
	@Expose()
	declare data: EnergyTimeseriesPointModel[];
}

@ApiSchema({
	name: 'EnergyModuleResHomeBreakdown',
	description: 'Response containing whole-home energy breakdown by device.',
})
export class EnergyHomeBreakdownResponseModel extends BaseSuccessResponseModel<EnergyBreakdownItemModel[]> {
	@ApiProperty({
		description: 'List of devices sorted by consumption descending.',
		type: 'array',
		items: { $ref: '#/components/schemas/EnergyModuleDataBreakdownItem' },
	})
	@Expose()
	declare data: EnergyBreakdownItemModel[];
}
