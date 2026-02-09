import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { EnergyDeltaItemModel } from './energy-delta.model';
import { EnergySummaryModel } from './energy-summary.model';

@ApiSchema({
	name: 'EnergyModuleResEnergySummary',
	description: 'Response containing energy consumption and production summary.',
})
export class EnergySummaryResponseModel extends BaseSuccessResponseModel<EnergySummaryModel> {
	@ApiProperty({
		description: 'Energy summary data.',
		type: () => EnergySummaryModel,
	})
	@Expose()
	declare data: EnergySummaryModel;
}

@ApiSchema({
	name: 'EnergyModuleResEnergyDeltas',
	description: 'Response containing energy delta intervals.',
})
export class EnergyDeltasResponseModel extends BaseSuccessResponseModel<EnergyDeltaItemModel[]> {
	@ApiProperty({
		description: 'List of energy delta intervals.',
		type: 'array',
		items: { $ref: '#/components/schemas/EnergyModuleDataEnergyDeltaItem' },
	})
	@Expose()
	declare data: EnergyDeltaItemModel[];
}
