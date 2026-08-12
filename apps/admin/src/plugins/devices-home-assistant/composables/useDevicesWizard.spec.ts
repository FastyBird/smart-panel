import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IWizardBannerControl } from '../../../modules/devices';
import {
	DevicesHomeAssistantPluginDataWizardCandidateKind,
	DevicesHomeAssistantPluginDataWizardCandidateStatus,
	type DevicesHomeAssistantPluginWizardSessionSchema,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';

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

const devicesStore = { fetch: vi.fn() };
const discoveredDevicesStore = { fetch: vi.fn() };
const discoveredHelpersStore = { fetch: vi.fn() };
const stores = [devicesStore, discoveredDevicesStore, discoveredHelpersStore];

vi.mock('vue-i18n', () => ({
	createI18n: () => ({
		global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => undefined },
	}),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({ getStore: vi.fn(() => stores.shift()) }),
		useBackend: () => ({ client: backendClient }),
		useFlashMessage: () => flashMessage,
		useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
	};
});

const readyCandidate = {
	key: 'device:ha-device-1',
	kind: DevicesHomeAssistantPluginDataWizardCandidateKind.device,
	sourceId: 'ha-device-1',
	name: 'Living room lamp',
	manufacturer: 'Philips',
	model: 'Hue',
	status: DevicesHomeAssistantPluginDataWizardCandidateStatus.ready,
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	previewChannelCount: 2,
	warningCount: 0,
	adoptedDeviceId: null,
	error: null,
};

const wizardSession: DevicesHomeAssistantPluginWizardSessionSchema = {
	id: 'session-1',
	startedAt: '2026-08-12T10:00:00.000Z',
	candidates: [readyCandidate],
};

