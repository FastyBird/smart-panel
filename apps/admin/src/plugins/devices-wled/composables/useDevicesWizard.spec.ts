import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type IWizardBannerControl, type IWizardFormControl } from '../../../modules/devices';
import { DevicesModuleDeviceCategory, DevicesWledPluginAdoptDeviceCategory } from '../../../openapi.constants';
import { DEVICES_WLED_PLUGIN_PREFIX } from '../devices-wled.constants';

import { useDevicesWizard } from './useDevicesWizard';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

const flashMessage = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() };
const devicesStore = { fetch: vi.fn() };

vi.mock('vue-i18n', () => ({
	createI18n: () => ({
		global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => undefined },
	}),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: () => ({ getStore: vi.fn(() => devicesStore) }),
		useBackend: () => ({ client: backendClient }),
		useFlashMessage: () => flashMessage,
		useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
	};
});

const inventory = {
	mdnsEnabled: true,
	discoveryRunning: true,
	devices: [
		{
			host: '192.168.1.100',
			name: 'Living room strip',
			mac: 'AA:BB:CC:DD:EE:FF',
			port: 80,
			adoptedDeviceId: null,
		},
	],
};

describe('useDevicesWizard', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		devicesStore.fetch.mockResolvedValue([]);
		backendClient.GET.mockResolvedValue({ data: { data: inventory }, response: { status: 200 } });
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('maps discovered and already adopted WLED devices to shared rows', async () => {
		backendClient.GET.mockResolvedValue({
			data: {
				data: {
					...inventory,
					devices: [
						...inventory.devices,
						{
							...inventory.devices[0],
							host: '192.168.1.101',
							mac: '11:22:33:44:55:66',
							adoptedDeviceId: 'device-1',
						},
					],
				},
			},
			response: { status: 200 },
		});
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'mac:aabbccddeeff', status: 'ready', adoptable: true }),
				expect.objectContaining({ status: 'already_registered', adoptable: false }),
			])
		);
		await adapter.dispose?.();
	});

	it('keeps manual probing available when mDNS is disabled', async () => {
		backendClient.GET.mockResolvedValue({ data: { data: { ...inventory, mdnsEnabled: false, devices: [] } }, response: { status: 200 } });
		backendClient.POST.mockResolvedValue({
			data: { data: inventory.devices[0] },
			response: { status: 201 },
		});
		const adapter = useDevicesWizard();
		await adapter.start();

		expect((adapter.controls.value[0] as IWizardBannerControl).id).toBe('mdns-disabled');
		const form = adapter.controls.value.find((control) => control.type === 'form') as IWizardFormControl;
		await form.handler({ host: '192.168.1.100' });

		expect(backendClient.POST).toHaveBeenCalledWith(`/plugins/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/probe`, {
			body: { data: { host: '192.168.1.100' } },
		});
		expect(adapter.rows.value[0]).toEqual(expect.objectContaining({ label: 'Living room strip', adoptable: true }));
		await adapter.dispose?.();
	});

	it('adopts selected devices in one mapper-backed batch and refreshes the device store', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: [{ host: '192.168.1.100', name: 'Renamed strip', status: 'created', error: null }] },
			response: { status: 200 },
		});
		const adapter = useDevicesWizard();
		await adapter.start();

		const results = await adapter.adopt([{ key: 'mac:aabbccddeeff', name: 'Renamed strip', category: DevicesModuleDeviceCategory.lighting }]);

		expect(backendClient.POST).toHaveBeenCalledWith(`/plugins/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/adopt`, {
			body: {
				data: {
					devices: [
						{
							host: '192.168.1.100',
							name: 'Renamed strip',
							category: DevicesWledPluginAdoptDeviceCategory.lighting,
						},
					],
				},
			},
		});
		expect(results[0]).toEqual(expect.objectContaining({ key: 'mac:aabbccddeeff', status: 'created' }));
		expect(devicesStore.fetch).toHaveBeenCalledTimes(1);
		await adapter.dispose?.();
	});

	it('includes a discovered non-default port in the adoption host', async () => {
		backendClient.GET.mockResolvedValue({
			data: {
				data: {
					...inventory,
					devices: [{ ...inventory.devices[0], port: 8080 }],
				},
			},
			response: { status: 200 },
		});
		backendClient.POST.mockResolvedValue({
			data: { data: [{ host: '192.168.1.100:8080', name: 'Strip', status: 'created', error: null }] },
			response: { status: 200 },
		});
		const adapter = useDevicesWizard();
		await adapter.start();

		const results = await adapter.adopt([{ key: 'mac:aabbccddeeff', name: 'Strip', category: DevicesModuleDeviceCategory.lighting }]);

		expect(backendClient.POST).toHaveBeenCalledWith(
			`/plugins/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/adopt`,
			expect.objectContaining({
				body: expect.objectContaining({
					data: expect.objectContaining({
						devices: [expect.objectContaining({ host: '192.168.1.100:8080' })],
					}),
				}),
			})
		);
		expect(results[0].key).toBe('mac:aabbccddeeff');
		await adapter.dispose?.();
	});

	it('does not append the port twice after a manual probe', async () => {
		backendClient.GET.mockResolvedValue({
			data: { data: { ...inventory, mdnsEnabled: false, devices: [] } },
			response: { status: 200 },
		});
		backendClient.POST.mockResolvedValueOnce({
			data: { data: { ...inventory.devices[0], host: '192.168.1.100:8080', port: 8080 } },
			response: { status: 201 },
		}).mockResolvedValueOnce({
			data: { data: [{ host: '192.168.1.100:8080', name: 'Strip', status: 'created', error: null }] },
			response: { status: 200 },
		});
		const adapter = useDevicesWizard();
		await adapter.start();
		const form = adapter.controls.value.find((control) => control.type === 'form') as IWizardFormControl;
		await form.handler({ host: '192.168.1.100:8080' });

		await adapter.adopt([{ key: 'mac:aabbccddeeff', name: 'Strip', category: DevicesModuleDeviceCategory.lighting }]);

		expect(backendClient.POST).toHaveBeenLastCalledWith(
			`/plugins/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/adopt`,
			expect.objectContaining({
				body: expect.objectContaining({
					data: expect.objectContaining({
						devices: [expect.objectContaining({ host: '192.168.1.100:8080' })],
					}),
				}),
			})
		);
		await adapter.dispose?.();
	});

	it('stops polling when disposed', async () => {
		const adapter = useDevicesWizard();
		await adapter.start();
		await adapter.dispose?.();
		await vi.advanceTimersByTimeAsync(4_000);

		expect(backendClient.GET).toHaveBeenCalledTimes(1);
	});

	it('serializes repeated rescan actions', async () => {
		let resolveRescan: ((value: unknown) => void) | undefined;
		backendClient.POST.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveRescan = resolve;
				})
		);
		const adapter = useDevicesWizard();
		await adapter.start();
		const action = adapter.controls.value.find((control) => control.type === 'action');
		if (action?.type !== 'action') throw new Error('Rescan action not found');

		const rescans = [action.handler(), action.handler()];
		resolveRescan?.({ data: { data: inventory }, response: { status: 200 } });
		await Promise.all(rescans);

		expect(backendClient.POST).toHaveBeenCalledTimes(1);
		await adapter.dispose?.();
	});

	it('clears the busy state when adoption transport fails', async () => {
		const adapter = useDevicesWizard();
		await adapter.start();
		backendClient.POST.mockRejectedValueOnce(new Error('Connection dropped'));

		await expect(adapter.adopt([{ key: 'mac:aabbccddeeff', name: 'Strip', category: DevicesModuleDeviceCategory.lighting }])).rejects.toThrow(
			'Connection dropped'
		);
		expect(adapter.busy.value).toBe(false);
		await adapter.dispose?.();
	});

	it('returns successful adoption results when the device-store refresh fails', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: [{ host: '192.168.1.100', name: 'Strip', status: 'created', error: null }] },
			response: { status: 200 },
		});
		devicesStore.fetch.mockRejectedValueOnce(new Error('Refresh failed'));
		const adapter = useDevicesWizard();
		await adapter.start();

		const results = await adapter.adopt([{ key: 'mac:aabbccddeeff', name: 'Strip', category: DevicesModuleDeviceCategory.lighting }]);

		expect(results[0]).toEqual(expect.objectContaining({ key: 'mac:aabbccddeeff', status: 'created' }));
		expect(adapter.busy.value).toBe(false);
		await adapter.dispose?.();
	});
});
