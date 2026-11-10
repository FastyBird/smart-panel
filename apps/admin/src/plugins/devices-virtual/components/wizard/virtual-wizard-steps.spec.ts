import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import VirtualWizardSteps from './virtual-wizard-steps.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const mountSteps = (props: Record<string, unknown> = {}) =>
	mount(VirtualWizardSteps, {
		props: { modelValue: 0, steps: ['one', 'two', 'three'], canAdvance: true, ...props },
		slots: { default: '<div data-test-id="body" />', final: '<button data-test-id="create" />' },
	});

describe('virtual wizard steps', () => {
	it('shows the step bar and only Next on the first step', () => {
		const wrapper = mountSteps();

		expect(wrapper.find('[data-test-id="virtual-wizard-steps"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="body"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-back"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-next"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="create"]').exists()).toBe(false);
	});

	it('moves forward and back one step at a time', async () => {
		const wrapper = mountSteps({ modelValue: 1 });

		await wrapper.get('[data-test-id="wizard-next"]').trigger('click');
		await wrapper.get('[data-test-id="wizard-back"]').trigger('click');

		expect(wrapper.emitted('update:modelValue')).toEqual([[2], [0]]);
	});

	it('blocks Next until the step is complete', () => {
		const wrapper = mountSteps({ canAdvance: false });

		expect(wrapper.get('[data-test-id="wizard-next"]').attributes('disabled')).toBeDefined();
	});

	it('replaces Next with the final action on the last step', () => {
		const wrapper = mountSteps({ modelValue: 2 });

		expect(wrapper.find('[data-test-id="wizard-next"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-back"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="create"]').exists()).toBe(true);
	});

	it('renders the plain single page when stepping is off', () => {
		const wrapper = mountSteps({ enabled: false });

		expect(wrapper.find('[data-test-id="virtual-wizard-steps"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-next"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="body"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="create"]').exists()).toBe(true);
	});
});
