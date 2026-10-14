import { ConflictException } from '@nestjs/common';

import { ChannelEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceContributionRegistryService } from '../../../modules/devices/services/device-contribution.registry.service';

import { LightingContributionPlannerService } from './lighting-contribution-planner.service';

const channel = (id: string) => ({ channel: Object.assign(new ChannelEntity(), { id }) });
describe('room lighting leaf coverage', () => {
	const setup = (groups: Record<string, string[]>) => {
		const registry = new DeviceContributionRegistryService();
		registry.register({
			getCoverage: (target) =>
				Promise.resolve(
					groups[target.id]
						? {
								leaves: groups[target.id],
								reported: {
									total: groups[target.id].length,
									on: 0,
									unknown: 1,
									mixed: false,
									mixedProperties: [],
									properties: [],
								},
							}
						: null,
				),
		});
		return new LightingContributionPlannerService(registry);
	};
	it('uses one representative for its intended leaf channels, including missing members, without suppressing unrelated channels', async () => {
		const planner = setup({ group: ['a', 'missing'] });
		const plan = await planner.plan([channel('a'), channel('group'), channel('other')]);
		expect(plan.targets.map((target) => target.channel.id)).toEqual(['group', 'other']);
		expect(plan.excludedRawChannels).toEqual(['a']);
		expect(plan.coverage.get('group').leaves).toEqual(['a', 'missing']);
	});
	it('requires explicit room representative repair for overlapping groups rather than selecting by order', async () => {
		const planner = setup({ first: ['a', 'b'], second: ['b', 'c'] });
		for (const ids of [
			['first', 'second'],
			['second', 'first'],
		]) {
			await expect(planner.plan(ids.map(channel))).rejects.toBeInstanceOf(ConflictException);
		}
		await expect(planner.plan([channel('first'), channel('c')])).resolves.toMatchObject({ excludedRawChannels: [] });
	});
	it('invalidates a paused room selection when membership changes before raw leaf selection completes', async () => {
		const registry = new DeviceContributionRegistryService();
		let revision = 1;
		registry.register({
			getCoverage: async (target) => {
				if (target.id === 'group') {
					const captured = revision;
					return {
						leaves: ['a'],
						revision: captured,
						isCurrent: () => revision === captured,
						reported: { total: 1, on: 1, unknown: 0, mixed: false, mixedProperties: [], properties: [] },
					};
				}
				// A structural write adds b while this selection is awaiting metadata.
				await Promise.resolve();
				revision++;
				return null;
			},
		});
		const plan = await new LightingContributionPlannerService(registry).plan([channel('group'), channel('b')]);
		expect(plan.targets.map((target) => target.channel.id)).toEqual(['group', 'b']);
		expect(plan.isCurrent()).toBe(false);
	});
});
