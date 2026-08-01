import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IWizardActionControl, IWizardBannerControl, IWizardProgressControl } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from '../devices-zigbee2mqtt.constants';
import type { ApiWizardSession } from '../utils/wizard.transformers';

import { useDevicesWizard } from './useDevicesWizard';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	DELETE: vi.fn(),
};

const flashMessage = {
	error: vi.fn(),
	info: vi.fn(),
	success: vi.fn(),
	warning: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		// Interpolation params are appended so tests can assert on the values the adapter
		// feeds into the translated strings (channel counts, pairing countdown, …).
		t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useFlashMessage: () => flashMessage,
		useLogger: () => ({
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			debug: vi.fn(),
		}),
	};
});

const baseDevice = {
	ieeeAddress: '0x00158d0001a2b3c4',
	friendlyName: 'kitchen_motion_sensor',
	manufacturer: 'Aqara',
	model: 'RTCGQ11LM',
	description: 'Aqara human body sensor',
	status: 'ready' as const,
	suggestedCategory: DevicesModuleDeviceCategory.sensor,
	previewChannelCount: 2,
	previewChannelIdentifiers: ['occupancy', 'illuminance'],
	registeredDeviceId: null,
	registeredDeviceName: null,
	registeredDeviceCategory: null,
	error: null,
	lastSeenAt: '2026-04-29T12:00:01.000Z',
};

const wizardSession: ApiWizardSession = {
	id: 'session-1',
	bridgeOnline: true,
	startedAt: '2026-04-29T12:00:00.000Z',
	permitJoin: {
		active: false,
		expiresAt: null,
		remainingSeconds: 0,
	},
	devices: [baseDevice],
};

