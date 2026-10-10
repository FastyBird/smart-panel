import { nextTick } from 'vue';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, type FormInstance } from 'element-plus';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult } from '../../auth.constants';
import { AuthException, AuthLoginException } from '../../auth.exceptions';
import type { SessionStore } from '../../store/session.store.types';

import SignInForm from './sign-in-form.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({
		global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} },
	}),
	useI18n: () => ({
		t: (key: string, values?: { seconds?: number }) => (values?.seconds ? `${key}:${values.seconds}` : key),
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
		vi.spyOn(console, 'warn').mockImplementation(() => {});

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

		expect(formItems[0]?.findComponent(ElInput).exists()).toBe(true);
		expect(formItems[1]?.findComponent(ElInput).exists()).toBe(true);
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

	it('submits the native form using the form instance', async () => {
		(mockSessionStore.create as Mock).mockResolvedValueOnce({});
		await wrapper.find('input[name="username"]').setValue('testuser');
		await wrapper.find('input[name="password"]').setValue('password123');
		await wrapper.find('form').trigger('submit');
		await flushPromises();
		expect(mockSessionStore.create).toHaveBeenCalledTimes(1);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.OK]);
	});

	it.each([
		[new AuthLoginException('raw server text', 429, '60'), 'authModule.messages.signInRetryAfter:60'],
		[new AuthLoginException('raw server text', 429, 'invalid'), 'authModule.messages.signInRateLimited'],
		[new AuthLoginException('raw server text', 404), 'authModule.messages.invalidCredentials'],
		[new AuthLoginException('raw server text', 401), 'authModule.messages.invalidCredentials'],
		[new AuthLoginException('raw server text', 500), 'authModule.messages.requestError'],
		[new AuthException('Profile failed'), 'authModule.messages.requestError'],
		[new TypeError('Network failed'), 'authModule.messages.requestError'],
	])('shows request errors only in flash messages for %s', async (error, message) => {
		(mockSessionStore.create as Mock).mockRejectedValueOnce(error);
		await wrapper.find('input[name="username"]').setValue('testuser');
		await wrapper.find('input[name="password"]').setValue('password123');
		await wrapper.findComponent(ElButton).trigger('click');
		await flushPromises();
		expect(wrapper.findComponent(ElAlert).exists()).toBe(false);
		expect(wrapper.text()).not.toContain(message);
		expect(wrapper.findAll('.el-form-item__error')).toHaveLength(0);
		expect(wrapper.text()).not.toContain('raw server text');
		expect(mockFlash.error).toHaveBeenCalledWith(message);
	});

	it('allows a successful retry after a rate-limit flash message', async () => {
		(mockSessionStore.create as Mock).mockRejectedValueOnce(new AuthLoginException('limited', 429, '60'));
		await wrapper.find('input[name="username"]').setValue('testuser');
		await wrapper.find('input[name="password"]').setValue('password123');
		await wrapper.findComponent(ElButton).trigger('click');
		await flushPromises();
		expect(mockFlash.error).toHaveBeenCalledWith('authModule.messages.signInRetryAfter:60');
		let complete!: (value: object) => void;
		(mockSessionStore.create as Mock).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					complete = resolve;
				})
		);
		await wrapper.findComponent(ElButton).trigger('click');
		await flushPromises();
		expect(wrapper.findComponent(ElAlert).exists()).toBe(false);
		complete({});
		await flushPromises();
		expect(wrapper.emitted('update:remoteFormResult')?.at(-1)).toEqual([FormResult.OK]);
	});

	it('does not attempt login or show a flash when field validation fails', async () => {
		// Isolate the submit handler from async-validator's CommonJS interop in Vitest.
		vi.spyOn(wrapper.findComponent(ElForm).vm.$.exposed as FormInstance, 'validate').mockImplementation(
			async (callback) => {
				await callback?.(false, { username: [{ message: 'Required', field: 'username' }] });
				return false;
			}
		);
		await wrapper.findComponent(ElButton).trigger('click');
		await flushPromises();
		expect(mockSessionStore.create).not.toHaveBeenCalled();
		expect(mockFlash.error).not.toHaveBeenCalled();
		expect(mockFlash.exception).not.toHaveBeenCalled();
	});

	afterEach((): void => {
		wrapper.unmount();
		vi.restoreAllMocks();
	});

	it('resets form when remoteFormReset is set to true', async (): Promise<void> => {
		await wrapper.setProps({ remoteFormReset: true });

		await nextTick();

		expect(wrapper.emitted('update:remoteFormReset')?.[0]).toEqual([false]);
	});
});
