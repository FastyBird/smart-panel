import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { EnergyBreakdownItemModel } from './energy-breakdown-item.model';
import { EnergySpaceSummaryModel } from './energy-space-summary.model';
import { EnergyTimeseriesPointModel } from './energy-timeseries-point.model';

@ApiSchema({
	name: 'EnergyModuleResSpaceSummary',
	description: 'Response containing energy summary for a space.',
})
export class EnergySpaceSummaryResponseModel extends BaseSuccessResponseModel<EnergySpaceSummaryModel> {
	@ApiProperty({
		description: 'Space energy summary data.',
		type: () => EnergySpaceSummaryModel,
	})
	@Expose()
	declare data: EnergySpaceSummaryModel;
}

@ApiSchema({
	name: 'EnergyModuleResSpaceTimeseries',
	description: 'Response containing energy time-series for a space.',
})
export class EnergySpaceTimeseriesResponseModel extends BaseSuccessResponseModel<EnergyTimeseriesPointModel[]> {
	@ApiProperty({
		description: 'List of time-series data points.',
		type: 'array',
		items: { $ref: '#/components/schemas/EnergyModuleDataTimeseriesPoint' },
	})
	@Expose()
	declare data: EnergyTimeseriesPointModel[];
}

@ApiSchema({
	name: 'EnergyModuleResSpaceBreakdown',
	description: 'Response containing energy breakdown by device for a space.',
})
export class EnergySpaceBreakdownResponseModel extends BaseSuccessResponseModel<EnergyBreakdownItemModel[]> {
	@ApiProperty({
		description: 'List of devices sorted by consumption descending.',
		type: 'array',
		items: { $ref: '#/components/schemas/EnergyModuleDataBreakdownItem' },
	})
	@Expose()
	declare data: EnergyBreakdownItemModel[];
}
