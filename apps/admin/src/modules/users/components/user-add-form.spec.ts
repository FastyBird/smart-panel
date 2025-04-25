import { type ComponentPublicInstance, type Reactive, type Ref, reactive, ref } from 'vue';

import { ElForm, ElFormItem, ElInput, ElSelect } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { UsersModuleUserRole } from '../../../openapi';
import { FormResult } from '../../auth';
import type { IUserAddForm } from '../composables/types';

import type { IUserAddFormProps } from './user-add-form.types';
import UserAddForm from './user-add-form.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const addFormMock = {
	model: reactive({
		username: '',
		password: '',
		repeatPassword: '',
		email: '',
		firstName: '',
		lastName: '',
		role: UsersModuleUserRole.user,
	}),
	formEl: ref({
		clearValidate: vi.fn(),
	}),
	submit: vi.fn().mockResolvedValue('saved'),
	formChanged: ref(false),
	formResult: ref(FormResult.NONE),
};

vi.mock('../composables/composables', () => ({
	useUserAddForm: vi.fn(() => addFormMock),
}));

type UserAddFormInstance = ComponentPublicInstance<IUserAddFormProps> & {
	usernameFormVisible: Ref<boolean>;
	passwordFormVisible: Ref<boolean>;
	model: Reactive<IUserAddForm>;
};

describe('UserAddForm', (): void => {
	let wrapper: VueWrapper<UserAddFormInstance>;

	const createWrapper = (props: Partial<IUserAddFormProps> = {}): void => {
		wrapper = mount(UserAddForm, {
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

		addFormMock.formChanged.value = true;

		const roleSelect = wrapper.findComponent(ElSelect);

		await roleSelect.setValue(UsersModuleUserRole.admin);

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.model.role).toBe(UsersModuleUserRole.admin);

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

		wrapper.vm.model.email = 'new@example.com';

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.model.email).toBe('new@example.com');

		await wrapper.setProps({ remoteFormReset: true });

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.model.email).toBe('');
	});
});
