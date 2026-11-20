import { createI18n } from 'vue-i18n';

import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { SecretInputProps } from './secret-input.types';
import SecretInput from './secret-input.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const render = (props: SecretInputProps = {}) => mount(SecretInput, { props, global: { plugins: [i18n] }, attachTo: document.body });

describe('SecretInput.vue', () => {
	it('shows only the hint for a stored secret, never an input', () => {
		const wrapper = render({ savedHint: 'ends in …k3Fq' });

		expect(wrapper.find('[data-test-id="secret-input-saved"]').text()).toContain('Saved');
		expect(wrapper.find('[data-test-id="secret-input-saved"]').text()).toContain('ends in …k3Fq');
		expect(wrapper.find('input').exists()).toBe(false);

		wrapper.unmount();
	});

	it('reveals an empty password input on Replace', async () => {
		const wrapper = render({ savedHint: 'ends in …k3Fq' });

		await wrapper.find('[data-test-id="secret-input-replace"]').trigger('click');

		const input = wrapper.find('input');

		expect(input.exists()).toBe(true);
		expect(input.element.value).toBe('');
		expect(input.attributes('type')).toBe('password');
		expect(input.attributes('autocomplete')).toBe('new-password');
		expect(wrapper.emitted('update:modelValue')).toEqual([['']]);

		wrapper.unmount();
	});

	it('goes back to the hint on Cancel and clears the new value', async () => {
		const wrapper = render({ savedHint: 'ends in …k3Fq' });

		await wrapper.find('[data-test-id="secret-input-replace"]').trigger('click');
		await wrapper.find('[data-test-id="secret-input-cancel"]').trigger('click');

		expect(wrapper.find('[data-test-id="secret-input-saved"]').exists()).toBe(true);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);

		wrapper.unmount();
	});

	it('emits what the user types', async () => {
		const wrapper = render();

		await wrapper.find('input').setValue('new-secret');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['new-secret']);

		wrapper.unmount();
	});

	it('shows an input without Cancel when nothing is stored', () => {
		const wrapper = render();

		expect(wrapper.find('input').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="secret-input-cancel"]').exists()).toBe(false);

		wrapper.unmount();
	});

	it('shows the hint again when the parent clears the new value, even with an unchanged hint', async () => {
		const wrapper = render({ savedHint: 'ends in …k3Fq' });

		await wrapper.find('[data-test-id="secret-input-replace"]').trigger('click');
		await wrapper.setProps({ modelValue: 'typed' });

		expect(wrapper.find('[data-test-id="secret-input-saved"]').exists()).toBe(false);

		await wrapper.setProps({ modelValue: undefined });

		expect(wrapper.find('[data-test-id="secret-input-saved"]').exists()).toBe(true);

		wrapper.unmount();
	});

	it('shows the hint again after a new secret is saved', async () => {
		const wrapper = render({ savedHint: 'ends in …k3Fq' });

		await wrapper.find('[data-test-id="secret-input-replace"]').trigger('click');
		await wrapper.setProps({ savedHint: 'ends in …ab12' });

		expect(wrapper.find('[data-test-id="secret-input-saved"]').text()).toContain('ends in …ab12');

		wrapper.unmount();
	});
});
