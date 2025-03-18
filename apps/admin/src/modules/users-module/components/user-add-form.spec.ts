import { type ComponentPublicInstance, type Reactive, type Ref, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElSelect } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { FormResult } from '../../auth-module';
import enUS from '../locales/en-US.json';
import { UserRole } from '../users.constants';

import { UserAddForm } from './index';
import type { IUserAddFormFields, IUserAddFormProps } from './user-add-form.types';

const addFormMock = {
	submit: vi.fn(),
	formResult: ref(FormResult.NONE),
};

vi.mock('../composables', () => ({
	useUserAddForm: vi.fn(() => addFormMock),
}));

type UserAddFormInstance = ComponentPublicInstance<IUserAddFormProps> & {
	usernameFormVisible: Ref<boolean>;
	passwordFormVisible: Ref<boolean>;
	userAddForm: Reactive<IUserAddFormFields & { username: string; password: string }>;
};

describe('UserAddForm', (): void => {
	let wrapper: VueWrapper<UserAddFormInstance>;

	const createWrapper = (props: Partial<IUserAddFormProps> = {}): void => {
		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					usersModule: enUS,
				},
			},
		});

		wrapper = mount(UserAddForm, {
			global: {
				plugins: [i18n],
			},
			props: {
				id: 'user1',
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				...props,
			},
		}) as VueWrapper<UserAddFormInstance>;
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('renders correctly with all fields', (): void => {
		createWrapper();

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).findAllComponents(ElFormItem).length).toBe(7);
		expect(wrapper.findComponent(ElForm).findAllComponents(ElInput).length).toBe(6);
		expect(wrapper.findComponent(ElForm).findAllComponents(ElSelect).length).toBe(1);
	});

	it('updates role when selected', async (): Promise<void> => {
		createWrapper();

		const roleSelect = wrapper.findComponent(ElSelect);

		await roleSelect.setValue(UserRole.ADMIN);

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.userAddForm.role).toBe(UserRole.ADMIN);

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

		wrapper.vm.userAddForm.email = 'new@example.com';

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.userAddForm.email).toBe('new@example.com');

		await wrapper.setProps({ remoteFormReset: true });

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.userAddForm.email).toBe('');
	});
});
