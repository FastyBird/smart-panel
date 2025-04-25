import { createRouter, createWebHistory } from 'vue-router';

import { ElButton, ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult, RouteNames } from '../../auth.constants';
import type { SessionStore } from '../../store/session.store.types';

import SignUpForm from './sign-up-form.vue';

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

describe('SignUpForm', (): void => {
	let wrapper: VueWrapper;

	const mockRouter = {
		push: vi.fn(),
	};

	const mockSessionStore: SessionStore = {
		register: vi.fn(),
	} as SessionStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockSessionStore),
		});

		const router = createRouter({
			history: createWebHistory(),
			routes: [
				{ path: '/', name: AppRouteNames.ROOT, component: {} },
				{ path: '/sign-in', name: RouteNames.SIGN_IN, component: {} },
			],
		});

		vi.spyOn(router, 'push').mockImplementation(mockRouter.push);

		wrapper = mount(SignUpForm, {
			global: {
				plugins: [router],
			},
			props: {
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
			},
		});
	});

	it('renders the form correctly', (): void => {
		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(5);
		expect(wrapper.findComponent(ElButton).exists()).toBe(true);
	});

	it('emits events on successful submit', async (): Promise<void> => {
		await wrapper.find('input[name="firstName"]').setValue('John');
		await wrapper.find('input[name="lastName"]').setValue('Doe');
		await wrapper.find('input[name="email"]').setValue('john.doe@example.com');
		await wrapper.find('input[name="username"]').setValue('johndoe');
		await wrapper.find('input[name="password"]').setValue('password123');

		await wrapper.findComponent(ElButton).trigger('click');

		await flushPromises();

		expect(wrapper.emitted('update:remoteFormResult')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.OK]);
	});

	it('emits an error event when login fails', async (): Promise<void> => {
		const mockFlashMessage = useFlashMessage();
		(mockSessionStore.register as Mock).mockRejectedValueOnce(new Error('Failed register'));

		await wrapper.find('input[name="firstName"]').setValue('John');
		await wrapper.find('input[name="lastName"]').setValue('Doe');
		await wrapper.find('input[name="email"]').setValue('john.doe@example.com');
		await wrapper.find('input[name="username"]').setValue('johndoe');
		await wrapper.find('input[name="password"]').setValue('password123');

		await wrapper.findComponent(ElButton).trigger('click');

		await flushPromises();

		expect(wrapper.emitted('update:remoteFormResult')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.ERROR]);

		await flushPromises();

		expect(mockFlashMessage.error).toHaveBeenCalled();
	});

	it('navigates to sign-in page when "Back to Sign In" button is clicked', async (): Promise<void> => {
		await wrapper.findAllComponents(ElButton)[1].trigger('click');

		expect(mockRouter.push).toHaveBeenCalledWith({ name: RouteNames.SIGN_IN });
	});
});
