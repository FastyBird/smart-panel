import { beforeEach, describe, expect, it, vi } from 'vitest';

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
		vi.clearAllMocks();
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
			await refresh.handler();
		}

		expect(backendClient.DELETE).toHaveBeenCalledWith(`/plugins/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: { path: { id: 'session-1' } },
		});
		expect(backendClient.POST).toHaveBeenCalledTimes(2);
		expect(adapter.sessionKey?.value).toBe('session-2');
	});
});
