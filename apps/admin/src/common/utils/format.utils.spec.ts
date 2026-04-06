import { describe, expect, it } from 'vitest';

import { formatPercent } from './format.utils';

describe('formatPercent', () => {
	it('returns dash for null', () => {
		expect(formatPercent(null)).toBe('—');
	});

	it('returns dash for undefined', () => {
		expect(formatPercent(undefined)).toBe('—');
	});

	it('formats percentage with default fraction digits', () => {
		const result = formatPercent(45.678, 2, 'comma_dot');

		expect(result).toBe('45.68%');
	});

	it('formats percentage with dot_comma format', () => {
		const result = formatPercent(45.678, 2, 'dot_comma');

		expect(result).toBe('45,68%');
	});

	it('formats percentage with custom fraction digits', () => {
		const result = formatPercent(99.1, 0, 'comma_dot');

		expect(result).toBe('99%');
	});

	it('formats zero percent', () => {
		const result = formatPercent(0, 2, 'comma_dot');

		expect(result).toBe('0%');
	});
});
