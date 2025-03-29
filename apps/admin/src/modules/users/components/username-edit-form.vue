<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		class="xs:px-2 md:px-5"
		@submit.prevent="submit"
	>
		<el-form-item
			:label="t('usersModule.fields.newUsername.title')"
			:prop="['username']"
		>
			<el-input
				v-model="model.username"
				name="username"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { type IUserUsernameForm, useUserUsernameForm } from '../composables';
import { FormResult, type FormResultType } from '../users.constants';

import type { IUsernameEditFormProps } from './username-edit-form.types';

defineOptions({
	name: 'UsernameEditForm',
});

const props = withDefaults(defineProps<IUsernameEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, submit, formResult } = useUserUsernameForm(props.user, {
	success: t('usersModule.messages.usernameEdited'),
	error: t('usersModule.messages.usernameNotEdited'),
});

const rules = reactive<FormRules<IUserUsernameForm>>({
	username: [{ required: true, message: t('usersModule.fields.newUsername.validation.required'), trigger: 'change' }],
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
