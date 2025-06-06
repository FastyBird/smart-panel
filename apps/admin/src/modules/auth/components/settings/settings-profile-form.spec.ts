import { type ComponentPublicInstance } from 'vue';

import { ElForm, ElFormItem } from 'element-plus';
import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { UsersModuleUserRole } from '../../../../openapi';
import { FormResult } from '../../auth.constants';
import type { SessionStore } from '../../store/session.store.types';

import type { SettingsProfileFormProps } from './settings-profile-form.types';
import SettingsProfileForm from './settings-profile-form.vue';

type SettingsPasswordFormInstance = ComponentPublicInstance<SettingsProfileFormProps>;

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	exception: vi.fn(),
};

vi.mock('../../../../common', () => ({
	injectStoresManager: vi.fn(),
	useFlashMessage: vi.fn(() => mockFlash),
}));

describe('SettingsProfileForm', (): void => {
	let wrapper: VueWrapper<SettingsPasswordFormInstance>;

	const mockSessionStore: SessionStore = {
		edit: vi.fn(),
	} as SessionStore;

	const userId = uuid();

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockSessionStore),
		});

		wrapper = mount(SettingsProfileForm, {
			props: {
				profile: {
					id: userId,
					username: 'user',
					email: 'test@example.com',
					firstName: 'John',
					lastName: 'Doe',
					draft: false,
					isHidden: false,
					role: UsersModuleUserRole.user,
					createdAt: new Date(),
					updatedAt: null,
				},
			},
		}) as VueWrapper<SettingsPasswordFormInstance>;
	});

	it('renders correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem).length).toBe(3);
	});

	it('sets initial values from props', async (): Promise<void> => {
		const emailInput = wrapper.find('input[name="email"]');
		expect((emailInput.element as HTMLInputElement).value).toBe('test@example.com');

		const firstNameInput = wrapper.find('input[name="firstName"]');
		expect((firstNameInput.element as HTMLInputElement).value).toBe('John');

		const lastNameInput = wrapper.find('input[name="lastName"]');
		expect((lastNameInput.element as HTMLInputElement).value).toBe('Doe');
	});

	it('emits event when form is submitted successfully', async (): Promise<void> => {
		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(mockSessionStore.edit).toHaveBeenCalledWith({
			id: userId,
			data: {
				firstName: 'John',
				lastName: 'Doe',
				email: 'test@example.com',
			},
		});

		expect(wrapper.emitted('update:remoteFormResult')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('authModule.messages.profileEdited');
	});

	it('handles errors when profile update fails', async (): Promise<void> => {
		(mockSessionStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remoteFormResult')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('authModule.messages.profileNotEdited');
	});
});
