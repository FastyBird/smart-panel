import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import type { IShellyNgDiscoverySession } from '../schemas/devices.types';

import { useDevicesWizard } from './useDevicesWizard';

const mockAdd = vi.fn();

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('@vueuse/core', async () => {
	const actual = await vi.importActual('@vueuse/core');

	return {
		...actual,
		tryOnMounted: vi.fn(),
		tryOnUnmounted: vi.fn(),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({
				add: mockAdd,
			}),
		}),
		useBackend: () => ({
			client: backendClient,
		}),
		useFlashMessage: () => ({
			error: vi.fn(),
			success: vi.fn(),
		}),
	};
});

const discoverySession: IShellyNgDiscoverySession = {
	id: 'session-1',
	status: 'running',
	startedAt: '2026-04-29T12:00:00.000Z',
	expiresAt: '2026-04-29T12:00:30.000Z',
	remainingSeconds: 30,
	devices: [
		{
			identifier: 'shellyplus1-aabbcc',
			hostname: '192.168.1.10',
			name: 'Kitchen relay',
			model: 'SNSW-001X16EU',
			displayName: 'Shelly Plus 1',
			firmware: '1.2.3',
			status: 'ready',
			source: 'mdns',
			categories: [DevicesModuleDeviceCategory.lighting, DevicesModuleDeviceCategory.switcher],
			suggestedCategory: DevicesModuleDeviceCategory.lighting,
			authentication: {
				enabled: false,
				domain: null,
			},
			registeredDeviceId: null,
			registeredDeviceName: null,
			error: null,
			lastSeenAt: '2026-04-29T12:00:01.000Z',
		},
	],
};

const checkingDiscoverySession: IShellyNgDiscoverySession = {
	...discoverySession,
	devices: [
		{
			...discoverySession.devices[0]!,
			name: null,
			displayName: null,
			status: 'checking',
			categories: [],
			suggestedCategory: null,
		},
	],
};

describe('useDevicesWizard', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mockAdd.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('starts discovery and prepares ready devices for adoption', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: discoverySession,
			},
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();

		expect(backendClient.POST).toHaveBeenCalledWith(`/plugins/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery`);
		expect(wizard.session.value?.id).toBe('session-1');
		expect(wizard.selected['192.168.1.10']).toBe(true);
		expect(wizard.categoryByHostname['192.168.1.10']).toBe(DevicesModuleDeviceCategory.lighting);
		expect(wizard.canContinue.value).toBe(true);
	});

	it('adds a manual lookup to an existing discovery session', async () => {
		backendClient.POST
			.mockResolvedValueOnce({
				data: {
					data: {
						...discoverySession,
						devices: [],
					},
				},
				response: { status: 200 },
			})
			.mockResolvedValueOnce({
				data: {
					data: discoverySession,
				},
				response: { status: 200 },
			});

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();

		wizard.manual.hostname = '192.168.1.10';
		wizard.manual.password = 'secret';

		await wizard.addManualDevice();

		expect(backendClient.POST).toHaveBeenLastCalledWith(`/plugins/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery/{id}/manual`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
			body: {
				data: {
					hostname: '192.168.1.10',
					password: 'secret',
				},
			},
		});
		expect(wizard.manual.hostname).toBe('');
		expect(wizard.devices.value).toHaveLength(1);
	});

	it('promotes polling placeholders when discovered devices become ready', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: checkingDiscoverySession,
			},
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: {
				data: discoverySession,
			},
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();

		expect(wizard.selected['192.168.1.10']).toBe(false);
		expect(wizard.categoryByHostname['192.168.1.10']).toBeNull();
		expect(wizard.nameByHostname['192.168.1.10']).toBe('192.168.1.10');

		await wizard.refreshDiscovery();

		expect(wizard.selected['192.168.1.10']).toBe(true);
		expect(wizard.categoryByHostname['192.168.1.10']).toBe(DevicesModuleDeviceCategory.lighting);
		expect(wizard.nameByHostname['192.168.1.10']).toBe('Kitchen relay');
		expect(wizard.canContinue.value).toBe(true);
	});

	it('adopts selected ready devices through the devices store', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: discoverySession,
			},
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();
		await wizard.adoptSelected();

		expect(mockAdd).toHaveBeenCalledWith({
			id: expect.any(String),
			draft: false,
			data: expect.objectContaining({
				type: DEVICES_SHELLY_NG_TYPE,
				category: DevicesModuleDeviceCategory.lighting,
				identifier: 'shellyplus1-aabbcc',
				name: 'Kitchen relay',
				password: null,
				wifiAddress: '192.168.1.10',
			}),
		});
		expect(wizard.adoptionResults.value).toEqual([
			expect.objectContaining({
				hostname: '192.168.1.10',
				name: 'Kitchen relay',
				status: 'created',
			}),
		]);
	});
});
