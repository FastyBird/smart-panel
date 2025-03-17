import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useBreakpoints } from './useBreakpoints';

vi.mock('@vueuse/core', () => ({
	useBreakpoints: vi.fn(() => ({
		xs: ref(false),
		sm: ref(false),
		md: ref(true), // Mocking as medium device
		lg: ref(false),
		xl: ref(false),
		xxl: ref(false),
	})),
	breakpointsBootstrapV5: {},
}));

describe('useBreakpoints', () => {
	it('returns correct computed values based on breakpoints', () => {
		const breakpoints = useBreakpoints();

		expect(breakpoints.isXSDevice.value).toBe(false);
		expect(breakpoints.isSMDevice.value).toBe(false);
		expect(breakpoints.isMDDevice.value).toBe(true);
		expect(breakpoints.isLGDevice.value).toBe(false);
		expect(breakpoints.isXLDevice.value).toBe(false);
		expect(breakpoints.isXXLDevice.value).toBe(false);
	});
});
