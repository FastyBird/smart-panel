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

	it('falls through an empty reported name to the next candidate for the suggested name and label', async () => {
		// The schema permits `name: ''` (no `.min(1)`) — a device that reports a blank name must
		// not render a blank Name column or a blank name input, which would leave `canContinue`
		// false with no visible reason. `||` must fall through the same way `??` falls through
		// on `null`; a regression to `??` here would stop at the empty string instead.
		const blankNameSession: IShellyNgDiscoverySession = {
			...discoverySession,
			devices: [
				{
					...discoverySession.devices[0]!,
					name: '',
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: blankNameSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const [row] = adapter.rows.value;

		expect(row!.suggestedName).toBe('Shelly Plus 1');
		expect(row!.label).toBe('Shelly Plus 1');
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

	it('rejects a manual submit with a blank hostname instead of silently ignoring it', async () => {
		// The old component disabled the Add button on a blank hostname. The shared form control
		// has no per-keystroke `submitDisabled`, so the button stays clickable — rejecting (not
		// resolving) is what makes the shell retain the rest of the form, including any password
		// the user already typed, instead of silently clearing it.
		backendClient.POST.mockResolvedValue({
			data: { data: emptySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		backendClient.POST.mockClear();

		await expect(
			findControl<IWizardFormControl>(adapter.controls.value, 'manual').handler({ hostname: '   ', password: 'secret' })
		).rejects.toThrow();

		expect(backendClient.POST).not.toHaveBeenCalled();
		expect(flashMessage.error).toHaveBeenCalled();
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

	it('exposes a fresh session key on rescan so the shell drops the previous scan selections', async () => {
		// Shelly declares no `addMore`, so "Scan again" never routes through the shell's
		// `onAddMore` reset. The session key is the only signal the shell gets that scan 2 has
		// begun — without it, a device that was `ready` in scan 1 and returns as
		// `already_registered` in scan 2 stays ticked and silently overwrites its stored name.
		backendClient.POST.mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		}).mockResolvedValueOnce({
			data: { data: { ...discoverySession, id: 'session-2' } },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		expect(adapter.sessionKey?.value).toBeNull();

		await adapter.start();

		expect(adapter.sessionKey?.value).toBe('session-1');

		await adapter.start();

		expect(adapter.sessionKey?.value).toBe('session-2');
	});

	it('keeps the session key stable across a polling refresh', async () => {
		// Only a genuinely new session may reset the shell's state — an ordinary poll must not.
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

		expect(adapter.sessionKey?.value).toBe('session-1');
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

	it('stops polling once the backend reports the session is gone', async () => {
		// A 404 is definitive: the backend garbage-collected the session and it will never come
		// back, so there is no point re-hitting a missing endpoint every second until the
		// component unmounts. The user can hit "Scan again" to start a fresh one. Swallowing it
		// and continuing never self-heals either — `applySession` never runs, so the session
		// status stays `running` and the non-running `stopPolling()` escape never fires.
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: undefined,
			error: { error: 'not found' },
			response: { status: 404 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await vi.advanceTimersByTimeAsync(1_000);
		expect(backendClient.GET).toHaveBeenCalledTimes(1);

		// The interval must NOT fire again — the 404 stopped it.
		await vi.advanceTimersByTimeAsync(2_000);
		expect(backendClient.GET).toHaveBeenCalledTimes(1);
	});

	it('keeps polling through a transient refresh failure', async () => {
		// A blip or a 5xx is not a dead session. Treating every failure as the 404 case would
		// permanently freeze an otherwise healthy scan on one dropped request.
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockRejectedValueOnce(new Error('network blip')).mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await vi.advanceTimersByTimeAsync(1_000);
		expect(backendClient.GET).toHaveBeenCalledTimes(1);

		// The scan survives the blip: it retries and the next snapshot lands. The gap widens after
		// a failure, so this asserts recovery rather than a fixed cadence.
		await vi.advanceTimersByTimeAsync(5_000);
		expect(backendClient.GET.mock.calls.length).toBeGreaterThan(1);
		expect(findControl<IWizardProgressControl>(adapter.controls.value, 'scan').percentage).toBeGreaterThanOrEqual(0);
		expect(adapter.rows.value.length).toBe(1);
	});

	it('keeps retrying past the nominal expiry and still picks up the final snapshot', async () => {
		// The backend keeps a finished session fetchable for five minutes
		// (FINISHED_SESSION_TTL_MS), so passing `remainingSeconds` is not a definitive failure.
		// Giving up at expiry during an outage strands the UI on stale devices and a `running`
		// status that never resolves, because the terminal snapshot is what stops polling.
		const finishedSession: IShellyNgDiscoverySession = {
			...discoverySession,
			status: 'finished',
			remainingSeconds: 0,
		};

		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockRejectedValue(new Error('network outage'));

		const adapter = useDevicesWizard();

		await adapter.start();

		// Outage spans the whole 30s window and beyond.
		await vi.advanceTimersByTimeAsync(60_000);

		// Connectivity returns well after expiry — the final snapshot must still be fetched.
		backendClient.GET.mockResolvedValue({
			data: { data: finishedSession },
			response: { status: 200 },
		});

		await vi.advanceTimersByTimeAsync(60_000);

		// The terminal snapshot landed: the scan reads as complete rather than perpetually running.
		expect(findControl<IWizardProgressControl>(adapter.controls.value, 'scan').percentage).toBe(100);

		// And polling stopped on its own, because the session is no longer running.
		backendClient.GET.mockClear();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(backendClient.GET).not.toHaveBeenCalled();
	});

	it('backs off while the backend is unreachable instead of polling every second', async () => {
		// Never giving up must not mean hammering: an unreachable backend should see a widening
		// gap, not one request per second for as long as the wizard stays open.
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockRejectedValue(new Error('backend down'));

		const adapter = useDevicesWizard();

		await adapter.start();

		await vi.advanceTimersByTimeAsync(60_000);

		// One request per second would be 60; backoff must keep it far below that.
		expect(backendClient.GET.mock.calls.length).toBeLessThan(15);
		expect(backendClient.GET.mock.calls.length).toBeGreaterThan(3);
	});

	it('returns to the normal cadence once polling recovers', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockRejectedValueOnce(new Error('blip'))
			.mockRejectedValueOnce(new Error('blip'))
			.mockResolvedValue({
				data: { data: discoverySession },
				response: { status: 200 },
			});

		const adapter = useDevicesWizard();

		await adapter.start();

		// Ride out the two failures and the recovery.
		await vi.advanceTimersByTimeAsync(10_000);
		const afterRecovery = backendClient.GET.mock.calls.length;

		// Back at a 1s cadence, ten more seconds is roughly ten more polls.
		await vi.advanceTimersByTimeAsync(10_000);

		expect(backendClient.GET.mock.calls.length - afterRecovery).toBeGreaterThanOrEqual(8);
	});

	it('restores polling and clears the busy flag when the rescan request rejects outright', async () => {
		// `openapi-fetch` rethrows a transport failure rather than returning `{ error, response }`,
		// so execution leaves `startDiscovery` at the await. The interval was already stopped and
		// `formResult` is still WORKING — without recovery the wizard is frozen behind a spinner
		// that never resolves, with the retained session no longer updating.
		backendClient.POST.mockResolvedValueOnce({
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
		expect(backendClient.GET).toHaveBeenCalledTimes(1);

		backendClient.POST.mockRejectedValueOnce(new Error('backend unreachable'));
		await expect(adapter.start()).rejects.toThrow('backend unreachable');

		expect(adapter.busy.value).toBe(false);

		await vi.advanceTimersByTimeAsync(1_000);
		expect(backendClient.GET).toHaveBeenCalledTimes(2);
	});

	it('drops a poll response that resolves after a rescan replaced the session', async () => {
		// The poll interval fires against session A, then the user hits "Scan again". If the
		// in-flight GET for A resolves after the POST installed session B, applying it would
		// clobber B — and polling would then run against a session the backend already finished,
		// so `applySession` stops the timer and the new scan is orphaned with the UI showing the
		// old one. The user sees "Scan again" apparently do nothing.
		const sessionB: IShellyNgDiscoverySession = { ...discoverySession, id: 'session-2' };

		backendClient.POST.mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		let releaseStalePoll: (() => void) | undefined;
		backendClient.GET.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					releaseStalePoll = (): void =>
						resolve({
							data: { data: discoverySession },
							response: { status: 200 },
						});
				})
		);

		const adapter = useDevicesWizard();

		await adapter.start();
		expect(adapter.sessionKey?.value).toBe('session-1');

		// Poll for session A goes out and stays in flight.
		await vi.advanceTimersByTimeAsync(1_000);
		expect(typeof releaseStalePoll).toBe('function');

		// The user rescans; session B is installed while A's poll is still pending.
		backendClient.POST.mockResolvedValueOnce({
			data: { data: sessionB },
			response: { status: 200 },
		});
		await adapter.start();
		expect(adapter.sessionKey?.value).toBe('session-2');

		// A's response finally lands. It must be dropped, not applied.
		releaseStalePoll?.();
		await vi.advanceTimersByTimeAsync(0);

		expect(adapter.sessionKey?.value).toBe('session-2');
	});

	it('keeps polling the retained session when a rescan fails to start', async () => {
		// "Scan again" stops the interval before its POST so no poll targets the session being
		// replaced. If that POST then fails, the old session stays on screen — and must stay
		// live. Leaving it stopped freezes the snapshot while the backend session is very much
		// still discovering, so the table silently stops updating with no visible cause.
		backendClient.POST.mockResolvedValueOnce({
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
		expect(backendClient.GET).toHaveBeenCalledTimes(1);

		backendClient.POST.mockResolvedValueOnce({
			data: undefined,
			error: { error: 'boom' },
			response: { status: 500 },
		});
		await expect(adapter.start()).rejects.toThrow();

		// The retained session must still be polled.
		await vi.advanceTimersByTimeAsync(1_000);
		expect(backendClient.GET).toHaveBeenCalledTimes(2);
	});

	it('does not let a stale poll rejection stop the replacement session polling', async () => {
		// A rejected GET skips everything after its `await`, so `refreshDiscovery`'s generation
		// check never runs and the rejection reaches the interval's catch. That catch calls
		// `stopPolling()` on the shared timer handle — which by then belongs to session B, not to
		// the session whose poll just failed. B would be installed and never polled again.
		const sessionB: IShellyNgDiscoverySession = { ...discoverySession, id: 'session-2' };

		backendClient.POST.mockResolvedValueOnce({
			data: { data: discoverySession },
			response: { status: 200 },
		});

		let rejectStalePoll: (() => void) | undefined;
		backendClient.GET.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectStalePoll = (): void => reject(new Error('session not found'));
				})
		);

		const adapter = useDevicesWizard();

		await adapter.start();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(typeof rejectStalePoll).toBe('function');

		backendClient.POST.mockResolvedValueOnce({
			data: { data: sessionB },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: sessionB },
			response: { status: 200 },
		});
		await adapter.start();

		// Session A's poll now fails, long after A stopped being the current session.
		rejectStalePoll?.();
		await vi.advanceTimersByTimeAsync(0);

		backendClient.GET.mockClear();
		await vi.advanceTimersByTimeAsync(1_000);

		expect(backendClient.GET).toHaveBeenCalledTimes(1);
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

	it('adopts a device that the refresh inside adopt dropped from the session entirely', async () => {
		// The refresh at the top of `adopt` can return a session that no longer lists the device
		// — the scan expired it, or it stopped answering mDNS. The shell's selection carries only
		// key / name / category, so without the pre-refresh descriptor snapshot we would lose the
		// identifier and fail a device the user explicitly asked for.
		backendClient.POST.mockResolvedValue({
			data: { data: discoverySession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: emptySession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const results = await adapter.adopt([{ key: '192.168.1.10', name: 'Kitchen relay', category: DevicesModuleDeviceCategory.lighting }]);

		expect(mockAdd).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					identifier: 'shellyplus1-aabbcc',
					name: 'Kitchen relay',
					wifiAddress: '192.168.1.10',
				}),
			})
		);
		expect(results).toEqual([
			expect.objectContaining({
				key: '192.168.1.10',
				status: 'created',
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
