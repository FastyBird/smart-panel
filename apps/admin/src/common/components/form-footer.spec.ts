import { ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { FormFooterProps } from './form-footer.types';
import FormFooter from './form-footer.vue';

const keyboardOffset = ref(0);

vi.mock('../composables/useKeyboardOffset', () => ({
	useKeyboardOffset: () => ({ offset: keyboardOffset }),
}));

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const render = (props: FormFooterProps = {}) => mount(FormFooter, { props, global: { plugins: [i18n] } });

const button = (wrapper: ReturnType<typeof render>, id: string) => wrapper.find(`[data-test-id="form-footer-${id}"]`);

describe('FormFooter.vue', () => {
	it('is a 56 px sticky bar with the sticky shadow', () => {
		const wrapper = render();

		expect(wrapper.classes()).toEqual(expect.arrayContaining(['sticky', 'bottom-0', 'h-14', 'shadow-top']));
	});

	it('offers Close while clean and Discard once dirty', () => {
		expect(button(render(), 'close').exists()).toBe(true);
		expect(button(render(), 'discard').exists()).toBe(false);
		expect(button(render({ dirty: true }), 'discard').exists()).toBe(true);
		expect(button(render({ dirty: true }), 'close').exists()).toBe(false);
	});

	it('puts the one primary button rightmost', () => {
		const buttons = render({ dirty: true }).findAll('button');

		expect(buttons.at(-1)?.attributes('data-test-id')).toBe('form-footer-save');
		expect(buttons.filter((node) => node.classes().includes('el-button--primary'))).toHaveLength(1);
	});

	it('emits save, discard and close', async () => {
		const wrapper = render({ dirty: true });

		await button(wrapper, 'save').trigger('click');
		await button(wrapper, 'discard').trigger('click');
		await wrapper.setProps({ dirty: false });
		await button(wrapper, 'close').trigger('click');

		expect(wrapper.emitted('save')).toHaveLength(1);
		expect(wrapper.emitted('discard')).toHaveLength(1);
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('disables Save when it cannot save, and shows progress while saving', () => {
		expect(button(render({ canSave: false }), 'save').attributes('disabled')).toBeDefined();

		const saving = render({ dirty: true, saving: true });

		expect(button(saving, 'save').classes()).toContain('is-loading');
		expect(button(saving, 'discard').attributes('disabled')).toBeDefined();
	});

	it('rides above the on-screen keyboard', async () => {
		const wrapper = render();

		expect(wrapper.attributes('style')).toBeUndefined();

		keyboardOffset.value = 280;
		await wrapper.vm.$nextTick();

		expect(wrapper.attributes('style')).toContain('bottom: 280px');

		keyboardOffset.value = 0;
	});

	it('takes a custom save label', () => {
		expect(button(render({ saveLabel: 'Add device' }), 'save').text()).toBe('Add device');
	});
});
