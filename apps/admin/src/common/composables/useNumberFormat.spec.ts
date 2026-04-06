import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useNumberFormat } from './useNumberFormat';

const mockNumberFormat = ref<string | undefined>('comma_dot');

const mockFindByType = vi.fn((type: string) => {
	if (type === 'system-module' && mockNumberFormat.value) {
		return { type: 'system-module', enabled: true, numberFormat: mockNumberFormat.value };
	}

	return null;
});

vi.mock('../services/store', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({
			findByType: mockFindByType,
		})),
	})),
}));

describe('useNumberFormat', () => {
	it('returns numberFormat from system config', () => {
		mockNumberFormat.value = 'dot_comma';

		const { numberFormat } = useNumberFormat();

		expect(numberFormat.value).toBe('dot_comma');
	});

	it('returns undefined when config is not loaded', () => {
		mockNumberFormat.value = undefined;

		const { numberFormat } = useNumberFormat();

		expect(numberFormat.value).toBeUndefined();
	});

	it('format() uses the system number format', () => {
		mockNumberFormat.value = 'dot_comma';

		const { format } = useNumberFormat();

		expect(format(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('1.234,56');
	});

	it('format() uses comma_dot format', () => {
		mockNumberFormat.value = 'comma_dot';

		const { format } = useNumberFormat();

		expect(format(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('1,234.56');
	});

	it('formatPct() returns dash for null', () => {
		mockNumberFormat.value = 'comma_dot';

		const { formatPct } = useNumberFormat();

		expect(formatPct(null)).toBe('—');
	});

	it('formatPct() formats percentage with system config', () => {
		mockNumberFormat.value = 'dot_comma';

		const { formatPct } = useNumberFormat();

		expect(formatPct(45.67)).toBe('45,67%');
	});
});
