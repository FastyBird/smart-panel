import {
	HomeyCapability,
	HomeyCapabilityType,
	HomeyCapabilityValue,
	createHomeyCapability,
} from '../models/homey-capability.model';

import { homeyCapabilityValuesEqual, validateHomeyCapabilityCommandValue } from './homey-command-value';

const capability = createHomeyCapability({
	id: 'dim.main',
	title: 'Dim',
	value: 0.5,
	type: HomeyCapabilityType.NUMBER,
	unit: null,
	minimum: 0,
	maximum: 1,
	step: 0.1,
	enumValues: [],
	readable: true,
	writable: true,
	available: true,
	lastUpdatedAt: null,
});

describe('Homey command value validation', () => {
	it('accepts writable values on the Homey number range and step grid', () => {
		expect(validateHomeyCapabilityCommandValue(capability, 0.3)).toEqual({ valid: true });
	});

	it.each<readonly [string, HomeyCapability, HomeyCapabilityValue]>([
		['read-only capability', { ...capability, writable: false }, 0.3],
		['unavailable capability', { ...capability, available: false }, 0.3],
		['null value', capability, null],
		['wrong type', capability, '0.3'],
		['below minimum', capability, -0.1],
		['above maximum', capability, 1.1],
		['off-step value', capability, 0.35],
	])('rejects a %s', (_label, candidate, value) => {
		expect(validateHomeyCapabilityCommandValue(candidate, value).valid).toBe(false);
	});

	it('validates enums by their authoritative Homey IDs', () => {
		const enumeration = {
			...capability,
			type: HomeyCapabilityType.ENUM,
			enumValues: [
				{ id: 'heat', title: 'Heat' },
				{ id: 'cool', title: 'Cool' },
			],
		};

		expect(validateHomeyCapabilityCommandValue(enumeration, 'heat').valid).toBe(true);
		expect(validateHomeyCapabilityCommandValue(enumeration, 'auto').valid).toBe(false);
	});

	it('uses a narrow tolerance only for equivalent floating-point values', () => {
		expect(homeyCapabilityValuesEqual(0.3, 0.1 + 0.2)).toBe(true);
		expect(homeyCapabilityValuesEqual(0.3, 0.31)).toBe(false);
		expect(homeyCapabilityValuesEqual('1', 1)).toBe(false);
	});
});
