<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		@submit="submit"
	>
		<el-form-item
			:label="t('usersModule.fields.newPassword.title')"
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
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { InternalRuleItem } from 'async-validator';
import { ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { type IUserPasswordForm, useUserPasswordForm } from '../composables/composables';
import { FormResult, type FormResultType } from '../users.constants';

import type { IPasswordEditFormProps } from './password-edit-form.types';

defineOptions({
	name: 'PasswordEditForm',
});

const props = withDefaults(defineProps<IPasswordEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, submit, formResult } = useUserPasswordForm({
	user: props.user,
	messages: {
		success: t('usersModule.messages.passwordEdited'),
		error: t('usersModule.messages.passwordNotEdited'),
	},
});

const rules = reactive<FormRules<IUserPasswordForm>>({
	password: [{ required: true, message: t('usersModule.fields.newPassword.validation.required'), trigger: 'change' }],
	repeatPassword: [
		{ required: true, message: t('usersModule.fields.newRepeatPassword.validation.required'), trigger: 'change' },
		{
			validator: (_rule: InternalRuleItem, value: string, callback: (message?: Error) => void): void => {
				if (value === '') {
					callback(new Error(t('usersModule.fields.newRepeatPassword.validation.required')));
				} else if (value !== model.password) {
					callback(new Error(t('usersModule.fields.newRepeatPassword.validation.different')));
				} else {
					callback();
				}
			},
			trigger: 'blur',
		},
	],
});

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
				// Form is not valid
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
</script>
