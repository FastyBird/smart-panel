import { describe, expect, it } from 'vitest';

import { normalizeHomeyUrlInput } from './homey-config-form.utils';

describe('normalizeHomeyUrlInput', () => {
	it('normalizes an empty input to the backend clear sentinel', () => {
		expect(normalizeHomeyUrlInput('')).toBeNull();
		expect(normalizeHomeyUrlInput('   ')).toBeNull();
	});

	it('preserves a configured local URL', () => {
		expect(normalizeHomeyUrlInput('http://homey.local:4859')).toBe('http://homey.local:4859');
	});
});
