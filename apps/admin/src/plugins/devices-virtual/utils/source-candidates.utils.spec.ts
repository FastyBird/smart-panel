import { describe, expect, it } from 'vitest';

import { isVirtualSourceDeviceCandidate, isVirtualSourcePropertyCandidate } from './source-candidates.utils';

describe('virtual measurement candidates', () => {
	const device = { type: 'virtual', mode: 'sensor_aggregate' };
	const channel = { category: 'temperature' };
	const measurement = { category: 'temperature', dataType: 'float', permissions: ['ro'], valueOrigin: 'derived', sourceProperty: null };

	it('offers physical properties and materialized aggregate temperature measurements', () => {
		expect(isVirtualSourceDeviceCandidate({ type: 'shelly-ng' })).toBe(true);
		expect(isVirtualSourcePropertyCandidate({ type: 'shelly-ng' }, channel, measurement)).toBe(true);
		expect(isVirtualSourceDeviceCandidate(device)).toBe(true);
		expect(isVirtualSourcePropertyCandidate(device, channel, measurement)).toBe(true);
	});

	it('rejects alias chains, controls, other virtual modes and incompatible measurements', () => {
		expect(isVirtualSourceDeviceCandidate({ type: 'virtual' })).toBe(false);
		for (const override of [{ valueOrigin: 'source' }, { sourceProperty: 'source' }, { permissions: ['rw'] }, { dataType: 'int' }]) {
			expect(isVirtualSourcePropertyCandidate(device, channel, { ...measurement, ...override })).toBe(false);
		}
		expect(isVirtualSourcePropertyCandidate({ type: 'virtual', mode: 'actuator_group' }, channel, measurement)).toBe(false);
	});
});
