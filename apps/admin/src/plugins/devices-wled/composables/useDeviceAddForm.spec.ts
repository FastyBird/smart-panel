import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory, DevicesWledPluginAdoptDeviceCategory } from '../../../openapi.constants';
import { DEVICES_WLED_PLUGIN_PREFIX } from '../devices-wled.constants';

import { useDeviceAddForm } from './useDeviceAddForm';

const backendClient = { POST: vi.fn() };
const devicesStore = { fetch: vi.fn() };
const flashMessage = { error: vi.fn(), success: vi.fn() };

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
		useLogger: () => ({ error: vi.fn() }),
	};
});

describe('useDeviceAddForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		devicesStore.fetch.mockResolvedValue([]);
		backendClient.POST.mockResolvedValue({
			data: {
				data: [{ host: '192.168.1.100', name: 'Desk strip', status: 'created', error: null, deviceId: 'device-1' }],
			},
			response: { status: 200 },
		});
	});

	it('uses mapper-backed adoption instead of creating a raw generic device', async () => {
		const form = useDeviceAddForm({ id: '6ce8b8e8-c15c-4f10-86dc-50d342c7ec35' });
		form.formEl.value = { clearValidate: vi.fn(), validate: vi.fn().mockResolvedValue(true) } as never;
		form.model.name = 'Desk strip';
		form.model.category = DevicesModuleDeviceCategory.lighting;
		form.model.hostname = '192.168.1.100';
		form.model.description = 'Behind the desk';
		form.model.enabled = false;

		await form.submit();

		expect(backendClient.POST).toHaveBeenCalledWith(`/plugins/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/adopt`, {
			body: {
				data: {
					devices: [
						{
							host: '192.168.1.100',
							name: 'Desk strip',
							category: DevicesWledPluginAdoptDeviceCategory.lighting,
							description: 'Behind the desk',
							enabled: false,
						},
					],
				},
			},
		});
		expect(devicesStore.fetch).toHaveBeenCalledTimes(1);
	});
});
