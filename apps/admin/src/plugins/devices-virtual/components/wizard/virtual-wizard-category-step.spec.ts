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
// `categories`/`blockedCategories` come back as plain arrays, not refs. Re-wrapping in `computed`
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
		blockedCategories: computed(() => wrapper.vm.blockedCategories),
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

	it('lists every blocked category separately, each with a non-empty reason', () => {
		const { blockedCategories } = mountCategoryStep();

		const values = blockedCategories.value.map((entry) => entry.value);

		expect(values).toEqual(
			expect.arrayContaining(['air_conditioner', 'air_dehumidifier', 'air_humidifier', 'heating_unit', 'water_heater', 'thermostat'])
		);
		expect(blockedCategories.value).toHaveLength(6);
		expect(blockedCategories.value.every((entry) => entry.reason.length > 0)).toBe(true);
	});

	it('renders one selectable option per allowed category', () => {
		const { wrapper, categories } = mountCategoryStep();

		const options = wrapper.findAllComponents({ name: 'ElOption' });

		expect(options).toHaveLength(categories.value.length);
	});

	it('renders blocked categories as disabled tags carrying the reason, not as selectable options', () => {
		const { wrapper, blockedCategories } = mountCategoryStep();

		const tags = wrapper.findAllComponents({ name: 'ElTag' });

		expect(tags).toHaveLength(blockedCategories.value.length);

		for (const tag of tags) {
			expect(tag.attributes('title')).toBeTruthy();
		}

		const optionValues = wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'));

		expect(optionValues).not.toContain(DevicesModuleDeviceCategory.thermostat);
	});

	it('emits update:modelValue with the selected category', async () => {
		const { wrapper } = mountCategoryStep();

		await wrapper.findComponent({ name: 'ElSelect' }).setValue(DevicesModuleDeviceCategory.lighting);

		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([DevicesModuleDeviceCategory.lighting]);
	});

	it('reflects the current selection back into the select', () => {
		const { wrapper } = mountCategoryStep({ modelValue: DevicesModuleDeviceCategory.switcher });

		expect(wrapper.findComponent({ name: 'ElSelect' }).props('modelValue')).toBe(DevicesModuleDeviceCategory.switcher);
	});
});
