import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesHomeyPluginSupportState, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IHomeyInventoryDevice } from '../store/homey.types';

import { useDevicesWizard } from './useDevicesWizard';

const flashMessage = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() };
const inventory = {
	adoptionResults: [],
	previews: {},
	fetching: false,
	adopting: false,
	firstLoad: true,
	findAll: vi.fn<() => IHomeyInventoryDevice[]>(),
	findById: vi.fn(),
	fetch: vi.fn(),
	preview: vi.fn(),
	adoptBatch: vi.fn(),
};
const devicesStore = {
	findById: vi.fn(),
	fetch: vi.fn(),
};
const stores: unknown[] = [];

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
		injectStoresManager: () => ({ getStore: () => stores.shift() }),
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
		stores.splice(0, stores.length, devicesStore, inventory);
		inventory.adoptionResults = [];
		inventory.previews = {};
		inventory.findAll.mockReturnValue([device()]);
		inventory.findById.mockImplementation((id) => (id === 'homey-light' ? device() : null));
		inventory.fetch.mockResolvedValue([]);
		inventory.preview.mockResolvedValue({
			suggestedCategory: DevicesModuleDeviceCategory.lighting,
			validCategories: [DevicesModuleDeviceCategory.lighting, DevicesModuleDeviceCategory.generic],
		});
		devicesStore.findById.mockReturnValue(null);
		devicesStore.fetch.mockResolvedValue([]);
	});

	it('keeps supported adopted devices selectable without replacing customized metadata', async () => {
		const adopted = device({ adopted: true, adoptedDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' });
		inventory.findAll.mockReturnValue([adopted]);
		inventory.findById.mockReturnValue(adopted);
		devicesStore.findById.mockReturnValue({ name: 'Custom desk lamp', category: DevicesModuleDeviceCategory.generic });
		inventory.previews = {
			'homey-light': {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting, DevicesModuleDeviceCategory.generic],
			},
		};
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'skipped' }]);

		const adapter = useDevicesWizard();
		const row = adapter.rows.value[0];

		expect(row).toEqual(
			expect.objectContaining({
				status: 'already_registered',
				adoptable: true,
				willUpdate: true,
				suggestedName: 'Custom desk lamp',
				suggestedCategory: DevicesModuleDeviceCategory.generic,
			})
		);

		await adapter.adopt([{ key: row.key, name: row.suggestedName, category: row.suggestedCategory! }]);

		expect(inventory.adoptBatch).toHaveBeenCalledWith([
			{ deviceId: 'homey-light', name: 'Custom desk lamp', deviceCategory: DevicesModuleDeviceCategory.generic },
		]);
	});

	it('falls back to the current mapping category when a saved category is stale', async () => {
		const adopted = device({ adopted: true, adoptedDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' });
		inventory.findAll.mockReturnValue([adopted]);
		inventory.findById.mockReturnValue(adopted);
		devicesStore.findById.mockReturnValue({ name: 'Custom desk lamp', category: DevicesModuleDeviceCategory.generic });
		inventory.previews = {
			'homey-light': {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting],
			},
		};
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'updated' }]);

		const adapter = useDevicesWizard();
		const row = adapter.rows.value[0];

		expect(row.suggestedCategory).toBe(DevicesModuleDeviceCategory.lighting);
		expect(row.categoryOptions).toEqual([
			{
				value: DevicesModuleDeviceCategory.lighting,
				label: 'devicesModule.categories.devices.lighting',
			},
		]);

		await adapter.adopt([{ key: row.key, name: row.suggestedName, category: DevicesModuleDeviceCategory.generic }]);

		expect(inventory.adoptBatch).toHaveBeenCalledWith([{ deviceId: 'homey-light', name: 'Custom desk lamp' }]);
	});

	it('omits metadata overrides when the adopted panel device is not loaded', async () => {
		const adopted = device({ adopted: true, adoptedDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' });
		inventory.findById.mockReturnValue(adopted);
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'skipped' }]);
		const adapter = useDevicesWizard();

		await adapter.adopt([{ key: 'homey-light', name: 'Upstream name', category: DevicesModuleDeviceCategory.lighting }]);

		expect(inventory.adoptBatch).toHaveBeenCalledWith([{ deviceId: 'homey-light' }]);
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
