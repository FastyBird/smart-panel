import { computed } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { createDeviceWizardContext, deviceWizardContextKey } from './device-wizard-flow';
import DeviceWizardSteps from './device-wizard-steps.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('shared wizard step transitions', () => {
	it('stays on the current step when validation returns false', async () => {
		const context = createDeviceWizardContext();
		const beforeNext = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const wrapper = mount(DeviceWizardSteps, {
			props: { modelValue: 0, steps: ['Processing', 'Review'], canAdvance: true, beforeNext },
			global: { provide: { [deviceWizardContextKey as symbol]: context } },
		});
		const next = context.flow.value!.value.actions.find((action) => action.id === 'next')!;
		await next.handler();
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		await next.handler();
		expect(wrapper.emitted('update:modelValue')).toEqual([[1]]);
		wrapper.unmount();
	});
	it('shows progress and prevents duplicate asynchronous Next validation', async () => {
		const context = createDeviceWizardContext();
		let finish!: (result: boolean) => void;
		const beforeNext = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					finish = resolve;
				})
		);
		const wrapper = mount(DeviceWizardSteps, {
			props: { modelValue: 0, steps: ['Processing', 'Review'], canAdvance: true, beforeNext },
			global: { provide: { [deviceWizardContextKey as symbol]: context } },
		});
		const next = () => context.flow.value!.value.actions.find((action) => action.id === 'next')!;
		const pending = next().handler();
		expect(next().loading).toBe(true);
		expect(context.flow.value!.value.busy).toBe(true);
		await next().handler();
		expect(beforeNext).toHaveBeenCalledTimes(1);
		finish(true);
		await pending;
		expect(next().loading).toBe(false);
		expect(context.flow.value!.value.busy).toBe(false);
		expect(wrapper.emitted('update:modelValue')).toEqual([[1]]);
		wrapper.unmount();
	});

	it('keeps the current step and draft after a failed asynchronous preparation', async () => {
		const context = createDeviceWizardContext();
		const beforeNext = vi.fn().mockRejectedValueOnce(new Error('endpoint save failed')).mockResolvedValueOnce(undefined);
		const wrapper = mount(DeviceWizardSteps, {
			props: { modelValue: 0, steps: ['Connection', 'Mapping'], canAdvance: true, beforeNext },
			global: { provide: { [deviceWizardContextKey as symbol]: context } },
			slots: { default: '<input value="kept draft" />' },
		});
		const next = computed(() => context.flow.value!.value.actions.find((action) => action.id === 'next')!);
		await expect(next.value.handler()).rejects.toThrow('endpoint save failed');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(wrapper.get('input').element.value).toBe('kept draft');
		await next.value.handler();
		expect(wrapper.emitted('update:modelValue')).toEqual([[1]]);
		wrapper.unmount();
		expect(context.flow.value).toBeNull();
	});
});
