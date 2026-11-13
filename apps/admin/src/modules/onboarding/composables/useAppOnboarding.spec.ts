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

	describe('saveLocation', () => {
		beforeEach(() => {
			const { reset } = useAppOnboarding();

			reset();

			mockPatch.mockResolvedValue({ data: {}, error: undefined });
			mockPost.mockResolvedValue({ data: { data: { id: 'location-1' } }, error: undefined });
		});

		it('stores the chosen coordinates as the house location, as well as for the weather', async () => {
			const { locationData, saveLocation } = useAppOnboarding();

			locationData.latitude = -33.87;
			locationData.longitude = 151.21;

			await expect(saveLocation()).resolves.toBe(true);

			expect(mockPatch).toHaveBeenCalledWith('/modules/config/config/module/{module}', {
				params: { path: { module: 'system-module' } },
				body: { data: { type: 'system-module', latitude: -33.87, longitude: 151.21 } },
			});
			expect(mockPatch).toHaveBeenCalledWith('/modules/config/config/module/{module}', {
				params: { path: { module: 'weather-module' } },
				body: { data: { type: 'weather-module', primary_location_id: 'location-1' } },
			});
		});

		it('fails when the house location can not be stored', async () => {
			const { locationData, saveLocation } = useAppOnboarding();

			locationData.latitude = 50;
			locationData.longitude = 14;

			mockPatch.mockResolvedValueOnce({ data: undefined, error: { status: 422 } });

			await expect(saveLocation()).resolves.toBe(false);
			expect(mockPost).not.toHaveBeenCalled();
		});

		it('stores nothing when no coordinates were chosen', async () => {
			const { saveLocation } = useAppOnboarding();

			await expect(saveLocation()).resolves.toBe(true);
			expect(mockPatch).not.toHaveBeenCalled();
		});
	});
});
