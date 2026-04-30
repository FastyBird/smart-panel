import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import type { IShellyNgDiscoverySession } from '../schemas/devices.types';

import { useDevicesWizard } from './useDevicesWizard';

const mockAdd = vi.fn();
const mockEdit = vi.fn();

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
				edit: mockEdit,
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
		mockEdit.mockResolvedValue(undefined);
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
		backendClient.POST.mockResolvedValueOnce({
			data: {
				data: {
					...discoverySession,
					devices: [],
				},
			},
			response: { status: 200 },
		}).mockResolvedValueOnce({
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

	it('keeps a user deselection when a ready device is rediscovered', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: discoverySession,
			},
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValueOnce({
			data: {
				data: checkingDiscoverySession,
			},
			response: { status: 200 },
		}).mockResolvedValueOnce({
			data: {
				data: discoverySession,
			},
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();

		wizard.selected['192.168.1.10'] = false;

		await wizard.refreshDiscovery();
		await wizard.refreshDiscovery();

		expect(wizard.selected['192.168.1.10']).toBe(false);
		expect(wizard.canContinue.value).toBe(false);
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

	it('updates already_registered devices via edit when the user opts in', async () => {
		const alreadyRegisteredSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'already_registered',
					registeredDeviceId: 'device-uuid-1',
					registeredDeviceName: 'Existing kitchen relay',
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: alreadyRegisteredSession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: alreadyRegisteredSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();

		// already_registered devices start unselected — user must opt in to override
		expect(wizard.selected['192.168.1.10']).toBe(false);
		expect(wizard.nameByHostname['192.168.1.10']).toBe('Existing kitchen relay');

		wizard.selected['192.168.1.10'] = true;
		wizard.categoryByHostname['192.168.1.10'] = DevicesModuleDeviceCategory.switcher;

		await wizard.adoptSelected();

		expect(mockEdit).toHaveBeenCalledWith({
			id: 'device-uuid-1',
			data: expect.objectContaining({
				type: DEVICES_SHELLY_NG_TYPE,
				category: DevicesModuleDeviceCategory.switcher,
				name: 'Existing kitchen relay',
			}),
		});
		expect(mockAdd).not.toHaveBeenCalled();
		expect(wizard.adoptionResults.value).toEqual([
			expect.objectContaining({
				hostname: '192.168.1.10',
				status: 'updated',
			}),
		]);
	});

	it('falls back to update when create fails because the main service auto-adopted the device', async () => {
		const racedSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'already_registered',
					registeredDeviceId: 'device-uuid-2',
					registeredDeviceName: 'Auto-adopted relay',
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		// First refresh in adoptSelected: still shows the snapshot's `ready` status.
		// Second refresh (after add fails): shows the device now exists.
		backendClient.GET.mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		}).mockResolvedValue({
			data: { data: racedSession },
			response: { status: 200 },
		});

		mockAdd.mockRejectedValueOnce(new Error('Duplicate identifier'));

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();
		await wizard.adoptSelected();

		expect(mockAdd).toHaveBeenCalledTimes(1);
		expect(mockEdit).toHaveBeenCalledWith({
			id: 'device-uuid-2',
			data: expect.objectContaining({
				type: DEVICES_SHELLY_NG_TYPE,
				category: DevicesModuleDeviceCategory.lighting,
				name: 'Kitchen relay',
			}),
		});
		expect(wizard.adoptionResults.value).toEqual([
			expect.objectContaining({
				hostname: '192.168.1.10',
				status: 'updated',
			}),
		]);
	});

	it('refreshes the editable name when a device transitions from checking to already_registered', async () => {
		const racedSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'already_registered',
					registeredDeviceId: 'device-uuid-3',
					registeredDeviceName: 'Auto-adopted by main service',
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: checkingDiscoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: racedSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startDiscovery();

		// Placeholder during checking — no registered name available yet.
		expect(wizard.nameByHostname['192.168.1.10']).toBe('192.168.1.10');

		await wizard.refreshDiscovery();

		// On checking → already_registered, the name field picks up registeredDeviceName so
		// opting in to update doesn't accidentally overwrite the existing name with the hostname.
		expect(wizard.nameByHostname['192.168.1.10']).toBe('Auto-adopted by main service');
	});

	it('starts scan progress at 0 even when the client clock is skewed from server timestamps', async () => {
		// The discoverySession says scan started at 2026-04-29T12:00:00Z. The client clock is
		// in 2030 — a previous client-clock-based implementation would have read elapsed as years
		// and stayed at 100% (or 0% if behind). Receipt-anchored logic returns 0% on receipt.
		vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();
		await wizard.startDiscovery();

		expect(wizard.scanPercentage.value).toBe(0);
	});

	it('jumps scan progress to 100 when the session finishes', async () => {
		const finishedSession: IShellyNgDiscoverySession = {
			...discoverySession,
			status: 'finished',
			remainingSeconds: 0,
		};

		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: finishedSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();
		await wizard.startDiscovery();
		await wizard.refreshDiscovery();

		expect(wizard.scanPercentage.value).toBe(100);
	});
});
