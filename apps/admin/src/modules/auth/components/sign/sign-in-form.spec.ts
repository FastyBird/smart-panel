import { nextTick } from 'vue';

import { ElButton, ElForm, ElFormItem, ElInput } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult } from '../../auth.constants';
import type { SessionStore } from '../../store/session.store.types';

import SignInForm from './sign-in-form.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const mockFlash = {
	error: vi.fn(),
	exception: vi.fn(),
};

vi.mock('../../../../common', () => ({
	injectStoresManager: vi.fn(),
	useFlashMessage: vi.fn(() => mockFlash),
}));

describe('SignInForm', (): void => {
	let wrapper: VueWrapper;

	const mockSessionStore: SessionStore = {
		create: vi.fn(),
	} as SessionStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockSessionStore),
		});

		wrapper = mount(SignInForm, {
			props: {
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
			},
		});
	});

	it('renders the form correctly', (): void => {
		const formItems = wrapper.findAllComponents(ElFormItem);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);

		expect(formItems.length).eq(2);

		expect(formItems[0].findComponent(ElInput).exists()).toBe(true);
		expect(formItems[1].findComponent(ElInput).exists()).toBe(true);
		expect(wrapper.findComponent(ElButton).exists()).toBe(true);
	});

	it('emits an event when login is successful', async (): Promise<void> => {
		(mockSessionStore.create as Mock).mockResolvedValueOnce({});

		await wrapper.find('input[name="username"]').setValue('testuser');
		await wrapper.find('input[name="password"]').setValue('password123');

		await wrapper.findComponent(ElButton).trigger('click');

		await flushPromises();

		expect(wrapper.emitted('update:remoteFormResult')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.OK]);
	});

	it('emits an error event when login fails', async (): Promise<void> => {
		const mockFlashMessage = useFlashMessage();
		(mockSessionStore.create as Mock).mockRejectedValueOnce(new Error('Failed login'));

		await wrapper.find('input[name="username"]').setValue('testuser');
		await wrapper.find('input[name="password"]').setValue('password123');

		await wrapper.findComponent(ElButton).trigger('click');

		await flushPromises();

		expect(wrapper.emitted('update:remoteFormResult')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.ERROR]);

		await flushPromises();

		expect(mockFlashMessage.error).toHaveBeenCalled();
	});

	it('resets form when remoteFormReset is set to true', async (): Promise<void> => {
		await wrapper.setProps({ remoteFormReset: true });

		await nextTick();

		expect(wrapper.emitted('update:remoteFormReset')?.[0]).toEqual([false]);
	});
});
