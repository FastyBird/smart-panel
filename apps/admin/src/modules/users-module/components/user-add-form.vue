<template>
	<el-form
		ref="userAddFormEl"
		:model="userAddForm"
		:rules="rules"
		label-position="top"
		status-icon
		class="px-5"
	>
		<el-form-item
			:label="t('usersModule.fields.username.title')"
			:prop="['username']"
		>
			<el-input
				v-model="userAddForm.username"
				name="username"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.password.title')"
			:prop="['password']"
		>
			<el-input
				v-model="userAddForm.password"
				name="password"
				type="password"
				show-password
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.repeatPassword.title')"
			:prop="['repeatPassword']"
		>
			<el-input
				v-model="userAddForm.repeatPassword"
				name="repeatPassword"
				type="password"
				show-password
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('usersModule.fields.email.title')"
			:prop="['email']"
		>
			<el-input
				v-model="userAddForm.email"
				:placeholder="t('usersModule.fields.email.placeholder')"
				name="email"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.firstName.title')"
			:prop="['firstName']"
		>
			<el-input
				v-model="userAddForm.firstName"
				:placeholder="t('usersModule.fields.firstName.placeholder')"
				name="firstName"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.lastName.title')"
			:prop="['lastName']"
		>
			<el-input
				v-model="userAddForm.lastName"
				:placeholder="t('usersModule.fields.lastName.placeholder')"
				name="lastName"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('usersModule.fields.role.label')"
			:prop="['role']"
		>
			<el-select
				v-model="userAddForm.role"
				:placeholder="t('usersModule.fields.role.placeholder')"
				name="role"
			>
				<el-option
					v-for="item in roleOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { InternalRuleItem } from 'async-validator';
import { ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, type FormInstance, type FormRules } from 'element-plus';

import { useUserAddForm } from '../composables';
import { FormResult, type FormResultType, UserRole } from '../users.constants';

import type { IUserAddFormFields, IUserAddFormProps } from './user-add-form.types';

defineOptions({
	name: 'UserAddForm',
});

const props = withDefaults(defineProps<IUserAddFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formUpdated: boolean): void;
}>();

const { t } = useI18n();

const { submit, formResult } = useUserAddForm(props.id);

const userAddFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<IUserAddFormFields>>({
	username: [{ required: true, message: t('usersModule.fields.username.validation.required'), trigger: 'change' }],
	password: [{ required: true, message: t('usersModule.fields.password.validation.required'), trigger: 'change' }],
	repeatPassword: [
		{ required: true, message: t('usersModule.fields.repeatPassword.validation.required'), trigger: 'change' },
		{
			validator: (_rule: InternalRuleItem, value: string, callback: (message?: Error) => void): void => {
				if (value === '') {
					callback(new Error(t('usersModule.fields.repeatPassword.validation.required')));
				} else if (value !== userAddForm.password) {
					callback(new Error(t('usersModule.fields.repeatPassword.validation.different')));
				} else {
					callback();
				}
			},
			trigger: 'blur',
		},
	],
	email: [{ type: 'email', message: t('usersModule.fields.email.validation.email'), trigger: 'change' }],
	role: [{ required: true, message: t('usersModule.fields.role.validation.required'), trigger: 'change' }],
});

const userAddForm = reactive<IUserAddFormFields>({
	username: '',
	password: '',
	repeatPassword: '',
	email: '',
	firstName: '',
	lastName: '',
	role: UserRole.USER,
});

const formChanges = computed<boolean>((): boolean => {
	if (userAddForm.username !== '') {
		return true;
	} else if (userAddForm.password !== '') {
		return true;
	} else if (userAddForm.email !== '') {
		return true;
	} else if (userAddForm.firstName !== '') {
		return true;
	} else if (userAddForm.lastName !== '') {
		return true;
	} else if (userAddForm.role !== UserRole.USER) {
		return true;
	}

	return false;
});

const roleOptions: { value: UserRole; label: string }[] = [
	{
		value: UserRole.USER,
		label: t('usersModule.fields.role.options.user'),
	},
	{
		value: UserRole.ADMIN,
		label: t('usersModule.fields.role.options.admin'),
	},
	{
		value: UserRole.OWNER,
		label: t('usersModule.fields.role.options.owner'),
	},
];

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			userAddFormEl.value!.clearValidate();

			userAddFormEl.value!.validate(async (valid: boolean): Promise<void> => {
				if (!valid) {
					return;
				}

				await submit(userAddForm);
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!userAddFormEl.value) return;

			userAddFormEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanges.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
