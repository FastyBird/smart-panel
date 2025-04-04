import { type ComponentPublicInstance, reactive, ref } from 'vue';

import { ElForm, ElFormItem, ElInput } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { UsersUserRole } from '../../../openapi';
import { FormResult } from '../../auth';
import { useUserUsernameForm } from '../composables';

import type { IUsernameEditFormProps } from './username-edit-form.types';
import UsernameEditForm from './username-edit-form.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

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
	useUserUsernameForm: vi.fn(() => editFormMock),
}));

type UsernameEditFormInstance = ComponentPublicInstance<IUsernameEditFormProps>;

describe('UsernameEditForm', (): void => {
	let wrapper: VueWrapper<UsernameEditFormInstance>;

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

	const createWrapper = (props: Partial<IUsernameEditFormProps> = {}): void => {
		wrapper = mount(UsernameEditForm, {
			props: {
				user: mockUser,
				remoteFormSubmit: false,
				remoteFormReset: false,
				remoteFormResult: FormResult.NONE,
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

	it('renders the form correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findComponent(ElForm).findComponent(ElFormItem).exists()).toBe(true);
		expect(wrapper.findComponent(ElForm).findComponent(ElInput).exists()).toBe(true);
	});

	it('calls submit when the form is submitted', async (): Promise<void> => {
		const { submit } = useUserUsernameForm({ user: mockUser });

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(submit).toHaveBeenCalled();
	});

	it('emits `update:remote-form-result` on form result change', async (): Promise<void> => {
		const { formResult } = useUserUsernameForm({ user: mockUser });

		formResult.value = FormResult.OK;

		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:remote-form-result')).toBeTruthy();
		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.OK]);
	});

	it('emits `update:remote-form-reset` when form reset is triggered', async (): Promise<void> => {
		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-reset')).toBeTruthy();
		expect(wrapper.emitted('update:remote-form-reset')?.[0]).toEqual([false]);
	});
});
