import { createI18n } from 'vue-i18n';

import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { TypePickerOption, TypePickerProps } from './type-picker.types';
import TypePicker from './type-picker.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const OPTIONS: TypePickerOption[] = [
	{ id: 'shelly', icon: 'mdi:chip', name: 'Shelly', description: 'Gen 2 and newer devices' },
	{ id: 'ha', icon: 'mdi:home-assistant', name: 'Home Assistant', badge: 'Beta' },
	{ id: 'zigbee', icon: 'mdi:zigbee', name: 'Zigbee', disabled: true },
];

const render = (props: TypePickerProps) =>
	mount(TypePicker, {
		props,
		global: {
			plugins: [i18n],
			// The dialog body renders only while it is open
			stubs: { ElDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' } },
		},
	});

const options = (wrapper: ReturnType<typeof render>) => wrapper.findAll('[data-test-id="type-picker-option"]');

describe('TypePicker.vue', () => {
	it('lists every option with its icon, name, description and badge', () => {
		const wrapper = render({ options: OPTIONS, visible: true });

		expect(options(wrapper)).toHaveLength(3);
		expect(options(wrapper)[0].text()).toContain('Gen 2 and newer devices');
		expect(wrapper.find('[data-test-id="type-picker-badge"]').text()).toBe('Beta');
		expect(options(wrapper)[0].findAll('span[aria-hidden="true"]')).toHaveLength(1);
	});

	it('selects an option and closes', async () => {
		const wrapper = render({ options: OPTIONS, visible: true });

		await options(wrapper)[1].trigger('click');

		expect(wrapper.emitted('update:modelValue')).toEqual([['ha']]);
		expect(wrapper.emitted('update:visible')).toEqual([[false]]);
	});

	it('does not select a disabled option', async () => {
		const wrapper = render({ options: OPTIONS, visible: true });

		expect(options(wrapper)[2].attributes('disabled')).toBeDefined();

		await options(wrapper)[2].trigger('click');

		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('marks the selected option', () => {
		const wrapper = render({ options: OPTIONS, modelValue: 'shelly', visible: true });

		expect(options(wrapper)[0].attributes('aria-checked')).toBe('true');
		expect(options(wrapper)[1].attributes('aria-checked')).toBe('false');
	});

	it('skips the dialog when there is one option', async () => {
		const wrapper = render({ options: [OPTIONS[0]], visible: true });

		expect(wrapper.emitted('update:modelValue')).toEqual([['shelly']]);
		expect(wrapper.emitted('update:visible')).toEqual([[false]]);
		expect(options(wrapper)).toHaveLength(0);
	});

	it('does not re-emit a single option that is already selected', () => {
		const wrapper = render({ options: [OPTIONS[0]], modelValue: 'shelly' });

		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('skips the dialog when only one option is enabled', () => {
		const wrapper = render({ options: [OPTIONS[0], OPTIONS[2]], visible: true });

		expect(wrapper.emitted('update:modelValue')).toEqual([['shelly']]);
		expect(wrapper.emitted('update:visible')).toEqual([[false]]);
	});

	it('does not auto-select a single disabled option', () => {
		const wrapper = render({ options: [OPTIONS[2]], visible: true });

		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(options(wrapper)).toHaveLength(1);
	});
});
