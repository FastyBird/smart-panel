<template>
	<el-form
		ref="signFormEl"
		:model="signForm"
		:rules="rules"
		label-position="top"
		status-icon
		class="px-5"
		@submit.prevent="onSubmit"
	>
		<el-form-item
			:label="t('authModule.fields.username.title')"
			prop="username"
			class="mb-5"
		>
			<el-input
				v-model="signForm.username"
				name="username"
				@keyup.enter="handleEnterUsername"
			/>
		</el-form-item>

		<el-form-item
			:label="t('authModule.fields.password.title')"
			prop="password"
			class="mb-5"
		>
			<el-input
				ref="passwordInputEl"
				v-model="signForm.password"
				type="password"
				name="password"
				show-password
				@keyup.enter="handleEnterPassword"
			/>
		</el-form-item>

		<el-button
			type="primary"
			size="large"
			class="block w-full"
			@click="onSubmit(signFormEl)"
		>
			{{ t('authModule.buttons.signIn.title') }}
		</el-button>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElFormItem, ElInput, type FormInstance, type FormRules, type InputInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult, type FormResultType } from '../../auth.constants';
import { sessionStoreKey } from '../../store/keys';

import type { SignInFormFields, SignInFormProps } from './sign-in-form.types';

defineOptions({
	name: 'SignInForm',
});

const props = withDefaults(defineProps<SignInFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

const signFormEl = ref<FormInstance | undefined>(undefined);

const passwordInputEl = ref<InputInstance | undefined>(undefined);

const rules = reactive<FormRules<SignInFormFields>>({
	username: [{ required: true, message: t('authModule.fields.username.validation.required'), trigger: 'change' }],
	password: [{ required: true, message: t('authModule.fields.password.validation.required'), trigger: 'change' }],
});

const signForm = reactive<SignInFormFields>({
	username: '',
	password: '',
});

const onSubmit = async (formEl: FormInstance | undefined): Promise<void> => {
	if (!formEl) return;

	await formEl.validate(async (valid: boolean): Promise<void> => {
		if (valid) {
			emit('update:remoteFormResult', FormResult.WORKING);

			try {
				await sessionStore.create({ data: { username: signForm.username, password: signForm.password } });

				emit('update:remoteFormResult', FormResult.OK);
			} catch (error: unknown) {
				emit('update:remoteFormResult', FormResult.ERROR);

				const errorMessage = t('authModule.messages.requestError');

				if (error instanceof Error && 'exception' in error && error.exception instanceof Error) {
					flashMessage.exception(errorMessage);
				} else {
					flashMessage.error(errorMessage);
				}
			}
		}
	});
};

const handleEnterUsername = (): void => {
	passwordInputEl.value?.focus();
};

const handleEnterPassword = (): void => {
	onSubmit(signFormEl.value);
};

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remoteFormReset', false);

		if (val) {
			if (!signFormEl.value) return;

			signFormEl.value.resetFields();
		}
	}
);
</script>
