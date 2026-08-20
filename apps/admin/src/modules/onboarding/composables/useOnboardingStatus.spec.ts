import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOnboardingStatus } from './useOnboardingStatus';

const mockGet = vi.fn();

// Mocked at the composable's own file, not the '../../../common' barrel: ensure
// all call sites see the same stub.
vi.mock('../../../common/composables/useBackend', () => ({
	useBackend: () => ({ client: { GET: mockGet } }),
}));

describe('useOnboardingStatus', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGet.mockResolvedValue({ data: { data: {} }, error: undefined });
	});

	it('returns the same computed instances on every call (the router guard calls this per navigation)', () => {
		const first = useOnboardingStatus();
		const second = useOnboardingStatus();

		expect(first.needsOnboarding).toBe(second.needsOnboarding);
		expect(first.isOnboardingCompleted).toBe(second.isOnboardingCompleted);
	});
});
