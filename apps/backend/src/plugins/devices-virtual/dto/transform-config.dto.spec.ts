import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { ConfigureVirtualTransformDto } from './transform-config.dto';

const payload = () => ({
	schema_version: 1,
	expected_revision: 0,
	maximum_age_seconds: 10,
	quantity: 'temperature',
	unit: '°C',
	source: { source_property: uuid() },
	policy: {
		operator: 'affine',
		inputRange: { minimum: 0, maximum: 100 },
		outputRange: { minimum: -100, maximum: 100 },
		scale: 1,
		offset: 0,
	},
});

describe('versioned numeric transform authoring DTO', () => {
	it('accepts the explicit affine policy and transforms revision/source field names', async () => {
		const dto = plainToInstance(ConfigureVirtualTransformDto, payload());
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.schemaVersion).toBe(1);
		expect(dto.source.sourcePropertyId).toEqual(expect.any(String));
	});
	it('accepts a complete bounded Steinhart-Hart policy and rejects omitted coefficients', async () => {
		const policy = {
			operator: 'steinhart_hart',
			inputRange: { minimum: 0, maximum: 10 },
			outputRange: { minimum: -100, maximum: 150 },
			referenceVoltage: 10,
			seriesResistance: 10_000,
			coefficientA: 0.0010351024725298568,
			coefficientB: 0.0002338353574079741,
			coefficientC: 7.917851073336009e-8,
			thermistorLeg: 'low',
		};
		expect(await validate(plainToInstance(ConfigureVirtualTransformDto, { ...payload(), policy }))).toHaveLength(0);
		const incomplete: Record<string, unknown> = { ...policy };
		delete incomplete.coefficientC;
		expect(
			await validate(plainToInstance(ConfigureVirtualTransformDto, { ...payload(), policy: incomplete })),
		).not.toHaveLength(0);
	});

	it.each([
		{ schema_version: 2 },
		{ quantity: 'voltage\n' },
		{ quantity: '<temperature>' },
		{ unit: '<script>' },
		{ unit: 'mV\u0000' },
		{ maximum_age_seconds: 0 },
		{ expected_revision: -1 },
		{ policy: { ...payload().policy, scale: undefined } },
		{ policy: { ...payload().policy, scale: Infinity } },
		{ policy: { ...payload().policy, inputRange: { minimum: 10, maximum: 1 } } },
		{ policy: { ...payload().policy, operator: 'javascript' } },
		{ policy: { ...payload().policy, beta: 3950 } },
	])('rejects invalid version, age or operator parameters: %j', async (override) => {
		const dto = plainToInstance(ConfigureVirtualTransformDto, { ...payload(), ...override });
		expect((await validate(dto)).length).toBeGreaterThan(0);
	});
});
