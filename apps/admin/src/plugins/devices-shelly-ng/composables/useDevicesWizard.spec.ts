import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IWizardActionControl, IWizardFormControl, IWizardProgressControl } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import type { IShellyNgDiscoverySession } from '../schemas/devices.types';

import { useDevicesWizard } from './useDevicesWizard';

const mockAdd = vi.fn();
const mockEdit = vi.fn();
const mockGet = vi.fn();
const mockFindById = vi.fn();

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

const flashMessage = {
	error: vi.fn(),
	success: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		// Interpolation params are appended so tests can assert on the values the adapter
		// feeds into the translated strings (the discovered device count, …).
		t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
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
				get: mockGet,
				findById: mockFindById,
			}),
		}),
		useBackend: () => ({
			client: backendClient,
		}),
		useFlashMessage: () => flashMessage,
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
			registeredDeviceCategory: null,
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

const emptySession: IShellyNgDiscoverySession = {
	...discoverySession,
	devices: [],
};

const findControl = <T extends { id: string }>(controls: { id: string }[], id: string): T => {
	const control = controls.find((item) => item.id === id);

	if (control === undefined) {
		throw new Error(`Expected a wizard control with id "${id}"`);
	}

	return control as T;
};

describe('useDevicesWizard', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mockAdd.mockResolvedValue(undefined);
		mockEdit.mockResolvedValue(undefined);
		mockGet.mockResolvedValue(undefined);
		mockFindById.mockReturnValue({ id: 'placeholder' });
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('starts discovery and maps a discovered device to a wizard row', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: discoverySession,
			},
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(backendClient.POST).toHaveBeenCalledWith(`/plugins/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery`);

		const [row] = adapter.rows.value;

		expect(row).toBeDefined();
		expect(row!.key).toBe('192.168.1.10');
		expect(row!.identifier).toBe('192.168.1.10');
		expect(row!.label).toBe('Kitchen relay');
		expect(row!.subLabel).toBe('Shelly Plus 1');
		expect(row!.status).toBe('ready');
		expect(row!.adoptable).toBe(true);
		expect(row!.willUpdate).toBe(false);
		expect(row!.suggestedName).toBe('Kitchen relay');
		expect(row!.suggestedCategory).toBe(DevicesModuleDeviceCategory.lighting);
	});

	it('renames the needs_password status to needs_credentials', async () => {
		const protectedSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'needs_password',
					authentication: { enabled: true, domain: 'shelly' },
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: protectedSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value[0]!.status).toBe('needs_credentials');
		expect(adapter.rows.value[0]!.adoptable).toBe(false);
	});

	it('narrows category options per device', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		// The Plus 1 descriptor supports exactly these two — the wizard must not offer the
		// full DeviceCategory enum the way Zigbee2MQTT does.
		expect(adapter.rows.value[0]!.categoryOptions.map((option) => option.value)).toEqual([
			DevicesModuleDeviceCategory.lighting,
			DevicesModuleDeviceCategory.switcher,
		]);
	});

	it('offers no category options for a device that is still being inspected', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: checkingDiscoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value[0]!.categoryOptions).toEqual([]);
	});

	it('marks an already registered device as an update and prefers its stored name and category', async () => {
		// A Plus 1 supports both `lighting` and `switcher`, so the descriptor leaves
		// `suggestedCategory` null. Without `registeredDeviceCategory` the confirm step would
		// land on an empty selector even though we already chose a category when adopting.
		const alreadyRegisteredSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'already_registered',
					suggestedCategory: null,
					registeredDeviceId: 'device-uuid-1',
					registeredDeviceName: 'Existing kitchen relay',
					registeredDeviceCategory: DevicesModuleDeviceCategory.switcher,
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: alreadyRegisteredSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const [row] = adapter.rows.value;

		expect(row!.status).toBe('already_registered');
		expect(row!.adoptable).toBe(true);
		expect(row!.willUpdate).toBe(true);
		expect(row!.suggestedName).toBe('Existing kitchen relay');
		expect(row!.suggestedCategory).toBe(DevicesModuleDeviceCategory.switcher);
	});

	it('offers a manual-add form control', () => {
		const adapter = useDevicesWizard();

		expect(adapter.controls.value).toContainEqual(
			expect.objectContaining({
				type: 'form',
				id: 'manual',
				fields: [expect.objectContaining({ key: 'hostname' }), expect.objectContaining({ key: 'password', secret: true })],
			})
		);
	});

	it('does not declare the addMore capability', () => {
		const adapter = useDevicesWizard();

		expect(adapter.capabilities.addMore).toBe(false);
		expect(adapter.restart).toBeUndefined();
	});

	it('adds a manual lookup to an existing discovery session through the form control', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: emptySession },
			response: { status: 200 },
		}).mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await findControl<IWizardFormControl>(adapter.controls.value, 'manual').handler({ hostname: '192.168.1.10', password: 'secret' });

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
		expect(adapter.rows.value).toHaveLength(1);
	});

	it('trims the manual hostname and treats a blank password as absent', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: emptySession },
			response: { status: 200 },
		}).mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await findControl<IWizardFormControl>(adapter.controls.value, 'manual').handler({ hostname: '  192.168.1.10  ', password: '   ' });

		expect(backendClient.POST).toHaveBeenLastCalledWith(
			`/plugins/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery/{id}/manual`,
			expect.objectContaining({
				body: {
					data: {
						hostname: '192.168.1.10',
						password: null,
					},
				},
			})
		);
	});

	it('ignores a manual submit with a blank hostname', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: emptySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		backendClient.POST.mockClear();

		await findControl<IWizardFormControl>(adapter.controls.value, 'manual').handler({ hostname: '   ', password: 'secret' });

		expect(backendClient.POST).not.toHaveBeenCalled();
	});

	it('rejects a failed manual add so the shell keeps what the user typed', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: emptySession },
			response: { status: 200 },
		}).mockResolvedValueOnce({
			data: undefined,
			error: undefined,
			response: { status: 502 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await expect(
			findControl<IWizardFormControl>(adapter.controls.value, 'manual').handler({ hostname: '192.168.1.10', password: 'secret' })
		).rejects.toThrow();
		expect(flashMessage.error).toHaveBeenCalled();
	});

	it('hands the manually entered password over to the created device', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: emptySession },
			response: { status: 200 },
		}).mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await findControl<IWizardFormControl>(adapter.controls.value, 'manual').handler({ hostname: '192.168.1.10', password: 'secret' });

		await adapter.adopt([{ key: '192.168.1.10', name: 'Kitchen relay', category: DevicesModuleDeviceCategory.lighting }]);

		expect(mockAdd).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					password: 'secret',
					wifiAddress: '192.168.1.10',
				}),
			})
		);
	});

	it('drops a manually entered password when the user rescans', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: emptySession },
			response: { status: 200 },
		})
			.mockResolvedValueOnce({
				data: { data: discoverySession },
				response: { status: 200 },
			})
			.mockResolvedValueOnce({
				data: { data: discoverySession },
				response: { status: 200 },
			});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await findControl<IWizardFormControl>(adapter.controls.value, 'manual').handler({ hostname: '192.168.1.10', password: 'secret' });

		// Rescanning opens a brand new session — the password belonged to the old one and must
		// not silently travel with the device into the next adoption.
		await adapter.start();

		await adapter.adopt([{ key: '192.168.1.10', name: 'Kitchen relay', category: DevicesModuleDeviceCategory.lighting }]);

		expect(mockAdd).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					password: null,
				}),
			})
		);
	});

	it('promotes polling placeholders when discovered devices become ready', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: checkingDiscoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value[0]!.status).toBe('checking');
		expect(adapter.rows.value[0]!.adoptable).toBe(false);
		expect(adapter.rows.value[0]!.suggestedName).toBe('192.168.1.10');

		await vi.advanceTimersByTimeAsync(1_000);

		expect(adapter.rows.value[0]!.status).toBe('ready');
		expect(adapter.rows.value[0]!.adoptable).toBe(true);
		expect(adapter.rows.value[0]!.suggestedName).toBe('Kitchen relay');
	});

	it('stops polling once the shell disposes the adapter', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await vi.advanceTimersByTimeAsync(1_000);

		expect(backendClient.GET).toHaveBeenCalled();

		await adapter.dispose?.();
		backendClient.GET.mockClear();

		await vi.advanceTimersByTimeAsync(5_000);

		expect(backendClient.GET).not.toHaveBeenCalled();
	});

	it('adopts the selection handed over by the shell through the devices store', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const results = await adapter.adopt([{ key: '192.168.1.10', name: 'Kitchen relay', category: DevicesModuleDeviceCategory.lighting }]);

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
		expect(results).toEqual([
			{
				key: '192.168.1.10',
				name: 'Kitchen relay',
				identifier: '192.168.1.10',
				status: 'created',
				error: null,
			},
		]);
		expect(adapter.results.value).toEqual(results);
	});

	it('adopts with the name and category the shell hands over, not the discovered ones', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.adopt([{ key: '192.168.1.10', name: 'Hallway light', category: DevicesModuleDeviceCategory.switcher }]);

		expect(mockAdd).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: 'Hallway light',
					category: DevicesModuleDeviceCategory.switcher,
				}),
			})
		);
	});

	it('falls back to the suggested name when the shell hands over a blank one', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.adopt([{ key: '192.168.1.10', name: '   ', category: DevicesModuleDeviceCategory.lighting }]);

		expect(mockAdd).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: 'Kitchen relay',
				}),
			})
		);
	});

	it('updates an already registered device via edit instead of creating a duplicate', async () => {
		const alreadyRegisteredSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'already_registered',
					registeredDeviceId: 'device-uuid-1',
					registeredDeviceName: 'Existing kitchen relay',
					registeredDeviceCategory: DevicesModuleDeviceCategory.lighting,
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

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.adopt([{ key: '192.168.1.10', name: 'Existing kitchen relay', category: DevicesModuleDeviceCategory.switcher }]);

		expect(mockEdit).toHaveBeenCalledWith({
			id: 'device-uuid-1',
			data: expect.objectContaining({
				type: DEVICES_SHELLY_NG_TYPE,
				category: DevicesModuleDeviceCategory.switcher,
				name: 'Existing kitchen relay',
			}),
		});
		expect(mockAdd).not.toHaveBeenCalled();
		expect(adapter.results.value).toEqual([
			expect.objectContaining({
				key: '192.168.1.10',
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
		// First refresh in adopt: still shows the snapshot's `ready` status.
		// Second refresh (after add fails): shows the device now exists.
		backendClient.GET.mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		}).mockResolvedValue({
			data: { data: racedSession },
			response: { status: 200 },
		});

		mockAdd.mockRejectedValueOnce(new Error('Duplicate identifier'));

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.adopt([{ key: '192.168.1.10', name: 'Kitchen relay', category: DevicesModuleDeviceCategory.lighting }]);

		expect(mockAdd).toHaveBeenCalledTimes(1);
		expect(mockEdit).toHaveBeenCalledWith({
			id: 'device-uuid-2',
			data: expect.objectContaining({
				type: DEVICES_SHELLY_NG_TYPE,
				category: DevicesModuleDeviceCategory.lighting,
				name: 'Kitchen relay',
			}),
		});
		expect(adapter.results.value).toEqual([
			expect.objectContaining({
				key: '192.168.1.10',
				status: 'updated',
			}),
		]);
	});

	it('loads the device into the local store before editing if it was just auto-adopted', async () => {
		const racedSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'already_registered',
					registeredDeviceId: 'device-uuid-fresh',
					registeredDeviceName: 'Auto-adopted relay',
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: racedSession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: racedSession },
			response: { status: 200 },
		});

		// Device exists in the backend (already_registered) but not yet in the admin store —
		// `devicesStore.edit` would otherwise reject the id.
		mockFindById.mockReturnValue(null);

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.adopt([{ key: '192.168.1.10', name: 'Auto-adopted relay', category: DevicesModuleDeviceCategory.switcher }]);

		expect(mockGet).toHaveBeenCalledWith({ id: 'device-uuid-fresh' });
		expect(mockEdit).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'device-uuid-fresh',
			})
		);
		expect(adapter.results.value).toEqual([
			expect.objectContaining({
				key: '192.168.1.10',
				status: 'updated',
			}),
		]);
	});

	it('still adopts a device the shell selected if the refresh inside adopt flips it to already_registered', async () => {
		const racedSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					status: 'already_registered',
					registeredDeviceId: 'device-uuid-in-flight',
					registeredDeviceName: 'Auto-adopted relay',
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		// The refresh at the top of `adopt` reports the status flip.
		backendClient.GET.mockResolvedValue({
			data: { data: racedSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		// The user chose the device while it was still `ready`; the shell handed that intent over.
		await adapter.adopt([{ key: '192.168.1.10', name: 'Kitchen relay', category: DevicesModuleDeviceCategory.lighting }]);

		expect(mockEdit).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'device-uuid-in-flight',
			})
		);
		expect(mockAdd).not.toHaveBeenCalled();
		expect(adapter.results.value).toEqual([
			expect.objectContaining({
				key: '192.168.1.10',
				status: 'updated',
			}),
		]);
	});

	it('reports a failed outcome instead of throwing when adoption fails', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		mockAdd.mockRejectedValue(new Error('Backend refused the device'));

		const adapter = useDevicesWizard();

		await adapter.start();

		const results = await adapter.adopt([{ key: '192.168.1.10', name: 'Kitchen relay', category: DevicesModuleDeviceCategory.lighting }]);

		expect(results).toEqual([
			expect.objectContaining({
				key: '192.168.1.10',
				status: 'failed',
				error: 'Backend refused the device',
			}),
		]);
	});

	it('reports the discovered device count and scan progress through the progress control', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const progress = findControl<IWizardProgressControl>(adapter.controls.value, 'scan');

		expect(progress.label).toBe('devicesShellyNgPlugin.texts.wizard.scanStatus:{"count":1}');
		expect(progress.visible).toBe(true);
		expect(progress.state).toBeUndefined();
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

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(findControl<IWizardProgressControl>(adapter.controls.value, 'scan').percentage).toBe(0);
	});

	it('jumps scan progress to 100 and flags success when the session finishes', async () => {
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

		const adapter = useDevicesWizard();

		await adapter.start();
		await vi.advanceTimersByTimeAsync(1_000);

		const progress = findControl<IWizardProgressControl>(adapter.controls.value, 'scan');

		expect(progress.percentage).toBe(100);
		expect(progress.state).toBe('success');
	});

	it('swallows a failed rescan so the shell never sees an unhandled rejection', async () => {
		backendClient.POST.mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { status: 500 },
		});

		const adapter = useDevicesWizard();

		// The discover step binds `@click="control.handler"` without awaiting the result, so the
		// action handler must never reject — unlike `start()`, which the shell awaits in a try.
		await expect(findControl<IWizardActionControl>(adapter.controls.value, 'restart-scan').handler()).resolves.toBeUndefined();
		expect(flashMessage.error).toHaveBeenCalled();

		await expect(adapter.start()).rejects.toThrow();
	});

	it('reports busy while a scan is in flight', async () => {
		let resolveDiscovery: (value: unknown) => void = () => undefined;

		backendClient.POST.mockReturnValue(
			new Promise((resolve) => {
				resolveDiscovery = resolve;
			})
		);

		const adapter = useDevicesWizard();

		expect(adapter.busy.value).toBe(false);
		expect(adapter.ready.value).toBe(true);

		const pending = adapter.start();

		expect(adapter.busy.value).toBe(true);
		expect(findControl<IWizardActionControl>(adapter.controls.value, 'restart-scan').loading).toBe(true);
		expect(findControl<IWizardFormControl>(adapter.controls.value, 'manual').submitDisabled).toBe(true);

		resolveDiscovery({ data: { data: discoverySession }, response: { status: 200 } });

		await pending;

		expect(adapter.busy.value).toBe(false);
	});
});
