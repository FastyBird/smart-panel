<template>
	<el-form
		ref="usernameEditFormEl"
		:model="usernameEditForm"
		:rules="rules"
		label-position="top"
		status-icon
		class="px-5"
		@submit.prevent="submit"
	>
		<el-form-item
			:label="t('usersModule.fields.newUsername.title')"
			:prop="['username']"
		>
			<el-input
				v-model="usernameEditForm.username"
				name="username"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, type FormInstance, type FormRules } from 'element-plus';

import { useUserEditForm } from '../composables';
import { FormResult, type FormResultType } from '../users.constants';

import type { IUsernameEditFormFields, IUsernameEditFormProps } from './username-edit-form.types';

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

const { submit, formResult } = useUserEditForm(props.user, {
	success: t('usersModule.messages.usernameEdited'),
	error: t('usersModule.messages.usernameNotEdited'),
});

const usernameEditFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<IUsernameEditFormFields>>({
	username: [{ required: true, message: t('usersModule.fields.newUsername.validation.required'), trigger: 'change' }],
});

const usernameEditForm = reactive<IUsernameEditFormFields>({
	username: props.user.username,
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

			usernameEditFormEl.value!.clearValidate();

			usernameEditFormEl.value!.validate(async (valid: boolean): Promise<void> => {
				if (!valid) {
					return;
				}

				await submit({
					username: usernameEditForm.username,
				});
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!usernameEditFormEl.value) return;

			usernameEditFormEl.value.resetFields();
		}
	}
);
</script>
