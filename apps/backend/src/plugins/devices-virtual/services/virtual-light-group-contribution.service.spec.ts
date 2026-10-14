import { PropertyCategory } from '../../../modules/devices/devices.constants';

import { VirtualLightGroupContributionService } from './virtual-light-group-contribution.service';
import { reportLightGroup } from './virtual-light-group.utils';

describe('virtual light group room contribution', () => {
	const group = { id: 'group', type: 'virtual' } as never;
	const config = {
		revision: 2,
		graph_revision: 3,
		members: [{ source_identity: 'on' }, { source_identity: 'off' }],
		reported_state: { on_count: 1, unknown_count: 0, mixed: true, properties: [] },
	};
	const states = { getReportedState: jest.fn() };
	const service = new VirtualLightGroupContributionService(
		{} as never,
		{ getLightGroup: jest.fn().mockResolvedValue(config) } as never,
		{ isRevisionCurrent: jest.fn().mockReturnValue(true) } as never,
		{ getGeneration: jest.fn().mockReturnValue(1) } as never,
		states as never,
	);

	it('omits ON brightness when no qualified member has a brightness sample', async () => {
		states.getReportedState.mockReturnValue({ properties: new Map([[PropertyCategory.BRIGHTNESS, { samples: [] }]]) });
		const coverage = await service.getCoverage(group);
		expect(coverage?.reported.onBrightness).toBeUndefined();
		expect(coverage?.reported).toMatchObject({ total: 2, on: 1, unknown: 0 });
	});

	it('keeps the native sum and count of qualified ON samples', async () => {
		states.getReportedState.mockReturnValue(
			reportLightGroup([
				{
					identity: 'on',
					samples: new Map([
						[PropertyCategory.ON, { value: true } as never],
						[PropertyCategory.BRIGHTNESS, { value: 80 } as never],
					]),
				},
				{
					identity: 'off',
					samples: new Map([
						[PropertyCategory.ON, { value: false } as never],
						[PropertyCategory.BRIGHTNESS, { value: 20 } as never],
					]),
				},
			]),
		);
		const coverage = await service.getCoverage(group);
		expect(coverage?.reported.onBrightness).toEqual({ sum: 80, count: 1 });
	});
});
