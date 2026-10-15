import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { ConfigureVirtualAggregateDto } from './producer-config.dto';

const payload = () => ({
	expected_revision: 0,
	operator: 'mean',
	minimum_valid_inputs: 2,
	maximum_age_seconds: 30,
	inputs: [{ source_property: uuid() }, { source_property: uuid() }],
});

describe('aggregate policy request contract', () => {
	it('accepts legacy requests without weights or filtering', async () => {
		const dto = plainToInstance(ConfigureVirtualAggregateDto, payload());
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.outlierFilter).toBeUndefined();
		expect(dto.inputs[0].weight).toBeUndefined();
	});
	it('transforms nested weighted/filter policy and accepts inclusive boundaries', async () => {
		const old = payload();
		const dto = plainToInstance(ConfigureVirtualAggregateDto, {
			...old,
			operator: 'weighted_mean',
			inputs: old.inputs.map((input, index) => ({ ...input, weight: index ? 1000000 : 0.000001 })),
			outlier_filter: { kind: 'absolute_deviation_from_median', threshold: 2 },
		});
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.outlierFilter).toMatchObject({ kind: 'absolute_deviation_from_median', threshold: 2 });
		expect(dto.inputs[0].sourcePropertyId).toBe(old.inputs[0].source_property);
	});
	it.each([Number.MIN_VALUE, 0.000001, 1])('accepts strictly positive filter threshold %s', async (threshold) => {
		const dto = plainToInstance(ConfigureVirtualAggregateDto, {
			...payload(),
			outlier_filter: { kind: 'absolute_deviation_from_median', threshold },
		});
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.outlierFilter.threshold).toBe(threshold);
	});

	it.each([0, -1, NaN, Infinity, 0.000000999, 1000001, '1'])('rejects invalid request weight %s', async (weight) => {
		const old = payload();
		const dto = plainToInstance(ConfigureVirtualAggregateDto, {
			...old,
			inputs: old.inputs.map((input) => ({ ...input, weight })),
		});
		expect(await validate(dto)).not.toHaveLength(0);
	});
	it.each([
		{ kind: 'absolute_deviation_from_median', threshold: 0 },
		{ kind: 'absolute_deviation_from_median', threshold: -1 },
		{ kind: 'absolute_deviation_from_median', threshold: Infinity },
		{ kind: 'absolute_deviation_from_median', threshold: NaN },
		{ kind: 'absolute_deviation_from_median' },
		{ kind: 'implicit', threshold: 2 },
	])('rejects invalid explicit filter %j', async (outlier_filter) => {
		expect(
			await validate(plainToInstance(ConfigureVirtualAggregateDto, { ...payload(), outlier_filter })),
		).not.toHaveLength(0);
	});
});
