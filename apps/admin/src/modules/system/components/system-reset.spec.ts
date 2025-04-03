import type { ComponentPublicInstance } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import SystemReset from './system-reset.vue';

type SystemResetInstance = ComponentPublicInstance;

const onRestart = vi.fn();
const onPowerOff = vi.fn();
const onFactoryReset = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../composables', () => ({
	useSystemActions: () => ({
		onRestart,
		onPowerOff,
		onFactoryReset,
	}),
}));

describe('SystemReset.vue', () => {
	let wrapper: VueWrapper<SystemResetInstance>;

	beforeEach(() => {
		vi.clearAllMocks();

		wrapper = mount(SystemReset);
	});

	it('renders all three system action rows with correct text', () => {
		expect(wrapper.find('[data-test-id="restart-info"]').text()).toContain('systemModule.texts.restartDevice');
		expect(wrapper.find('[data-test-id="power-off-info"]').text()).toContain('systemModule.texts.powerOffDevice');
		expect(wrapper.find('[data-test-id="factory-reset-info"]').text()).toContain('systemModule.texts.factoryResetDevice');
	});

	it('calls onRestart when restart row is clicked', async () => {
		await wrapper.findAllComponents({ name: 'ElRow' })[0].trigger('click');

		expect(onRestart).toHaveBeenCalled();
	});

	it('calls onPowerOff when power-off row is clicked', async () => {
		await wrapper.findAllComponents({ name: 'ElRow' })[1].trigger('click');

		expect(onPowerOff).toHaveBeenCalled();
	});

	it('calls onFactoryReset when factory reset row is clicked', async () => {
		await wrapper.findAllComponents({ name: 'ElRow' })[2].trigger('click');

		expect(onFactoryReset).toHaveBeenCalled();
	});
});
