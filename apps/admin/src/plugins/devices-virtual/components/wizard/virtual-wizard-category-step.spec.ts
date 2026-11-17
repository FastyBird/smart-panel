import { computed } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import type { IVirtualWizardCategoryStepProps } from './virtual-wizard-category-step.types';
import VirtualWizardCategoryStep from './virtual-wizard-category-step.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

// `wrapper.vm.<exposed>` is already auto-unwrapped by @vue/test-utils's public instance proxy, so
// `categories` comes back as plain arrays, not refs. Re-wrapping in `computed`
// here (rather than on the component) gives callers the `.value` access the rest of this codebase's
// wizard-state helpers use (see useDeviceWizardState, useSpacesWizard) and keeps the read live
// across `wrapper.setProps(...)`.
const mountCategoryStep = (props: Partial<IVirtualWizardCategoryStepProps> = {}) => {
	const wrapper = mount(VirtualWizardCategoryStep, {
		props: {
			modelValue: null,
			...props,
		},
	});

	return {
		wrapper,
		categories: computed(() => wrapper.vm.categories),
	};
};

describe('VirtualWizardCategoryStep', () => {
	it('does not offer a category that needs a controller', () => {
		const { categories } = mountCategoryStep();

		expect(categories.value.map((entry) => entry.value)).not.toContain('heating_unit');
		expect(categories.value.map((entry) => entry.value)).not.toContain('thermostat');
	});

	it('offers a wiring-only category', () => {
		const { categories } = mountCategoryStep();

		expect(categories.value.map((entry) => entry.value)).toContain('lighting');
	});

	it('excludes every blocked category from the selectable list', () => {
		const { categories } = mountCategoryStep();

		const values = categories.value.map((entry) => entry.value);

		expect(values).not.toContain('air_conditioner');
		expect(values).not.toContain('air_dehumidifier');
		expect(values).not.toContain('air_humidifier');
		expect(values).not.toContain('water_heater');
	});

	it('omits unavailable categories from both the compact and expanded grid', async () => {
		const { wrapper } = mountCategoryStep();
		const blocked = ['air_conditioner', 'air_dehumidifier', 'air_humidifier', 'heating_unit', 'water_heater', 'thermostat'];
		for (const value of blocked) expect(wrapper.find(`[data-category="${value}"]`).exists()).toBe(false);
		await wrapper.get('[data-test-id="projection-more-categories"]').trigger('click');
		for (const value of blocked) expect(wrapper.find(`[data-category="${value}"]`).exists()).toBe(false);
		expect(wrapper.findAllComponents({ name: 'ElRadio' }).some((radio) => radio.props('disabled'))).toBe(false);
	});

	it('keeps every allowed category available through the expanded grid', async () => {
		const { wrapper, categories } = mountCategoryStep();

		await wrapper.get('[data-test-id="projection-more-categories"]').trigger('click');
		const options = wrapper.findAllComponents({ name: 'ElRadio' }).filter((radio) => !radio.props('disabled'));

		expect(options).toHaveLength(categories.value.length);
	});

	it('does not emit an unsupported category from an externally triggered selection', async () => {
		const { wrapper } = mountCategoryStep();
		await wrapper.findComponent({ name: 'ElRadioGroup' }).setValue(DevicesModuleDeviceCategory.thermostat);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('emits update:modelValue with the selected category', async () => {
		const { wrapper } = mountCategoryStep();

		await wrapper.findComponent({ name: 'ElRadioGroup' }).setValue(DevicesModuleDeviceCategory.lighting);

		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([DevicesModuleDeviceCategory.lighting]);
	});

	it('reflects the current selection back into the radio group', () => {
		const { wrapper } = mountCategoryStep({ modelValue: DevicesModuleDeviceCategory.switcher });

		expect(wrapper.findComponent({ name: 'ElRadioGroup' }).props('modelValue')).toBe(DevicesModuleDeviceCategory.switcher);
	});
});
