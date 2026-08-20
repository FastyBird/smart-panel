import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';

import { HomeyMappingValueError } from './homey-mapping.error';
import { HomeyMappingTransformerService } from './mapping-transformer.service';
import { HomeyTransformDefinition, ResolvedHomeyPropertyMapping } from './mapping.types';

const mapping = (
	transform: HomeyTransformDefinition | undefined,
	overrides: Partial<ResolvedHomeyPropertyMapping['property']> = {},
): ResolvedHomeyPropertyMapping => ({
	kind: 'properties',
	source: 'builtin',
	name: 'test-mapping',
	priority: 100,
	exclusive: false,
	conflict: 'error',
	match: {
		classes: ['sensor'],
		capabilityBaseIds: ['test'],
		allCapabilities: [],
		noneCapabilities: [],
		driverIds: [],
		manufacturers: [],
		models: [],
	},
	property: {
		channel: 'test',
		category: PropertyCategory.GENERIC,
		dataType: DataTypeType.FLOAT,
		direction: 'bidirectional',
		transform,
		...overrides,
	},
});

describe('HomeyMappingTransformerService', () => {
	const service = new HomeyMappingTransformerService();

	it('scales and clamps reads while applying the exact inverse on writes', () => {
		const definition = mapping(
			{ type: 'scale', input_range: [0, 1], output_range: [0, 100], clamp: true },
			{ dataType: DataTypeType.UCHAR },
		);

		expect(service.read(definition, 0.245)).toBe(25);
		expect(service.read(definition, 2)).toBe(100);
		expect(service.write(definition, 25)).toBe(0.25);
		expect(service.write(definition, 200)).toBe(1);
	});

	it('supports descending ranges without losing inverse precision', () => {
		const definition = mapping(
			{ type: 'scale', input_range: [0, 1], output_range: [6500, 2000], clamp: true },
			{ dataType: DataTypeType.USHORT },
		);

		expect(service.read(definition, 0.5)).toBe(4250);
		expect(service.write(definition, 4250)).toBe(0.5);
	});

	it('uses explicit direction-specific maps and rejects unknown values', () => {
		const definition = mapping(
			{
				type: 'map',
				read: { up: 'opening', idle: 'stopped' },
				write: { opening: 'up', stopped: 'idle' },
			},
			{ dataType: DataTypeType.ENUM },
		);

		expect(service.read(definition, 'up')).toBe('opening');
		expect(service.write(definition, 'stopped')).toBe('idle');
		expect(() => service.read(definition, 'down')).toThrow(HomeyMappingValueError);
		expect(() => service.write(definition, 'closed')).toThrow(HomeyMappingValueError);
	});

	it('converts only declared boolean representations', () => {
		const definition = mapping(
			{ type: 'boolean', true_value: 'enabled', false_value: 'disabled', invert: true },
			{ dataType: DataTypeType.BOOL },
		);

		expect(service.read(definition, 'enabled')).toBe(false);
		expect(service.write(definition, false)).toBe('enabled');
		expect(() => service.read(definition, 'unknown')).toThrow(HomeyMappingValueError);
	});

	it('supports clamp and round transforms and preserves null', () => {
		expect(service.read(mapping({ type: 'clamp', minimum: 0, maximum: 10 }), 12)).toBe(10);
		expect(service.read(mapping({ type: 'round', precision: 2 }), 1.236)).toBe(1.24);
		expect(service.read(mapping({ type: 'round', precision: 2 }), null)).toBeNull();
	});

	it('emits constants even when the source capability value is null', () => {
		const definition = mapping(
			{ type: 'constant', value: 'roller' },
			{ dataType: DataTypeType.ENUM, direction: 'read_only' },
		);

		expect(service.read(definition, null)).toBe('roller');
	});

	it('derives values on both sides of an inclusive numeric threshold', () => {
		const definition = mapping(
			{ type: 'threshold', threshold: 20, less_than_or_equal: 'low', greater_than: 'ok' },
			{ dataType: DataTypeType.ENUM, direction: 'read_only' },
		);

		expect(service.read(definition, 0)).toBe('low');
		expect(service.read(definition, 20)).toBe('low');
		expect(service.read(definition, 21)).toBe('ok');
	});

	it('derives an ordered band value with a below-minimum default', () => {
		const definition = mapping(
			{
				type: 'thresholds',
				thresholds: [
					{ minimum: 1000, value: 'bright' },
					{ minimum: 100, value: 'moderate' },
					{ minimum: 10, value: 'dusky' },
				],
				default: 'dark',
			},
			{ dataType: DataTypeType.ENUM, direction: 'read_only' },
		);

		expect(service.read(definition, 1000)).toBe('bright');
		expect(service.read(definition, 999)).toBe('moderate');
		expect(service.read(definition, 10)).toBe('dusky');
		expect(service.read(definition, 9)).toBe('dark');
	});

	it('fails closed for forbidden directions and incompatible panel values', () => {
		const readOnly = mapping(undefined, { dataType: DataTypeType.BOOL, direction: 'read_only' });

		expect(() => service.write(readOnly, true)).toThrow(HomeyMappingValueError);
		expect(() => service.read(readOnly, 'true')).toThrow(HomeyMappingValueError);
	});

	it('never includes the rejected value in transformation errors', () => {
		const secretLikeSentinel = 'secret-sentinel-value';
		const definition = mapping(
			{ type: 'map', read: { known: 'mapped' }, write: { mapped: 'known' } },
			{
				dataType: DataTypeType.ENUM,
			},
		);

		try {
			service.read(definition, secretLikeSentinel);
			throw new Error('Expected the unknown value to fail');
		} catch (error) {
			expect(error).toBeInstanceOf(HomeyMappingValueError);
			expect((error as Error).message).not.toContain(secretLikeSentinel);
		}
	});
});
