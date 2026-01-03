import type { ComponentPublicInstance } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import ManageSystem from './manage-system.vue';

type ManageSystemInstance = ComponentPublicInstance;

const onRestart = vi.fn();
const onPowerOff = vi.fn();
const onFactoryReset = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../composables/composables', () => ({
	useSystemActions: () => ({
		onRestart,
		onPowerOff,
		onFactoryReset,
	}),
}));

describe('ManageSystem.vue', () => {
	let wrapper: VueWrapper<ManageSystemInstance>;

	beforeEach(() => {
		vi.clearAllMocks();

		wrapper = mount(ManageSystem);
	});

	it('renders all three system action rows with correct text', () => {
		expect(wrapper.find('[data-test-id="restart-info"]').text()).toContain('systemModule.texts.manage.rebootDevice');
		expect(wrapper.find('[data-test-id="power-off-info"]').text()).toContain('systemModule.texts.manage.powerOffDevice');
		expect(wrapper.find('[data-test-id="factory-reset-info"]').text()).toContain('systemModule.texts.manage.factoryResetDevice');
	});

	it('calls onRestart when restart row is clicked', async () => {
		await wrapper.findAllComponents({ name: 'ElRow' })[0]?.trigger('click');

		expect(onRestart).toHaveBeenCalled();
	});

	it('calls onPowerOff when power-off row is clicked', async () => {
		await wrapper.findAllComponents({ name: 'ElRow' })[1]?.trigger('click');

		expect(onPowerOff).toHaveBeenCalled();
	});

	it('calls onFactoryReset when factory reset row is clicked', async () => {
		await wrapper.findAllComponents({ name: 'ElRow' })[2]?.trigger('click');

		expect(onFactoryReset).toHaveBeenCalled();
	});
});
