import { type ComponentPublicInstance, type Reactive, type Ref, reactive, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElSelect } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { UsersUserRole } from '../../../openapi';
import { FormResult } from '../../auth';
import type { IUserEditForm } from '../composables';
import enUS from '../locales/en-US.json';

import type { IUserEditFormProps } from './user-edit-form.types';
import UserEditForm from './user-edit-form.vue';

const editFormMock = {
	model: reactive({
		username: 'admin',
		firstName: 'Admin',
		lastName: 'User',
		email: 'admin@example.com',
		role: UsersUserRole.admin,
	}),
	formEl: ref({
		clearValidate: vi.fn(),
	}),
	submit: vi.fn().mockResolvedValue('saved'),
	formChanged: ref(false),
	formResult: ref(FormResult.NONE),
};

const usernameFormMock = {
	model: reactive({
		username: '',
	}),
	formEl: ref({
		clearValidate: vi.fn(),
	}),
	submit: vi.fn().mockResolvedValue('saved'),
	formResult: ref(FormResult.NONE),
};

const passwordFormMock = {
	model: reactive({
		username: '',
	}),
	formEl: ref({
		clearValidate: vi.fn(),
	}),
	submit: vi.fn().mockResolvedValue('saved'),
	formResult: ref(FormResult.NONE),
};

vi.mock('../composables', () => ({
	useUserEditForm: vi.fn(() => editFormMock),
	useUserUsernameForm: vi.fn(() => usernameFormMock),
	useUserPasswordForm: vi.fn(() => passwordFormMock),
}));

type UserEditFormInstance = ComponentPublicInstance<IUserEditFormProps> & {
	usernameFormVisible: Ref<boolean>;
	passwordFormVisible: Ref<boolean>;
	model: Reactive<IUserEditForm>;
};

describe('UserEditForm', (): void => {
	let wrapper: VueWrapper<UserEditFormInstance>;

	const mockUser = {
		id: '1',
		username: 'admin',
		firstName: 'Admin',
		lastName: 'User',
		email: 'admin@example.com',
		role: UsersUserRole.admin,
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

		editFormMock.formChanged.value = true;

		const roleSelect = wrapper.findComponent(ElSelect);

		await roleSelect.setValue(UsersUserRole.user);

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.model.role).toBe(UsersUserRole.user);

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

		wrapper.vm.model.email = 'changed@example.com';

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.model.email).toBe('changed@example.com');

		await wrapper.setProps({ remoteFormReset: true });

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.model.email).toBe(mockUser.email);
	});
});
