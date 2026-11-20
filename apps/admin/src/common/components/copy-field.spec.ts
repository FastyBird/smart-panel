import { createI18n } from 'vue-i18n';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { CopyFieldProps } from './copy-field.types';
import CopyField from './copy-field.vue';

const copyMock = vi.fn();
const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock('../composables/useClipboard', () => ({
	useClipboard: () => ({ copy: copyMock }),
}));

vi.mock('../composables/useFlashMessage', () => ({
	useFlashMessage: () => ({ success: successMock, error: errorMock }),
}));

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const render = (props: CopyFieldProps) => mount(CopyField, { props, global: { plugins: [i18n] } });

describe('CopyField.vue', () => {
	beforeEach(() => {
		copyMock.mockReset();
		successMock.mockReset();
		errorMock.mockReset();
	});

	it('shows the value in mono by default, with its label', () => {
		const wrapper = render({ value: 'https://panel.local/mcp', label: 'Endpoint' });

		expect(wrapper.find('[data-test-id="copy-field-value"]').text()).toBe('https://panel.local/mcp');
		expect(wrapper.find('[data-test-id="copy-field-value"]').classes()).toContain('text-mono');
		expect(wrapper.text()).toContain('Endpoint');
	});

	it('uses the body style when mono is off', () => {
		const wrapper = render({ value: 'Kitchen', mono: false });

		expect(wrapper.find('[data-test-id="copy-field-value"]').classes()).toContain('text-body');
	});

	it('names the copy button for screen readers', () => {
		expect(render({ value: 'x', label: 'Token' }).find('[data-test-id="copy-field-button"]').attributes('aria-label')).toBe('Copy Token');
		expect(render({ value: 'x' }).find('[data-test-id="copy-field-button"]').attributes('aria-label')).toBe('Copy');
	});

	it('copies the value and confirms with a toast', async () => {
		copyMock.mockResolvedValue(true);

		const wrapper = render({ value: 'secret-id' });

		await wrapper.find('[data-test-id="copy-field-button"]').trigger('click');
		await flushPromises();

		expect(copyMock).toHaveBeenCalledWith('secret-id');
		expect(successMock).toHaveBeenCalledWith('Copied to the clipboard');
		expect(wrapper.emitted('copied')).toEqual([['secret-id']]);
	});

	it('reports the value that was copied even if it changes meanwhile', async () => {
		let resolveCopy: (copied: boolean) => void = () => {};

		copyMock.mockReturnValue(new Promise<boolean>((resolve) => (resolveCopy = resolve)));

		const wrapper = render({ value: 'first' });

		await wrapper.find('[data-test-id="copy-field-button"]').trigger('click');
		await wrapper.setProps({ value: 'second' });

		resolveCopy(true);
		await flushPromises();

		expect(copyMock).toHaveBeenCalledWith('first');
		expect(wrapper.emitted('copied')).toEqual([['first']]);
	});

	it('shows an error toast when copying fails', async () => {
		copyMock.mockResolvedValue(false);

		const wrapper = render({ value: 'secret-id' });

		await wrapper.find('[data-test-id="copy-field-button"]').trigger('click');
		await flushPromises();

		expect(errorMock).toHaveBeenCalledWith('Could not copy to the clipboard');
		expect(wrapper.emitted('copied')).toBeUndefined();
	});
});
