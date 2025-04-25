<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('usersModule.fields.username.title')"
			:prop="['username']"
		>
			<el-input
				v-model="model.username"
				name="username"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.password.title')"
			:prop="['password']"
		>
			<el-input
				v-model="model.password"
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
				v-model="model.repeatPassword"
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
				v-model="model.email"
				:placeholder="t('usersModule.fields.email.placeholder')"
				name="email"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.firstName.title')"
			:prop="['firstName']"
		>
			<el-input
				v-model="model.firstName"
				:placeholder="t('usersModule.fields.firstName.placeholder')"
				name="firstName"
			/>
		</el-form-item>

		<el-form-item
			:label="t('usersModule.fields.lastName.title')"
			:prop="['lastName']"
		>
			<el-input
				v-model="model.lastName"
				:placeholder="t('usersModule.fields.lastName.placeholder')"
				name="lastName"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('usersModule.fields.role.title')"
			:prop="['role']"
		>
			<el-select
				v-model="model.role"
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
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { InternalRuleItem } from 'async-validator';
import { ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, type FormRules } from 'element-plus';

import { UsersModuleUserRole } from '../../../openapi';
import { type IUserAddForm, useUserAddForm } from '../composables/composables';
import { FormResult, type FormResultType } from '../users.constants';

import type { IUserAddFormProps } from './user-add-form.types';

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
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, formChanged, submit, formResult } = useUserAddForm({ id: props.id });

const rules = reactive<FormRules<IUserAddForm>>({
	username: [{ required: true, message: t('usersModule.fields.username.validation.required'), trigger: 'change' }],
	password: [{ required: true, message: t('usersModule.fields.password.validation.required'), trigger: 'change' }],
	repeatPassword: [
		{ required: true, message: t('usersModule.fields.repeatPassword.validation.required'), trigger: 'change' },
		{
			validator: (_rule: InternalRuleItem, value: string, callback: (message?: Error) => void): void => {
				if (value === '') {
					callback(new Error(t('usersModule.fields.repeatPassword.validation.required')));
				} else if (value !== model.password) {
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

const roleOptions: { value: UsersModuleUserRole; label: string }[] = [
	{
		value: UsersModuleUserRole.user,
		label: t('usersModule.fields.role.options.user'),
	},
	{
		value: UsersModuleUserRole.admin,
		label: t('usersModule.fields.role.options.admin'),
	},
	{
		value: UsersModuleUserRole.owner,
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

			submit().catch(() => {
				// The form is not valid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
