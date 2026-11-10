import { describe, expect, it } from 'vitest';

import { CUSTOM_CAPABILITIES } from './capabilities';

describe('CUSTOM_CAPABILITIES', () => {
	it('lists the three custom capabilities with their access', () => {
		expect(CUSTOM_CAPABILITIES.map((c) => [c.key, c.readable, c.writable, c.dataType])).toEqual([
			['binary_input.state', true, false, 'bool'],
			['switcher.on', true, true, 'bool'],
			['outlet.on', true, true, 'bool'],
		]);
	});

	it('has unique keys that match channel and property category', () => {
		for (const c of CUSTOM_CAPABILITIES) {
			expect(c.key).toBe(`${c.channelCategory}.${c.propertyCategory}`);
		}
		expect(new Set(CUSTOM_CAPABILITIES.map((c) => c.key)).size).toBe(CUSTOM_CAPABILITIES.length);
	});
});