const pairingSession: ApiWizardSession = {
	...wizardSession,
	permitJoin: {
		active: true,
		expiresAt: '2026-04-29T12:04:14.000Z',
		remainingSeconds: 254,
	},
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
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('starts a session and reports it as ready', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		expect(adapter.ready.value).toBe(false);

		await adapter.start();

		expect(backendClient.POST).toHaveBeenCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard`);
		expect(adapter.ready.value).toBe(true);
		expect(adapter.busy.value).toBe(false);
	});

	it('maps a session device to a wizard row', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const [row] = adapter.rows.value;

		expect(row.key).toBe('0x00158d0001a2b3c4');
		expect(row.identifier).toBe('kitchen_motion_sensor');
		expect(row.label).toBe('Kitchen Motion Sensor');
		expect(row.subLabel).toBe('Aqara · RTCGQ11LM');
		expect(row.status).toBe('ready');
		expect(row.adoptable).toBe(true);
		expect(row.willUpdate).toBe(false);
		// Humanized name: snake_case -> Title Case.
		expect(row.suggestedName).toBe('Kitchen Motion Sensor');
		expect(row.suggestedCategory).toBe(DevicesModuleDeviceCategory.sensor);
		expect(row.categoryOptions.length).toBeGreaterThan(0);
	});

	it('prefers the registered name and category for an already adopted device', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: {
					...wizardSession,
					devices: [
						{
							...baseDevice,
							status: 'already_registered',
							registeredDeviceId: 'device-uuid',
							registeredDeviceName: 'Auto-adopted sensor',
							registeredDeviceCategory: DevicesModuleDeviceCategory.lighting,
						},
					],
				},
			},
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const [row] = adapter.rows.value;

		expect(row.status).toBe('already_registered');
		expect(row.adoptable).toBe(true);
		expect(row.willUpdate).toBe(true);
		expect(row.label).toBe('Auto-adopted sensor');
		expect(row.suggestedName).toBe('Auto-adopted sensor');
		expect(row.suggestedCategory).toBe(DevicesModuleDeviceCategory.lighting);
	});

	it('marks an unsupported device as not adoptable', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: { ...wizardSession, devices: [{ ...baseDevice, status: 'unsupported' }] } },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value[0].adoptable).toBe(false);
	});

	it('exposes the channel preview as a tag cell on the confirm step', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.columns).toEqual([expect.objectContaining({ key: 'channels', steps: ['confirm'] })]);
		expect(adapter.rows.value[0].cells?.channels).toEqual({
			render: 'tag',
			value: 'devicesZigbee2mqttPlugin.wizard.columns.channelsCount:{"count":2}',
			tooltip: 'occupancy, illuminance',
		});
	});

	it('declares the addMore capability and a restart handler', () => {
		const adapter = useDevicesWizard();

		expect(adapter.capabilities.addMore).toBe(true);
		expect(typeof adapter.restart).toBe('function');
		expect(typeof adapter.dispose).toBe('function');
		expect(typeof adapter.beforeLeaveDiscover).toBe('function');
	});

	it('surfaces a bridge-offline banner when the bridge is down', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: { ...wizardSession, bridgeOnline: false } },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.controls.value).toContainEqual(expect.objectContaining({ type: 'banner', severity: 'warning' }));

		const banner = findControl<IWizardBannerControl>(adapter.controls.value, 'bridge-offline');

		expect(banner.link?.to).toEqual({ name: 'config_module-config_plugin_edit', params: { plugin: 'devices-zigbee2mqtt-plugin' } });
		// Pairing is impossible while the bridge is down, so no pairing controls are offered.
		expect(adapter.controls.value.some((control) => control.type === 'action')).toBe(false);
	});

	it('offers no controls before the session is ready so the offline banner never flashes', () => {
		const adapter = useDevicesWizard();

		expect(adapter.ready.value).toBe(false);
		expect(adapter.controls.value).toEqual([]);
	});

	it('offers an enable-pairing action while permit join is inactive', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.controls.value).toContainEqual(expect.objectContaining({ type: 'action', id: 'permit-join', variant: 'primary' }));

		const action = findControl<IWizardActionControl>(adapter.controls.value, 'permit-join');

		expect(action.label).toBe('devicesZigbee2mqttPlugin.wizard.steps.discovery.permitJoin');
		expect(action.icon).toBe('mdi:plus-circle-outline');
		expect(findControl<IWizardProgressControl>(adapter.controls.value, 'pairing').visible).toBe(false);

		backendClient.POST.mockResolvedValueOnce({
			data: { data: pairingSession },
			response: { status: 200 },
		});

		await action.handler();

		expect(backendClient.POST).toHaveBeenLastCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/permit-join`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
	});

	it('switches the permit-join action to its cancel form once pairing is active', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: pairingSession },
			response: { status: 200 },
		});
		backendClient.DELETE.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const action = findControl<IWizardActionControl>(adapter.controls.value, 'permit-join');

		expect(action.variant).toBe('warning');
		expect(action.label).toBe('devicesZigbee2mqttPlugin.wizard.steps.discovery.cancelPairing');
		expect(action.icon).toBe('mdi:close-circle-outline');
		expect(findControl<IWizardProgressControl>(adapter.controls.value, 'pairing').visible).toBe(true);

		await action.handler();

		expect(backendClient.DELETE).toHaveBeenLastCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/permit-join`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
		expect(findControl<IWizardActionControl>(adapter.controls.value, 'permit-join').variant).toBe('primary');
	});

	it('flags the permit-join action as loading while the request is in flight', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		let resolveEnable: (value: unknown) => void = () => undefined;

		backendClient.POST.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveEnable = resolve;
				})
		);

		const pending = findControl<IWizardActionControl>(adapter.controls.value, 'permit-join').handler();

		await vi.advanceTimersByTimeAsync(0);

		expect(findControl<IWizardActionControl>(adapter.controls.value, 'permit-join').loading).toBe(true);
		expect(findControl<IWizardActionControl>(adapter.controls.value, 'permit-join').disabled).toBe(true);

		resolveEnable({ data: { data: pairingSession }, response: { status: 200 } });

		await pending;

		expect(findControl<IWizardActionControl>(adapter.controls.value, 'permit-join').loading).toBe(false);
	});

	it('releases the pending flag when enabling pairing fails', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.POST.mockResolvedValueOnce({
			data: undefined,
			error: { error: 'bridge unavailable' },
			response: { status: 503 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await findControl<IWizardActionControl>(adapter.controls.value, 'permit-join').handler();

		expect(flashMessage.error).toHaveBeenCalled();
		expect(findControl<IWizardActionControl>(adapter.controls.value, 'permit-join').loading).toBe(false);
	});

	it('ticks the pairing countdown between backend polls', async () => {
		// 133.5 s before the pairing window closes, so a sub-second tick still crosses a
		// whole-second boundary and proves the countdown is driven locally.
		vi.setSystemTime(new Date('2026-04-29T12:02:00.500Z'));

		backendClient.POST.mockResolvedValue({
			data: { data: pairingSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const progress = findControl<IWizardProgressControl>(adapter.controls.value, 'pairing');

		expect(progress.label).toBe('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingActive:{"remaining":134}');
		expect(progress.percentage).toBe(47);

		// Shorter than the 1 s poll interval — no backend round-trip may happen here.
		await vi.advanceTimersByTimeAsync(600);

		expect(backendClient.GET).not.toHaveBeenCalled();

		const ticked = findControl<IWizardProgressControl>(adapter.controls.value, 'pairing');

		expect(ticked.label).toBe('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingActive:{"remaining":133}');
		expect(ticked.percentage).toBe(48);
	});

	it('adopts the selection handed over by the shell and returns wizard results', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adoptionResponse = {
			results: [
				{
					ieeeAddress: '0x00158d0001a2b3c4',
					name: 'Kitchen PIR',
					status: 'created',
					error: null,
				},
			],
		};

		backendClient.POST.mockResolvedValueOnce({
			data: { data: adoptionResponse },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		const results = await adapter.adopt([{ key: '0x00158d0001a2b3c4', name: 'Kitchen PIR', category: DevicesModuleDeviceCategory.sensor }]);

		expect(backendClient.POST).toHaveBeenLastCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/adopt`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
			body: {
				data: {
					devices: [
						{
							ieeeAddress: '0x00158d0001a2b3c4',
							name: 'Kitchen PIR',
							category: DevicesModuleDeviceCategory.sensor,
						},
					],
				},
			},
		});

		expect(results).toEqual([
			{
				key: '0x00158d0001a2b3c4',
				name: 'Kitchen PIR',
				identifier: 'kitchen_motion_sensor',
				status: 'created',
				error: null,
			},
		]);
		expect(adapter.results.value).toEqual(results);
	});

	it('falls back to the humanized friendly name when the shell hands over a blank name', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.POST.mockResolvedValueOnce({
			data: { data: { results: [] } },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		await adapter.adopt([{ key: '0x00158d0001a2b3c4', name: '   ', category: DevicesModuleDeviceCategory.sensor }]);

		expect(backendClient.POST).toHaveBeenLastCalledWith(
			`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/adopt`,
			expect.objectContaining({
				body: {
					data: {
						devices: [expect.objectContaining({ name: 'Kitchen Motion Sensor' })],
					},
				},
			})
		);
	});

	it('refreshes the rows from the polled session', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: {
				data: {
					...wizardSession,
					devices: [baseDevice, { ...baseDevice, ieeeAddress: '0x00158d0009f8e7d6', friendlyName: 'hallway_switch' }],
				},
			},
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(1_000);

		expect(backendClient.GET).toHaveBeenCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
		expect(adapter.rows.value).toHaveLength(2);
	});

	it('drops a poll response that resolves after the session was disposed', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.DELETE.mockResolvedValue({
			data: undefined,
			response: { status: 204 },
		});

		let resolveGet: (value: unknown) => void = () => undefined;

		backendClient.GET.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveGet = resolve;
				})
		);

		const adapter = useDevicesWizard();

		await adapter.start();

		// Fire the scheduled poll; its GET stays in-flight.
		await vi.advanceTimersByTimeAsync(1_000);

		expect(backendClient.GET).toHaveBeenCalledTimes(1);

		await adapter.dispose?.();

		expect(adapter.ready.value).toBe(false);

		// The in-flight response lands after the session was deleted — it must be discarded
		// rather than resurrecting the session and looping on 404s.
		resolveGet({ data: { data: wizardSession }, response: { status: 200 } });

		await vi.advanceTimersByTimeAsync(0);

		expect(adapter.ready.value).toBe(false);
		expect(adapter.rows.value).toEqual([]);

		// …and no follow-up poll may be scheduled either.
		await vi.advanceTimersByTimeAsync(5_000);

		expect(backendClient.GET).toHaveBeenCalledTimes(1);
	});

	it('drops a start response that resolves after the session was disposed', async () => {
		let resolveStart: (value: unknown) => void = () => undefined;

		backendClient.POST.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveStart = resolve;
				})
		);

		const adapter = useDevicesWizard();

		const starting = adapter.start();

		await adapter.dispose?.();

		resolveStart({ data: { data: wizardSession }, response: { status: 200 } });

		await starting;

		expect(adapter.ready.value).toBe(false);
		expect(adapter.rows.value).toEqual([]);
	});

	it('disposes the session with a DELETE and clears the previous results', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.POST.mockResolvedValueOnce({
			data: { data: { results: [{ ieeeAddress: '0x00158d0001a2b3c4', name: 'Kitchen Motion Sensor', status: 'created', error: null }] } },
			response: { status: 200 },
		});
		backendClient.DELETE.mockResolvedValue({
			data: undefined,
			response: { status: 204 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.adopt([{ key: '0x00158d0001a2b3c4', name: 'Kitchen Motion Sensor', category: DevicesModuleDeviceCategory.sensor }]);

		expect(adapter.results.value).toHaveLength(1);

		await adapter.dispose?.();

		expect(backendClient.DELETE).toHaveBeenCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
		expect(adapter.ready.value).toBe(false);
		expect(adapter.rows.value).toEqual([]);
		expect(adapter.results.value).toEqual([]);
	});

	it('restart ends the previous session before opening a new one', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.DELETE.mockResolvedValue({
			data: undefined,
			response: { status: 204 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.restart?.();

		expect(backendClient.DELETE).toHaveBeenCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
		expect(backendClient.POST).toHaveBeenCalledTimes(2);
		// The new session must already be in place, otherwise the discover step re-mounts
		// against a null session and flashes the bridge-offline banner.
		expect(adapter.ready.value).toBe(true);
		expect(adapter.controls.value.some((control) => control.type === 'banner')).toBe(false);
	});

	it('closes an open pairing window before leaving the discover step', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: pairingSession },
			response: { status: 200 },
		});
		backendClient.DELETE.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.beforeLeaveDiscover?.();

		expect(backendClient.DELETE).toHaveBeenCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/permit-join`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
		expect(flashMessage.info).toHaveBeenCalledWith('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingDisabled');
	});

	it('leaves the discover step untouched when pairing is already closed', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adapter = useDevicesWizard();

		await adapter.start();
		await adapter.beforeLeaveDiscover?.();

		expect(backendClient.DELETE).not.toHaveBeenCalled();
		expect(flashMessage.info).not.toHaveBeenCalled();
	});
});
