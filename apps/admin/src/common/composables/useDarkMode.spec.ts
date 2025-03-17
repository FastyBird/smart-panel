import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useDarkMode } from './useDarkMode';

vi.mock('@vueuse/core', () => {
	const darkModeRef = ref(false); // Default theme: Light mode

	return {
		useDark: vi.fn(() => darkModeRef),
		useToggle: vi.fn(() => vi.fn(() => (darkModeRef.value = !darkModeRef.value))),
	};
});

describe('useDarkMode', () => {
	it('returns correct computed values', () => {
		const { isDark } = useDarkMode();

		expect(isDark.value).toBe(false);
	});

	it('toggles dark mode', () => {
		const { isDark, toggleDark } = useDarkMode();

		toggleDark();
		expect(isDark.value).toBe(true);

		toggleDark();
		expect(isDark.value).toBe(false);
	});
});
