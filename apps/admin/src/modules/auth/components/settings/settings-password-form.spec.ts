import { type ComponentPublicInstance } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElForm, ElFormItem } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { UsersUserRole } from '../../../../openapi';
import { FormResult, Layout } from '../../auth.constants';
import enUS from '../../locales/en-US.json';
import type { SessionStore } from '../../store';

import type { SettingsPasswordFormFields, SettingsPasswordFormProps } from './settings-password-form.types';
import SettingsPasswordForm from './settings-password-form.vue';

type SettingsPasswordFormInstance = ComponentPublicInstance<SettingsPasswordFormProps> & { passwordForm: SettingsPasswordFormFields };

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	exception: vi.fn(),
};

vi.mock('../../../../common', () => ({
	injectStoresManager: vi.fn(),
	useFlashMessage: vi.fn(() => mockFlash),
}));

describe('SettingsPasswordForm', (): void => {
	let wrapper: VueWrapper<SettingsPasswordFormInstance>;

	const mockSessionStore: SessionStore = {
		edit: vi.fn(),
	} as SessionStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockSessionStore),
		});

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					authModule: enUS,
				},
			},
		});

		wrapper = mount(SettingsPasswordForm, {
			global: {
				plugins: [i18n],
			},
			props: {
				remoteFormSubmit: false,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				layout: Layout.DEFAULT,
				profile: {
					id: uuid(),
					username: 'user',
					email: null,
					firstName: null,
					lastName: null,
					draft: false,
					isHidden: false,
					role: UsersUserRole.user,
					createdAt: new Date(),
					updatedAt: null,
				},
			},
		}) as VueWrapper<SettingsPasswordFormInstance>;
	});

	it('renders the form correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(3);
	});

	it('submits successfully and updates password', async (): Promise<void> => {
		await wrapper.find('input[name="currentPassword"]').setValue('oldpassword');
		await wrapper.find('input[name="newPassword"]').setValue('newpassword123');
		await wrapper.find('input[name="repeatPassword"]').setValue('newpassword123');

		(mockSessionStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remoteFormResult')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('Your password has been updated successfully.');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper.find('input[name="currentPassword"]').setValue('oldpassword');
		await wrapper.find('input[name="newPassword"]').setValue('newpassword123');
		await wrapper.find('input[name="repeatPassword"]').setValue('newpassword123');

		(mockSessionStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remoteFormResult')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith("Your password couldn't be changed.");
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper.find('input[name="currentPassword"]').setValue('oldpassword');
		await wrapper.find('input[name="newPassword"]').setValue('newpassword123');
		await wrapper.find('input[name="repeatPassword"]').setValue('newpassword123');

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.passwordForm.currentPassword).toBe('');
		expect(wrapper.vm.passwordForm.newPassword).toBe('');
		expect(wrapper.vm.passwordForm.repeatPassword).toBe('');
	});
});
