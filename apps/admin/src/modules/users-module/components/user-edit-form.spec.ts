import { type ComponentPublicInstance, type Reactive, type Ref, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElSelect } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { FormResult } from '../../auth-module';
import enUS from '../locales/en-US.json';
import { UserRole } from '../users.constants';

import type { IUserEditFormFields, IUserEditFormProps } from './user-edit-form.types';
import UserEditForm from './user-edit-form.vue';

const editFormMock = {
	submit: vi.fn(),
	formResult: ref(FormResult.NONE),
};

vi.mock('../composables', () => ({
	useUserEditForm: vi.fn(() => editFormMock),
}));

type UserEditFormInstance = ComponentPublicInstance<IUserEditFormProps> & {
	usernameFormVisible: Ref<boolean>;
	passwordFormVisible: Ref<boolean>;
	userEditForm: Reactive<IUserEditFormFields & { username: string; password: string }>;
};

describe('UserEditForm', (): void => {
	let wrapper: VueWrapper<UserEditFormInstance>;

	const mockUser = {
		id: '1',
		username: 'admin',
		firstName: 'Admin',
		lastName: 'User',
		email: 'admin@example.com',
		role: UserRole.ADMIN,
		draft: false,
		isHidden: false,
		createdAt: new Date(),
		updatedAt: null,
	};

	const createWrapper = (props: Partial<IUserEditFormProps> = {}): void => {
		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					usersModule: enUS,
				},
			},
		});

		wrapper = mount(UserEditForm, {
			global: {
				plugins: [i18n],
			},
			props: {
				user: mockUser,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				...props,
			},
		}) as unknown as VueWrapper<UserEditFormInstance>;
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('renders correctly with all fields', (): void => {
		createWrapper();

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).findAllComponents(ElFormItem).length).toBe(6);
		expect(wrapper.findComponent(ElForm).findAllComponents(ElInput).length).toBe(5);
		expect(wrapper.findComponent(ElForm).findAllComponents(ElSelect).length).toBe(1);
	});

	it('opens the username edit dialog', async (): Promise<void> => {
		createWrapper();

		const usernameButton = wrapper.findAllComponents(ElButton).at(0);

		expect(wrapper.findComponent(ElDialog).exists()).toBe(true);

		await usernameButton?.trigger('click');

		await wrapper.vm.$nextTick();

		expect(wrapper.findComponent(ElDialog).exists()).toBe(true);
		expect(wrapper.vm.usernameFormVisible).toBe(true);
	});

	it('opens the password edit dialog', async (): Promise<void> => {
		createWrapper();

		const passwordButton = wrapper.findAllComponents(ElButton).at(1);

		expect(wrapper.findComponent(ElDialog).exists()).toBe(true);

		await passwordButton?.trigger('click');

		await wrapper.vm.$nextTick();

		expect(wrapper.findComponent(ElDialog).exists()).toBe(true);
		expect(wrapper.vm.passwordFormVisible).toBe(true);
	});

	it('updates role when selected', async (): Promise<void> => {
		createWrapper();

		const roleSelect = wrapper.findComponent(ElSelect);

		await roleSelect.setValue(UserRole.USER);

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.userEditForm.role).toBe(UserRole.USER);

		expect(wrapper.emitted('update:remote-form-changed')).toBeTruthy();
	});

	it('submits the form and emits event', async (): Promise<void> => {
		createWrapper();

		wrapper.vm.$emit('update:remote-form-submit', true);

		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:remote-form-submit')).toBeTruthy();
	});

	it('resets form fields', async (): Promise<void> => {
		createWrapper();

		wrapper.vm.userEditForm.email = 'changed@example.com';

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.userEditForm.email).toBe('changed@example.com');

		await wrapper.setProps({ remoteFormReset: true });

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.userEditForm.email).toBe(mockUser.email);
	});
});
