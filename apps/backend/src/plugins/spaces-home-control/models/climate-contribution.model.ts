import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SpacesModuleDataClimateContributionConflict' })
export class ClimateContributionConflictModel {
	@ApiProperty({ name: 'leaf_property_id', type: String })
	@Expose({ name: 'leaf_property_id' })
	leafPropertyId: string;

	@ApiProperty({ name: 'representative_property_ids', type: [String] })
	@Expose({ name: 'representative_property_ids' })
	representativePropertyIds: string[];
}

@ApiSchema({ name: 'SpacesModuleDataClimateContribution' })
export class ClimateContributionModel {
	@ApiProperty({
		enum: ['ok', 'coverage_conflict', 'coverage_stale'],
		description:
			'Conflicting coverage requires selecting one representative through climate participation roles. Stale coverage requires recalculation. Both withhold the room temperature.',
	})
	@Expose()
	status: 'ok' | 'coverage_conflict' | 'coverage_stale';

	@ApiProperty({ name: 'selected_property_ids', type: [String] })
	@Expose({ name: 'selected_property_ids' })
	selectedPropertyIds: string[];

	@ApiProperty({ name: 'excluded_property_ids', type: [String] })
	@Expose({ name: 'excluded_property_ids' })
	excludedPropertyIds: string[];

	@ApiProperty({ name: 'unavailable_property_ids', type: [String] })
	@Expose({ name: 'unavailable_property_ids' })
	unavailablePropertyIds: string[];

	@ApiProperty({ type: () => [ClimateContributionConflictModel] })
	@Expose()
	@Type(() => ClimateContributionConflictModel)
	conflicts: ClimateContributionConflictModel[];
}
