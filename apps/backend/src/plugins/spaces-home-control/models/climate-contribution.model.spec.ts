import { instanceToPlain } from 'class-transformer';

import { ClimateStateDataModel } from './spaces-response.model';

describe('climate contribution wire contract', () => {
	it('serializes nested diagnostics and conflict identities with snake_case field names', () => {
		const state = Object.assign(new ClimateStateDataModel(), {
			temperatureContribution: {
				status: 'coverage_conflict',
				selectedPropertyIds: ['first', 'second'],
				excludedPropertyIds: ['raw'],
				unavailablePropertyIds: [],
				conflicts: [{ leafPropertyId: 'physical', representativePropertyIds: ['first', 'second'] }],
			},
		});
		expect(instanceToPlain(state)).toMatchObject({
			temperature_contribution: {
				status: 'coverage_conflict',
				selected_property_ids: ['first', 'second'],
				excluded_property_ids: ['raw'],
				unavailable_property_ids: [],
				conflicts: [{ leaf_property_id: 'physical', representative_property_ids: ['first', 'second'] }],
			},
		});
	});
});
