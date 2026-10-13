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
