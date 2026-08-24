import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesHomeyPluginSupportState, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IHomeyInventoryDevice } from '../store/homey.types';

import { useDevicesWizard } from './useDevicesWizard';

const flashMessage = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() };
const inventory = {
	adoptionResults: [],
	fetching: false,
	adopting: false,
	firstLoad: true,
	findAll: vi.fn<() => IHomeyInventoryDevice[]>(),
	findById: vi.fn(),
	fetch: vi.fn(),
	adoptBatch: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({
		global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => undefined },
	}),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: () => ({ getStore: () => inventory }),
		useFlashMessage: () => flashMessage,
	};
});

const device = (overrides: Partial<IHomeyInventoryDevice> = {}): IHomeyInventoryDevice => ({
	id: 'homey-light',
	name: 'Desk light',
	class: 'light',
	zonePath: ['Office'],
	available: true,
	capabilities: [],
	supportState: DevicesHomeyPluginSupportState.supported,
	supportReasons: [],
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	adopted: false,
	...overrides,
});

describe('Homey useDevicesWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		inventory.adoptionResults = [];
		inventory.findAll.mockReturnValue([device()]);
		inventory.findById.mockImplementation((id) => (id === 'homey-light' ? device() : null));
		inventory.fetch.mockResolvedValue([]);
	});

	it('keeps supported adopted devices selectable for idempotent reconciliation', () => {
		inventory.findAll.mockReturnValue([device({ adopted: true, adoptedDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' })]);

		const row = useDevicesWizard().rows.value[0];

		expect(row).toEqual(expect.objectContaining({ status: 'already_registered', adoptable: true, willUpdate: true }));
	});

	it('preserves a skipped adoption as a no-change wizard result', async () => {
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'skipped', panelDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' }]);
		const adapter = useDevicesWizard();

		const results = await adapter.adopt([{ key: 'homey-light', name: 'Desk light', category: DevicesModuleDeviceCategory.lighting }]);

		expect(results[0]).toEqual(expect.objectContaining({ status: 'skipped' }));
	});

	it('surfaces batch request failures and leaves the rejection for the wizard shell', async () => {
		const failure = new Error('Homey is offline');
		inventory.adoptBatch.mockRejectedValue(failure);
		const adapter = useDevicesWizard();

		await expect(adapter.adopt([{ key: 'homey-light', name: 'Desk light', category: DevicesModuleDeviceCategory.lighting }])).rejects.toBe(failure);
		expect(flashMessage.error).toHaveBeenCalledWith('Homey is offline');
	});
});
