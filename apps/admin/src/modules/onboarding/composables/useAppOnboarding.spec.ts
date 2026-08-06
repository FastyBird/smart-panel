import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';

import { useAppOnboarding } from './useAppOnboarding';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

// Mocked at each composable's own file, not the '../../../common' barrel: useOnboardingStatus()
// (called internally by useAppOnboarding()) independently imports useBackend from the barrel too,
// and only intercepting the concrete source file guarantees both call sites see the same stub.
vi.mock('../../../common/composables/useBackend', () => ({
	useBackend: () => ({ client: { GET: mockGet, POST: mockPost, PATCH: mockPatch } }),
}));

vi.mock('../../../common/services/store', () => ({
	injectStoresManager: () => ({ getStore: () => ({}) }),
}));

vi.mock('../../../common/composables/useFlashMessage', () => ({
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('useAppOnboarding', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGet.mockResolvedValue({ data: { data: [] }, error: undefined });
	});

	it('requests only non-hidden devices, so a hidden device can never enter the assignment batch', async () => {
		// completeOnboarding() -> saveDeviceAssignments() POSTs device_ids gathered from
		// deviceAssignments, which is seeded from this fetchDevices() result (via
		// suggestSpacesFromDevices()). The backend refuses the *entire* /spaces/:id/assign batch if
		// any targeted device is hidden, so excluding hidden devices here — at the source — is what
		// keeps one from ever being able to sink onboarding's completion step.
		const { fetchDevices } = useAppOnboarding();

		await fetchDevices();

		expect(mockGet).toHaveBeenCalledWith('/modules/devices/devices', {
			params: { query: { hidden: DevicesModuleDevicesHiddenFilter.false } },
		});
	});
});
