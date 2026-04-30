import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from '../devices-zigbee2mqtt.constants';
import type { ApiWizardSession } from '../utils/wizard.transformers';

import { useDevicesWizard } from './useDevicesWizard';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	DELETE: vi.fn(),
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
		useBackend: () => ({
			client: backendClient,
		}),
		useFlashMessage: () => ({
			error: vi.fn(),
			success: vi.fn(),
		}),
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
	categories: [DevicesModuleDeviceCategory.sensor],
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

describe('useDevicesWizard', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('starts session and pre-fills humanized names plus suggested categories for ready devices', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startSession();

		expect(backendClient.POST).toHaveBeenCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard`);
		expect(wizard.session.value?.id).toBe('session-1');
		expect(wizard.bridgeOnline.value).toBe(true);
		// Humanized name: snake_case -> Title Case.
		expect(wizard.nameByIeee['0x00158d0001a2b3c4']).toBe('Kitchen Motion Sensor');
		expect(wizard.categoryByIeee['0x00158d0001a2b3c4']).toBe(DevicesModuleDeviceCategory.sensor);
		expect(wizard.selected['0x00158d0001a2b3c4']).toBe(true);
		expect(wizard.canContinue.value).toBe(true);
	});

	it('deselects a previously ready device when polling reports it as already_registered', async () => {
		const racedSession: ApiWizardSession = {
			...wizardSession,
			devices: [
				{
					...baseDevice,
					status: 'already_registered',
					registeredDeviceId: 'device-uuid-mid-session',
					registeredDeviceName: 'Auto-adopted relay',
					registeredDeviceCategory: DevicesModuleDeviceCategory.sensor,
				},
			],
		};

		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.GET.mockResolvedValue({
			data: { data: racedSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startSession();
		expect(wizard.selected['0x00158d0001a2b3c4']).toBe(true);

		await wizard.refreshSession();

		expect(wizard.selected['0x00158d0001a2b3c4']).toBe(false);
		expect(wizard.canContinue.value).toBe(false);
	});

	it('canContinue is false when any selected device has an empty name', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startSession();

		expect(wizard.canContinue.value).toBe(true);

		wizard.nameByIeee['0x00158d0001a2b3c4'] = '   ';

		expect(wizard.canContinue.value).toBe(false);
	});

	it('canContinue is false when any selected device has a null category', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startSession();

		expect(wizard.canContinue.value).toBe(true);

		wizard.categoryByIeee['0x00158d0001a2b3c4'] = null;

		expect(wizard.canContinue.value).toBe(false);
	});

	it('adoptSelected POSTs the right body and returns the results array', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const adoptionResponse = {
			results: [
				{
					ieeeAddress: '0x00158d0001a2b3c4',
					name: 'Kitchen Motion Sensor',
					status: 'created',
					error: null,
				},
			],
		};

		backendClient.POST.mockResolvedValueOnce({
			data: { data: adoptionResponse },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();

		await wizard.startSession();

		const results = await wizard.adoptSelected();

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
							name: 'Kitchen Motion Sensor',
							category: DevicesModuleDeviceCategory.sensor,
						},
					],
				},
			},
		});

		expect(results).toEqual([
			expect.objectContaining({
				ieeeAddress: '0x00158d0001a2b3c4',
				name: 'Kitchen Motion Sensor',
				status: 'created',
			}),
		]);
		expect(wizard.adoptionResults.value).toEqual(results);
	});

	it('enablePermitJoin POSTs and updates permitJoin from the response', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: wizardSession },
			response: { status: 200 },
		});

		const permitJoinSession: ApiWizardSession = {
			...wizardSession,
			permitJoin: {
				active: true,
				expiresAt: '2026-04-29T12:04:14.000Z',
				remainingSeconds: 254,
			},
		};

		backendClient.POST.mockResolvedValueOnce({
			data: { data: permitJoinSession },
			response: { status: 200 },
		});

		const wizard = useDevicesWizard();
		await wizard.startSession();

		expect(wizard.permitJoin.value.active).toBe(false);

		await wizard.enablePermitJoin();

		expect(backendClient.POST).toHaveBeenLastCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/permit-join`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
		expect(wizard.permitJoin.value.active).toBe(true);
		expect(wizard.permitJoin.value.remainingSeconds).toBe(254);
	});

	it('endSession DELETEs the session and clears reactive state', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: wizardSession },
			response: { status: 200 },
		});
		backendClient.DELETE.mockResolvedValue({
			data: undefined,
			response: { status: 204 },
		});

		const wizard = useDevicesWizard();
		await wizard.startSession();

		expect(wizard.session.value).not.toBeNull();
		expect(Object.keys(wizard.selected).length).toBe(1);

		await wizard.endSession();

		expect(backendClient.DELETE).toHaveBeenCalledWith(`/plugins/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: {
				path: {
					id: 'session-1',
				},
			},
		});
		expect(wizard.session.value).toBeNull();
		expect(Object.keys(wizard.selected).length).toBe(0);
		expect(Object.keys(wizard.nameByIeee).length).toBe(0);
		expect(Object.keys(wizard.categoryByIeee).length).toBe(0);
	});
});
