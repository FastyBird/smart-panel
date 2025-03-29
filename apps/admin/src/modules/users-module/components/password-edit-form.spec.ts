import { type ComponentPublicInstance, reactive, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { UsersUserRole } from '../../../openapi';
import { FormResult } from '../../auth-module';
import { useUserPasswordForm } from '../composables';
import enUS from '../locales/en-US.json';

import { PasswordEditForm } from './index';
import type { IPasswordEditFormProps } from './password-edit-form.types';

const editFormMock = {
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
	useUserPasswordForm: vi.fn(() => editFormMock),
}));

type PasswordEditFormInstance = ComponentPublicInstance<IPasswordEditFormProps>;

describe('PasswordEditForm', (): void => {
	let wrapper: VueWrapper<PasswordEditFormInstance>;

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

	const createWrapper = (props: Partial<IPasswordEditFormProps> = {}): void => {
		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					usersModule: enUS,
				},
			},
		});

		wrapper = mount(PasswordEditForm, {
			global: {
				plugins: [i18n],
			},
			props: {
				user: mockUser,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				...props,
			},
		});
	};

	beforeEach((): void => {
		createWrapper();
	});

	afterEach((): void => {
		wrapper.unmount();
	});

	it('renders correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).findAllComponents(ElFormItem).length).toBe(2);
		expect(wrapper.findComponent(ElForm).findAllComponents(ElInput).length).toBe(2);
	});

	it('calls submit when the form is submitted', async (): Promise<void> => {
		const { submit } = useUserPasswordForm(mockUser);

		const form = wrapper.findComponent(ElForm);

		const passwordInput = form.findAllComponents(ElInput)[0];
		expect(passwordInput.exists()).toBe(true);

		const repeatPasswordInput = form.findAllComponents(ElInput)[1];
		expect(repeatPasswordInput.exists()).toBe(true);

		await passwordInput.setValue('password123');

		await repeatPasswordInput.setValue('password123');

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(submit).toHaveBeenCalled();
	});

	it('submits the form when valid', async (): Promise<void> => {
		const { submit } = useUserPasswordForm(mockUser);

		const form = wrapper.findComponent(ElForm);

		const passwordInput = form.findAllComponents(ElInput)[0];
		expect(passwordInput.exists()).toBe(true);

		const repeatPasswordInput = form.findAllComponents(ElInput)[1];
		expect(repeatPasswordInput.exists()).toBe(true);

		await passwordInput.setValue('password123');
		await repeatPasswordInput.setValue('password123');

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(submit).toHaveBeenCalled();
		expect(submit).toHaveBeenCalled();
	});
});
