import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';

import { useSpacesWizard } from './useSpacesWizard';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectBackendClient: () => ({
			GET: mockGet,
			POST: mockPost,
		}),
	};
});

describe('useSpacesWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGet.mockResolvedValue({ data: { data: [] }, error: undefined });
	});

	it('requests only non-hidden devices, so a hidden device can never enter the assignment batch', async () => {
		// applyAssignments() POSTs device_ids gathered from state.deviceAssignments, which is seeded
		// from this fetchDevices() result. The backend refuses the *entire* /spaces/:id/assign batch
		// if any targeted device is hidden, so excluding hidden devices here — at the source — is
		// what keeps one from ever being able to sink the whole wizard's assignment step.
		const { fetchDevices } = useSpacesWizard();

		await fetchDevices();

		expect(mockGet).toHaveBeenCalledWith('/modules/devices/devices', {
			params: { query: { hidden: DevicesModuleDevicesHiddenFilter.false } },
		});
	});
});
