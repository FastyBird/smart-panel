import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import {
	DeviceContributionRegistryService,
	MeasurementContributionCoverage,
} from '../../../modules/devices/services/device-contribution.registry.service';

import { ClimateContributionPlannerService } from './climate-contribution-planner.service';

const property = (id: string, value: unknown = 20) =>
	Object.assign(new ChannelPropertyEntity(), { id, value: new PropertyValueState(value as number) });

describe('room climate contribution planning', () => {
	const setup = (entries: Record<string, Partial<MeasurementContributionCoverage>>) => {
		const registry = new DeviceContributionRegistryService();
		registry.registerMeasurement({
			getMeasurementCoverage: (target) =>
				Promise.resolve(
					entries[target.id]
						? ({
								representedProperties: [],
								isCurrent: () => true,
								readValue: () => 25,
								...entries[target.id],
							} as MeasurementContributionCoverage)
						: null,
				),
		});
		return new ClimateContributionPlannerService(registry);
	};

	it('selects an aggregate once and excludes raw and transformed sources across roles', async () => {
		const planner = setup({
			transform: { leaves: ['raw'] },
			aggregate: { leaves: ['raw', 'other'], representedProperties: ['transform', 'other'] },
		});
		const result = (
			await planner.plan([property('raw', 10), property('transform'), property('aggregate'), property('outside', 35)])
		).read();
		expect(result.temperature).toBe(30);
		expect(result.diagnostics).toMatchObject({
			status: 'ok',
			selectedPropertyIds: ['aggregate', 'outside'],
			excludedPropertyIds: ['raw', 'transform'],
		});
	});

	it('reports overlapping composites without falling back to raw values, independent of order', async () => {
		const planner = setup({ first: { leaves: ['a', 'b'] }, second: { leaves: ['b', 'c'] } });
		for (const ids of [
			['a', 'first', 'second'],
			['second', 'first', 'a'],
		]) {
			const result = (await planner.plan(ids.map((id) => property(id)))).read();
			expect(result.temperature).toBeNull();
			expect(result.diagnostics.status).toBe('coverage_conflict');
			expect(result.diagnostics.conflicts).toEqual([
				{ leafPropertyId: 'b', representativePropertyIds: ['first', 'second'] },
			]);
		}
		expect((await planner.plan([property('first'), property('c')])).read().diagnostics.status).toBe('ok');
	});

	it('reports distinct transforms of the same physical input and duplicate leaves within a composite', async () => {
		const planner = setup({
			first: { leaves: ['raw'] },
			second: { leaves: ['raw'] },
			aggregate: { leaves: ['raw'], duplicateLeaves: ['raw'] },
		});
		expect((await planner.plan([property('first'), property('second')])).read().diagnostics.status).toBe(
			'coverage_conflict',
		);
		expect((await planner.plan([property('aggregate')])).read().diagnostics.status).toBe('coverage_conflict');
	});

	it('keeps unavailable aggregate coverage and never resurrects its physical raw average', async () => {
		const planner = setup({ aggregate: { leaves: ['a', 'b'], readValue: () => null } });
		const result = (await planner.plan([property('a', 10), property('b', 30), property('aggregate', 99)])).read();
		expect(result.temperature).toBeNull();
		expect(result.diagnostics).toMatchObject({
			status: 'ok',
			excludedPropertyIds: ['a', 'b'],
			unavailablePropertyIds: ['aggregate'],
		});
	});

	it('rechecks captured coverage after a paused state read and withholds even unrelated raw averages', async () => {
		let current = true;
		const planner = setup({ aggregate: { leaves: ['a'], isCurrent: () => current } });
		const plan = await planner.plan([property('a'), property('aggregate'), property('outside')]);
		current = false;
		expect(plan.read()).toMatchObject({ temperature: null, diagnostics: { status: 'coverage_stale' } });
	});

	it('marks diagnostics stale when reading a producer synchronously invalidates captured coverage', async () => {
		let current = true;
		const planner = setup({
			aggregate: {
				leaves: ['a'],
				isCurrent: () => current,
				readValue: () => {
					current = false;
					return 25;
				},
			},
		});
		expect((await planner.plan([property('a'), property('aggregate')])).read()).toMatchObject({
			temperature: null,
			diagnostics: { status: 'coverage_stale' },
		});
	});

	it('withholds room temperature when a virtual provider is missing instead of treating cached derived values as physical', async () => {
		const virtual = { id: 'derived', type: 'virtual', value: new PropertyValueState(99) } as ChannelPropertyEntity;
		const result = (await setup({}).plan([property('raw', 20), virtual])).read();
		expect(result).toMatchObject({
			temperature: null,
			diagnostics: { status: 'coverage_stale', unavailablePropertyIds: ['derived'] },
		});
	});

	it('rejects non-finite, malformed, unavailable and expired cached values while preserving ordinary numeric readings', async () => {
		const unavailable = property('unavailable');
		unavailable.value.producer = { quality: 'unavailable' } as never;
		const expired = property('expired');
		expired.value.producer = { quality: 'good', expiresAt: new Date(Date.now() - 1).toISOString() } as never;
		const result = (
			await setup({}).plan([
				property('nan', NaN),
				property('infinity', Infinity),
				property('malformed', '20bad'),
				unavailable,
				expired,
				property('numeric', '21.5'),
			])
		).read();
		expect(result.temperature).toBe(21.5);
		expect(result.diagnostics.unavailablePropertyIds).toEqual([
			'nan',
			'infinity',
			'malformed',
			'unavailable',
			'expired',
		]);
	});
});
