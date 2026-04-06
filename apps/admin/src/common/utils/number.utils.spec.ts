import { describe, expect, it } from 'vitest';

import { formatNumber } from './number.utils';

describe('formatNumber', () => {
	it('formats with comma_dot (en-US style)', () => {
		const result = formatNumber(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'comma_dot');

		expect(result).toBe('1,234.56');
	});

	it('formats with dot_comma (de-DE style)', () => {
		const result = formatNumber(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'dot_comma');

		expect(result).toBe('1.234,56');
	});

	it('formats with space_comma (fr-FR style)', () => {
		const result = formatNumber(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'space_comma');

		// French locale uses narrow no-break space (U+202F) as thousands separator
		const formatted = result.replace(/\s/g, ' ');

		expect(formatted).toBe('1 234,56');
	});

	it('formats with none (no grouping)', () => {
		const result = formatNumber(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'none');

		expect(result).toBe('1234.56');
	});

	it('respects maximumFractionDigits option', () => {
		const result = formatNumber(3.14159, { maximumFractionDigits: 2 }, 'comma_dot');

		expect(result).toBe('3.14');
	});

	it('respects maximumFractionDigits: 0 for integers', () => {
		const result = formatNumber(1536.7, { maximumFractionDigits: 0 }, 'comma_dot');

		expect(result).toBe('1,537');
	});

	it('formats zero correctly', () => {
		const result = formatNumber(0, {}, 'comma_dot');

		expect(result).toBe('0');
	});

	it('formats negative numbers', () => {
		const result = formatNumber(-42.5, { maximumFractionDigits: 1 }, 'dot_comma');

		expect(result).toBe('-42,5');
	});
});
