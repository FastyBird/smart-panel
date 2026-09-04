import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IHomeKitConfig } from '../store/config.store.types';

import HomeKitConfigForm from './homekit-config-form.vue';

const useConfigPluginEditForm = vi.hoisted(() => vi.fn());
const model = reactive({
	type: 'devices-homekit',
	enabled: true,
	bridgeName: 'Smart Panel Bridge',
	port: 51826,
	pincode: '031-45-154',
	username: 'CC:22:3D:E3:CE:30',
	setupId: 'SP01',
	mappedDeviceIds: [],
});

const mockStatus = ref({
	running: true,
	paired: true,
	pairedClientsCount: 1,
	bridgeName: 'Smart Panel Bridge',
	port: 51826,
	pincode: '031-45-154',
	username: 'CC:22:3D:E3:CE:30',
	setupUri: 'X-HM://0024R932WSP01',
	qrCodeDataUri: 'data:image/svg+xml;utf8,<svg></svg>',
	exposedDevicesCount: 3,
});

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../modules/config', async () => {
	const { ConfigPluginEditFormSchema } = await vi.importActual<
		typeof import('../../../modules/config/schemas/plugins.schemas')
	>('../../../modules/config/schemas/plugins.schemas');

	return {
		ConfigPluginEditFormSchema,
		FormResult: { NONE: 'none' },
		Layout: { DEFAULT: 'default' },
		useConfigPluginEditForm,
	};
});

vi.mock('../store/homekit-bridge.store', () => ({
	useHomeKitBridge: () =>
		reactive({
			status: mockStatus,
			fetchingStatus: ref(false),
			resettingPairing: ref(false),
			fetchStatus: vi.fn().mockImplementation(async () => mockStatus.value),
			resetPairing: vi.fn(),
		}),
}));

const mountForm = () => {
	useConfigPluginEditForm.mockReturnValue({
		formEl: ref(),
		model,
		formChanged: ref(false),
		submit: vi.fn(),
		formResult: ref('none'),
	});

	return mount(HomeKitConfigForm, {
		props: { config: model as unknown as IHomeKitConfig },
		global: {
			stubs: {
				HomeKitSetupWizard: {
					name: 'HomeKitSetupWizard',
					template: '<div />',
				},
				Icon: true,
			},
		},
	});
};

describe('HomeKitConfigForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders all configuration fields', () => {
		const wrapper = mountForm();

		expect(wrapper.find('[name="enabled"]').exists()).toBe(true);
		expect(wrapper.find('[name="bridgeName"]').exists()).toBe(true);
		expect(wrapper.find('[name="port"]').exists()).toBe(true);
		expect(wrapper.find('[name="pincode"]').exists()).toBe(true);
	});

	it('renders bridge runtime status', async () => {
		const wrapper = mountForm();
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeKitPlugin.status.running');
		expect(wrapper.text()).toContain('devicesHomeKitPlugin.status.pairedWithCount');
		expect(wrapper.text()).toContain('031-45-154');
	});
});