describe('useDevicesWizard', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		stores.splice(0, stores.length, devicesStore, discoveredDevicesStore, discoveredHelpersStore);
		devicesStore.fetch.mockResolvedValue([]);
		discoveredDevicesStore.fetch.mockResolvedValue([]);
		discoveredHelpersStore.fetch.mockResolvedValue([]);
		backendClient.GET.mockResolvedValue({ data: { data: wizardSession }, response: { status: 200 } });
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('starts a selection-only bulk session and maps ready candidates', async () => {
		backendClient.POST.mockResolvedValue({ data: { data: wizardSession }, response: { status: 201 } });
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.confirmationMode).toBe('selection-only');
		expect(adapter.ready.value).toBe(true);
		expect(adapter.rows.value[0]).toEqual(
			expect.objectContaining({
				key: 'device:ha-device-1',
				label: 'Living room lamp',
				identifier: 'ha-device-1',
				status: 'ready',
				adoptable: true,
				selectedByDefault: false,
				suggestedCategory: DevicesModuleDeviceCategory.lighting,
			})
		);
	});

	it('keeps candidates requiring review unavailable and links to controlled adoption', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: {
					...wizardSession,
					candidates: [
						{
							...readyCandidate,
							status: DevicesHomeAssistantPluginDataWizardCandidateStatus.needs_attention,
							warningCount: 1,
						},
					],
				},
			},
			response: { status: 201 },
		});
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value[0]).toEqual(expect.objectContaining({ status: 'needs_attention', adoptable: false, selectedByDefault: false }));
		const banner = adapter.controls.value[0] as IWizardBannerControl;
		expect(banner.id).toBe('manual-review');
		expect(banner.link?.to).toEqual({ name: 'devices_module-devices_add' });
	});

	it('sends only selected candidate keys to bulk adoption', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: { data: wizardSession }, response: { status: 201 } });
		backendClient.POST.mockResolvedValueOnce({
			data: {
				data: {
					results: [{ key: readyCandidate.key, name: readyCandidate.name, status: 'created', error: null }],
				},
			},
			response: { status: 200 },
		});
		const adapter = useDevicesWizard();
		await adapter.start();

		const results = await adapter.adopt([{ key: readyCandidate.key, name: 'Ignored override', category: DevicesModuleDeviceCategory.generic }]);

		expect(backendClient.POST).toHaveBeenLastCalledWith(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard/{id}/adopt`, {
			params: { path: { id: 'session-1' } },
			body: { data: { keys: ['device:ha-device-1'] } },
		});
		expect(results).toEqual([
			{
				key: readyCandidate.key,
				name: readyCandidate.name,
				identifier: readyCandidate.sourceId,
				status: 'created',
				error: null,
			},
		]);
		expect(devicesStore.fetch).toHaveBeenCalledTimes(1);
		expect(discoveredDevicesStore.fetch).toHaveBeenCalledTimes(1);
		expect(discoveredHelpersStore.fetch).toHaveBeenCalledTimes(1);
	});

	it('surfaces an isolated candidate mapping error in its status and tooltip', async () => {
		backendClient.POST.mockResolvedValue({
			data: {
				data: {
					...wizardSession,
					candidates: [
						{
							...readyCandidate,
							status: DevicesHomeAssistantPluginDataWizardCandidateStatus.failed,
							warningCount: 1,
							error: 'Home Assistant registry entry disappeared',
						},
					],
				},
			},
			response: { status: 201 },
		});
		const adapter = useDevicesWizard();

		await adapter.start();

		expect(adapter.rows.value[0].statusLabel).toBe('Home Assistant registry entry disappeared');
		expect(adapter.rows.value[0].cells?.channels).toEqual(expect.objectContaining({ tooltip: 'Home Assistant registry entry disappeared' }));
	});

	it('shows an actionable configuration banner when the inventory cannot be loaded', async () => {
		backendClient.POST.mockResolvedValue({
			data: undefined,
			error: { message: 'Home Assistant is offline' },
			response: { status: 503 },
		});
		const adapter = useDevicesWizard();

		await expect(adapter.start()).rejects.toThrow();

		expect(adapter.ready.value).toBe(true);
		const banner = adapter.controls.value[0] as IWizardBannerControl;
		expect(banner.id).toBe('connection-error');
		expect(banner.link?.to).toEqual({
			name: 'config_module-config_plugin_edit',
			params: { plugin: 'devices-home-assistant-plugin' },
		});
	});

	it('clears the busy state and shows a retry banner when session transport rejects', async () => {
		backendClient.POST.mockRejectedValueOnce(new Error('Backend unreachable'));
		const adapter = useDevicesWizard();

		await expect(adapter.start()).rejects.toThrow('Backend unreachable');

		expect(adapter.busy.value).toBe(false);
		expect(adapter.ready.value).toBe(true);
		expect((adapter.controls.value[0] as IWizardBannerControl).message).toBe('Backend unreachable');
	});

	it('clears the busy state when adoption transport rejects', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: { data: wizardSession }, response: { status: 201 } });
		backendClient.POST.mockRejectedValueOnce(new Error('Connection dropped'));
		const adapter = useDevicesWizard();
		await adapter.start();

		await expect(
			adapter.adopt([{ key: readyCandidate.key, name: readyCandidate.name, category: DevicesModuleDeviceCategory.generic }])
		).rejects.toThrow('Connection dropped');

		expect(adapter.busy.value).toBe(false);
	});

	it('rescans by replacing the server-side snapshot', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: { data: wizardSession }, response: { status: 201 } }).mockResolvedValueOnce({
			data: { data: { ...wizardSession, id: 'session-2' } },
			response: { status: 201 },
		});
		backendClient.DELETE.mockResolvedValue({ response: { status: 204 } });
		const adapter = useDevicesWizard();

		await adapter.start();
		expect(adapter.sessionKey?.value).toBe('session-1');
		const refresh = adapter.controls.value.find((control) => control.type === 'action' && control.id === 'refresh');
		expect(refresh?.type).toBe('action');
		if (refresh?.type === 'action') {
			await Promise.all([refresh.handler(), refresh.handler()]);
		}

		expect(backendClient.DELETE).toHaveBeenCalledWith(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: { path: { id: 'session-1' } },
		});
		expect(backendClient.POST).toHaveBeenCalledTimes(2);
		expect(adapter.sessionKey?.value).toBe('session-2');
	});

	it('keeps an open wizard session active while the administrator reviews candidates', async () => {
		backendClient.POST.mockResolvedValue({ data: { data: wizardSession }, response: { status: 201 } });
		const adapter = useDevicesWizard();

		await adapter.start();
		await vi.advanceTimersByTimeAsync(4 * 60_000);

		expect(backendClient.GET).toHaveBeenCalledWith(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: { path: { id: 'session-1' } },
		});
		await adapter.dispose?.();
	});

	it('deletes a session that arrives after the wizard has been disposed', async () => {
		let resolveStart: ((value: unknown) => void) | undefined;
		backendClient.POST.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveStart = resolve;
				})
		);
		backendClient.DELETE.mockResolvedValue({ response: { status: 204 } });
		const adapter = useDevicesWizard();

		const starting = adapter.start();
		await adapter.dispose?.();
		resolveStart?.({ data: { data: wizardSession }, response: { status: 201 } });
		await starting;
		await vi.advanceTimersByTimeAsync(4 * 60_000);

		expect(backendClient.DELETE).toHaveBeenCalledWith(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: { path: { id: 'session-1' } },
		});
		expect(backendClient.GET).not.toHaveBeenCalled();
	});
});
