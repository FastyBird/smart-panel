import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesHomeyPluginAdoptionStatus, DevicesHomeyPluginSupportState, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { MAX_HOMEY_CONCURRENT_PREVIEWS, MAX_HOMEY_DEVICE_NAME_LENGTH } from '../devices-homey.constants';
import type { IHomeyAdoptSelection, IHomeyAdoptionResult, IHomeyInventoryDevice } from '../store/homey.types';

import { useDevicesWizard } from './useDevicesWizard';

type MockPreview = {
	suggestedCategory: DevicesModuleDeviceCategory;
	validCategories: DevicesModuleDeviceCategory[];
	readyToAdopt: boolean;
};

const flashMessage = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() };
const inventory = {
	adoptionResults: [] as IHomeyAdoptionResult[],
	previews: {} as Record<string, MockPreview>,
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
		inventory.preview.mockImplementation(async (id) => {
			const preview = {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting, DevicesModuleDeviceCategory.generic],
				readyToAdopt: true,
			};
			inventory.previews[id] = preview;

			return preview;
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
				readyToAdopt: true,
			},
		};
		inventory.fetch.mockResolvedValue([adopted]);
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'skipped' }]);

		const adapter = useDevicesWizard();
		await adapter.start();
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
		expect(inventory.preview).toHaveBeenCalledWith('homey-light');
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
				readyToAdopt: true,
			},
		};
		inventory.fetch.mockResolvedValue([adopted]);
		inventory.preview.mockImplementation(async (id) => {
			const preview = {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting],
				readyToAdopt: true,
			};
			inventory.previews[id] = preview;

			return preview;
		});
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'updated' }]);

		const adapter = useDevicesWizard();
		await adapter.start();
		const row = adapter.rows.value[0];

		expect(row.suggestedCategory).toBe(DevicesModuleDeviceCategory.lighting);
		expect(row.categoryOptions).toEqual([
			{
				value: DevicesModuleDeviceCategory.lighting,
				label: 'devicesModule.categories.devices.lighting',
			},
		]);

		await adapter.adopt([{ key: row.key, name: row.suggestedName, category: DevicesModuleDeviceCategory.lighting }]);

		expect(inventory.adoptBatch).toHaveBeenCalledWith([
			{ deviceId: 'homey-light', name: 'Custom desk lamp', deviceCategory: DevicesModuleDeviceCategory.lighting },
		]);
	});

	it('loads panel-device metadata before publishing the Homey inventory', async () => {
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(devicesStore.fetch).toHaveBeenCalledOnce();
		expect(inventory.fetch).toHaveBeenCalledOnce();
		expect(devicesStore.fetch.mock.invocationCallOrder[0]).toBeLessThan(inventory.fetch.mock.invocationCallOrder[0]!);
	});

	it('serializes refresh while inventory loading is in progress', async () => {
		let resolveDevices!: (devices: never[]) => void;
		devicesStore.fetch.mockReturnValue(
			new Promise((resolve) => {
				resolveDevices = resolve;
			})
		);
		const adapter = useDevicesWizard();

		const initialLoad = adapter.start();
		const refresh = adapter.controls.value.find((control) => control.type === 'action' && control.id === 'refresh');
		expect(refresh).toEqual(expect.objectContaining({ loading: true, disabled: true }));

		const overlappingRefresh = adapter.restart!();
		expect(devicesStore.fetch).toHaveBeenCalledOnce();
		expect(inventory.fetch).not.toHaveBeenCalled();

		resolveDevices([]);
		await Promise.all([initialLoad, overlappingRefresh]);

		expect(devicesStore.fetch).toHaveBeenCalledOnce();
		expect(inventory.fetch).toHaveBeenCalledOnce();
	});

	it('aborts an in-flight inventory load when the wizard is disposed', async () => {
		let loadSignal: AbortSignal | undefined;
		inventory.fetch.mockImplementation(
			(_filters: unknown, signal?: AbortSignal) =>
				new Promise<IHomeyInventoryDevice[]>((_resolve, reject) => {
					loadSignal = signal;
					signal?.addEventListener('abort', () => reject(signal.reason));
				})
		);
		const adapter = useDevicesWizard();

		const load = adapter.start();
		await vi.waitFor(() => expect(inventory.fetch).toHaveBeenCalledOnce());
		await adapter.dispose?.();
		await load;

		expect(loadSignal?.aborted).toBe(true);
		expect(inventory.preview).not.toHaveBeenCalled();
		expect(adapter.sessionKey?.value).toBeNull();
		expect(adapter.rows.value).toEqual([]);
	});

	it('signals a new wizard session after refreshing inventory', async () => {
		const adapter = useDevicesWizard();

		expect(adapter.sessionKey?.value).toBeNull();
		await adapter.start();
		expect(adapter.sessionKey?.value).toBe('homey-session-1');

		await adapter.restart!();

		expect(adapter.sessionKey?.value).toBe('homey-session-2');
	});

	it('keeps a supported device unavailable for selection when its mapping preview is not ready', async () => {
		const supported = device();
		inventory.fetch.mockResolvedValue([supported]);
		inventory.preview.mockImplementation(async (id) => {
			const preview = {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting],
				readyToAdopt: false,
			};
			inventory.previews[id] = preview;

			return preview;
		});
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value[0]).toEqual(expect.objectContaining({ status: 'needs_attention', adoptable: false }));
	});

	it('isolates a mapping-preview failure to the affected device', async () => {
		const readyDevice = device({ id: 'homey-light' });
		const failedDevice = device({ id: 'homey-switch', name: 'Hall switch' });
		inventory.findAll.mockReturnValue([readyDevice, failedDevice]);
		inventory.fetch.mockResolvedValue([readyDevice, failedDevice]);
		inventory.preview.mockImplementation(async (id) => {
			if (id === 'homey-switch') throw new Error('Device disappeared');
			const preview = {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting],
				readyToAdopt: true,
			};
			inventory.previews[id] = preview;

			return preview;
		});
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value).toHaveLength(2);
		expect(adapter.rows.value.find((row) => row.key === 'homey-light')).toEqual(expect.objectContaining({ adoptable: true }));
		expect(adapter.rows.value.find((row) => row.key === 'homey-switch')).toEqual(
			expect.objectContaining({ status: 'needs_attention', adoptable: false })
		);
		expect(adapter.ready.value).toBe(true);
	});

	it('bounds concurrent mapping-preview requests for large inventories', async () => {
		const supportedDevices = Array.from({ length: 12 }, (_, index) => device({ id: `homey-device-${index}`, name: `Device ${index}` }));
		inventory.findAll.mockReturnValue(supportedDevices);
		inventory.fetch.mockResolvedValue(supportedDevices);
		let activePreviews = 0;
		let maximumActivePreviews = 0;
		inventory.preview.mockImplementation(async (id) => {
			activePreviews += 1;
			maximumActivePreviews = Math.max(maximumActivePreviews, activePreviews);
			await Promise.resolve();
			activePreviews -= 1;
			const preview = {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting],
				readyToAdopt: true,
			};
			inventory.previews[id] = preview;

			return preview;
		});
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(maximumActivePreviews).toBe(MAX_HOMEY_CONCURRENT_PREVIEWS);
		expect(adapter.rows.value).toHaveLength(supportedDevices.length);
	});

	it('omits metadata overrides when the adopted panel device is not loaded', async () => {
		const adopted = device({ adopted: true, adoptedDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' });
		inventory.findById.mockReturnValue(adopted);
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'skipped' }]);
		const adapter = useDevicesWizard();

		await adapter.adopt([{ key: 'homey-light', name: 'Upstream name', category: DevicesModuleDeviceCategory.lighting }]);

		expect(inventory.adoptBatch).toHaveBeenCalledWith([{ deviceId: 'homey-light' }]);
	});

	it('bounds concurrent adoption-time mapping previews', async () => {
		const adoptedDevices = Array.from({ length: 12 }, (_, index) =>
			device({ id: `homey-device-${index}`, name: `Device ${index}`, adopted: true, adoptedDeviceId: `panel-device-${index}` })
		);
		inventory.findById.mockImplementation((id) => adoptedDevices.find((item) => item.id === id) ?? null);
		devicesStore.findById.mockReturnValue({ name: 'Panel device', category: DevicesModuleDeviceCategory.lighting });
		let activePreviews = 0;
		let maximumActivePreviews = 0;
		inventory.preview.mockImplementation(async () => {
			activePreviews += 1;
			maximumActivePreviews = Math.max(maximumActivePreviews, activePreviews);
			await Promise.resolve();
			activePreviews -= 1;

			return {
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
				validCategories: [DevicesModuleDeviceCategory.lighting],
				readyToAdopt: true,
			};
		});
		inventory.adoptBatch.mockImplementation(async (requests: IHomeyAdoptSelection[]) =>
			requests.map(({ deviceId }) => ({ deviceId, status: DevicesHomeyPluginAdoptionStatus.updated }))
		);
		const adapter = useDevicesWizard();

		await adapter.adopt(
			adoptedDevices.map((item) => ({
				key: item.id,
				name: item.name,
				category: DevicesModuleDeviceCategory.lighting,
			}))
		);

		expect(maximumActivePreviews).toBe(MAX_HOMEY_CONCURRENT_PREVIEWS);
		expect(inventory.adoptBatch).toHaveBeenCalledOnce();
	});

	it('continues adoption when one adopted-device preview fails', async () => {
		const disappeared = device({ id: 'homey-missing', name: 'Missing light', adopted: true, adoptedDeviceId: 'panel-missing' });
		const newDevice = device({ id: 'homey-new', name: 'New light' });
		inventory.findById.mockImplementation((id) => [disappeared, newDevice].find((item) => item.id === id) ?? null);
		devicesStore.findById.mockReturnValue({ name: 'Missing panel light', category: DevicesModuleDeviceCategory.lighting });
		inventory.preview.mockRejectedValue(new Error('Device disappeared'));
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-new', status: DevicesHomeyPluginAdoptionStatus.created }]);
		const adapter = useDevicesWizard();

		const results = await adapter.adopt([
			{ key: 'homey-missing', name: 'Missing panel light', category: DevicesModuleDeviceCategory.lighting },
			{ key: 'homey-new', name: 'New panel light', category: DevicesModuleDeviceCategory.lighting },
		]);

		expect(inventory.adoptBatch).toHaveBeenCalledWith([
			{ deviceId: 'homey-new', name: 'New panel light', deviceCategory: DevicesModuleDeviceCategory.lighting },
		]);
		expect(results).toEqual([
			{
				key: 'homey-missing',
				name: 'Missing panel light',
				identifier: 'homey-missing',
				status: DevicesHomeyPluginAdoptionStatus.failed,
				error: 'Device disappeared',
			},
			expect.objectContaining({ key: 'homey-new', name: 'New panel light', status: DevicesHomeyPluginAdoptionStatus.created }),
		]);
		expect(inventory.adoptionResults).toEqual([
			expect.objectContaining({ deviceId: 'homey-missing', status: DevicesHomeyPluginAdoptionStatus.failed, message: 'Device disappeared' }),
			expect.objectContaining({ deviceId: 'homey-new', status: DevicesHomeyPluginAdoptionStatus.created }),
		]);
	});

	it('fails an adopted device when its confirmed category is no longer valid', async () => {
		const adopted = device({ adopted: true, adoptedDeviceId: 'panel-light' });
		inventory.findById.mockReturnValue(adopted);
		devicesStore.findById.mockReturnValue({ name: 'Custom desk lamp', category: DevicesModuleDeviceCategory.generic });
		inventory.preview.mockResolvedValue({
			suggestedCategory: DevicesModuleDeviceCategory.lighting,
			validCategories: [DevicesModuleDeviceCategory.lighting],
			readyToAdopt: true,
		});
		const adapter = useDevicesWizard();

		const results = await adapter.adopt([{ key: 'homey-light', name: 'Custom desk lamp', category: DevicesModuleDeviceCategory.generic }]);

		expect(inventory.adoptBatch).not.toHaveBeenCalled();
		expect(results).toEqual([
			{
				key: 'homey-light',
				name: 'Custom desk lamp',
				identifier: 'homey-light',
				status: DevicesHomeyPluginAdoptionStatus.failed,
				error: 'devicesHomeyPlugin.wizard.errors.mappingChanged',
			},
		]);
	});

	it('rejects an overlong name without invalidating other adoption requests', async () => {
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-switch', status: DevicesHomeyPluginAdoptionStatus.created }]);
		const adapter = useDevicesWizard();
		const overlongName = 'x'.repeat(MAX_HOMEY_DEVICE_NAME_LENGTH + 1);

		const results = await adapter.adopt([
			{ key: 'homey-light', name: overlongName, category: DevicesModuleDeviceCategory.lighting },
			{ key: 'homey-switch', name: 'Hall switch', category: DevicesModuleDeviceCategory.switcher },
		]);

		expect(inventory.adoptBatch).toHaveBeenCalledWith([
			{ deviceId: 'homey-switch', name: 'Hall switch', deviceCategory: DevicesModuleDeviceCategory.switcher },
		]);
		expect(results).toEqual([
			expect.objectContaining({
				key: 'homey-light',
				name: overlongName,
				status: DevicesHomeyPluginAdoptionStatus.failed,
				error: `devicesHomeyPlugin.wizard.errors.nameTooLong:{"max":${MAX_HOMEY_DEVICE_NAME_LENGTH}}`,
			}),
			expect.objectContaining({ key: 'homey-switch', name: 'Hall switch', status: DevicesHomeyPluginAdoptionStatus.created }),
		]);
	});

	it('preserves a skipped adoption as a no-change wizard result', async () => {
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'skipped', panelDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' }]);
		const adapter = useDevicesWizard();

		const results = await adapter.adopt([{ key: 'homey-light', name: 'Custom desk light', category: DevicesModuleDeviceCategory.lighting }]);

		expect(results[0]).toEqual(expect.objectContaining({ status: 'skipped', name: 'Custom desk light' }));
	});

	it('returns completed chunk results when a later batch request fails', async () => {
		const failure = new Error('Homey is offline');
		inventory.adoptionResults = [{ deviceId: 'homey-light', status: DevicesHomeyPluginAdoptionStatus.created }];
		inventory.adoptBatch.mockRejectedValue(failure);
		const adapter = useDevicesWizard();

		const results = await adapter.adopt([
			{ key: 'homey-light', name: 'Custom desk light', category: DevicesModuleDeviceCategory.lighting },
			{ key: 'homey-switch', name: 'Hall switch', category: DevicesModuleDeviceCategory.switcher },
		]);

		expect(results).toEqual([
			expect.objectContaining({ key: 'homey-light', status: 'created', name: 'Custom desk light' }),
			{
				key: 'homey-switch',
				name: 'Hall switch',
				identifier: 'homey-switch',
				status: 'failed',
				error: 'Homey is offline',
			},
		]);
		expect(adapter.results.value).toEqual(results);
		expect(inventory.adoptionResults).toEqual([
			expect.objectContaining({ deviceId: 'homey-light', status: DevicesHomeyPluginAdoptionStatus.created }),
			expect.objectContaining({ deviceId: 'homey-switch', status: DevicesHomeyPluginAdoptionStatus.failed, message: 'Homey is offline' }),
		]);
		expect(flashMessage.error).toHaveBeenCalledWith('Homey is offline');
	});

	it('stays busy while an adopted-device preview is refreshed before reconciliation', async () => {
		const adopted = device({ adopted: true, adoptedDeviceId: '4a2515a6-7e87-4e51-96cc-832698237613' });
		inventory.findById.mockReturnValue(adopted);
		devicesStore.findById.mockReturnValue({ name: 'Custom desk lamp', category: DevicesModuleDeviceCategory.lighting });
		let resolvePreview!: (preview: MockPreview) => void;
		inventory.preview.mockReturnValue(
			new Promise((resolve) => {
				resolvePreview = resolve;
			})
		);
		inventory.adoptBatch.mockResolvedValue([{ deviceId: 'homey-light', status: 'updated' }]);
		const adapter = useDevicesWizard();

		const operation = adapter.adopt([{ key: 'homey-light', name: 'Custom desk lamp', category: DevicesModuleDeviceCategory.lighting }]);
		expect(adapter.busy.value).toBe(true);

		resolvePreview({
			suggestedCategory: DevicesModuleDeviceCategory.lighting,
			validCategories: [DevicesModuleDeviceCategory.lighting],
			readyToAdopt: true,
		});
		await operation;

		expect(adapter.busy.value).toBe(false);
	});

	it('surfaces batch request failures and leaves the rejection for the wizard shell', async () => {
		const failure = new Error('Homey is offline');
		inventory.adoptBatch.mockRejectedValue(failure);
		const adapter = useDevicesWizard();

		await expect(adapter.adopt([{ key: 'homey-light', name: 'Desk light', category: DevicesModuleDeviceCategory.lighting }])).rejects.toBe(failure);
		expect(flashMessage.error).toHaveBeenCalledWith('Homey is offline');
	});
});
