import type { ComponentPublicInstance } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import ManageSystem from './manage-system.vue';

type ManageSystemInstance = ComponentPublicInstance;

const onServiceRestart = vi.fn();
const onSystemReboot = vi.fn();
const onPowerOff = vi.fn();
const onFactoryReset = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const push = vi.fn();

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push,
	}),
}));

vi.mock('../../composables/composables', () => ({
	useSystemActions: () => ({
		onServiceRestart,
		onSystemReboot,
		onPowerOff,
		onFactoryReset,
	}),
}));

vi.mock('../../../config/composables/composables', () => ({
	useConfigModule: () => ({
		configModule: { value: { deploymentMode: 'all-in-one' } },
	}),
}));

describe('ManageSystem.vue', () => {
	let wrapper: VueWrapper<ManageSystemInstance>;

	beforeEach(() => {
		vi.clearAllMocks();

		wrapper = mount(ManageSystem);
	});

	it('renders all system action rows with correct text', () => {
		expect(wrapper.find('[data-test-id="service-restart-info"]').text()).toContain('systemModule.texts.manage.serviceRestartDevice');
		expect(wrapper.find('[data-test-id="system-reboot-info"]').text()).toContain('systemModule.texts.manage.rebootDevice');
		expect(wrapper.find('[data-test-id="power-off-info"]').text()).toContain('systemModule.texts.manage.powerOffDevice');
		expect(wrapper.find('[data-test-id="factory-reset-info"]').text()).toContain('systemModule.texts.manage.factoryResetDevice');
	});

	it('calls onServiceRestart when service restart button is clicked', async () => {
		await wrapper.get('[data-test-id="service-restart-button"]').trigger('click');

		expect(onServiceRestart).toHaveBeenCalled();
	});

	it('calls onSystemReboot when system reboot button is clicked', async () => {
		await wrapper.get('[data-test-id="system-reboot-button"]').trigger('click');

		expect(onSystemReboot).toHaveBeenCalled();
	});

	it('calls onPowerOff when power-off button is clicked', async () => {
		await wrapper.get('[data-test-id="power-off-button"]').trigger('click');

		expect(onPowerOff).toHaveBeenCalled();
	});

	it('calls onFactoryReset when factory reset button is clicked', async () => {
		await wrapper.get('[data-test-id="factory-reset-button"]').trigger('click');

		expect(onFactoryReset).toHaveBeenCalled();
	});

	it('opens backups and logs from their rows', async () => {
		await wrapper.get('[data-test-id="system-backups-button"]').trigger('click');
		await wrapper.get('[data-test-id="system-logs-button"]').trigger('click');

		expect(push.mock.calls).toEqual([[{ name: 'system_module-system_backups' }], [{ name: 'system_module-system_logs' }]]);
	});
});
