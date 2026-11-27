<template>
	<el-form
		ref="signFormEl"
		:model="signForm"
		:rules="rules"
		label-position="top"
		status-icon
		@submit.prevent="onSubmit(signFormEl)"
	>
		<div class="grid grid-cols-1 tp:grid-cols-2 gap-x-4">
			<el-form-item
				:label="t('authModule.fields.firstName.title')"
				prop="firstName"
			>
				<el-input
					v-model="signForm.firstName"
					:placeholder="t('authModule.fields.firstName.placeholder')"
					name="firstName"
				/>
			</el-form-item>

			<el-form-item
				:label="t('authModule.fields.lastName.title')"
				prop="lastName"
			>
				<el-input
					v-model="signForm.lastName"
					:placeholder="t('authModule.fields.lastName.placeholder')"
					name="lastName"
				/>
			</el-form-item>
		</div>

		<div class="mb-5">
			<el-form-item
				:label="t('authModule.fields.email.title')"
				prop="email"
			>
				<el-input
					v-model="signForm.email"
					:placeholder="t('authModule.fields.email.placeholder')"
					name="email"
				/>
			</el-form-item>
		</div>

		<div class="mb-5">
			<el-form-item
				:label="t('authModule.fields.username.title')"
				prop="username"
			>
				<el-input
					v-model="signForm.username"
					name="username"
					type="text"
				/>
			</el-form-item>
		</div>

		<div class="mb-5">
			<el-form-item
				:label="t('authModule.fields.password.title')"
				prop="password"
			>
				<el-input
					v-model="signForm.password"
					show-password
					name="password"
					type="password"
				/>
			</el-form-item>
		</div>

		<div class="flex flex-col gap-3">
			<el-button
				type="primary"
				size="large"
				class="w-full ml-0!"
				data-test-id="sign-up-submit"
				@click="onSubmit(signFormEl)"
			>
				{{ t('authModule.buttons.signUp.title') }}
			</el-button>

			<el-button
				size="large"
				class="w-full ml-0!"
				data-test-id="sign-up-back"
				@click="onBackToSignIn()"
			>
				{{ t('authModule.buttons.backToSignIn.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElForm, ElFormItem, ElInput, type FormInstance, type FormRules } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult, type FormResultType, RouteNames } from '../../auth.constants';
import { sessionStoreKey } from '../../store/keys';

import type { SignUpFormFields, SignUpFormProps } from './sign-up-form.types';

defineOptions({
	name: 'SignUpForm',
});

const props = withDefaults(defineProps<SignUpFormProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const router = useRouter();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

const signFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<SignUpFormFields>>({
	email: [
		{ required: true, message: t('authModule.fields.email.validation.required'), trigger: 'change' },
		{ type: 'email', message: t('authModule.fields.email.validation.email'), trigger: 'change' },
	],
	firstName: [{ required: true, message: t('authModule.fields.firstName.validation.required'), trigger: 'change' }],
	lastName: [{ required: true, message: t('authModule.fields.lastName.validation.required'), trigger: 'change' }],
	username: [{ required: true, message: t('authModule.fields.username.validation.required'), trigger: 'change' }],
	password: [{ required: true, message: t('authModule.fields.password.validation.required'), trigger: 'change' }],
});

const signForm = reactive<SignUpFormFields>({
	username: '',
	password: '',
	email: '',
	firstName: '',
	lastName: '',
});

const onSubmit = async (formEl: FormInstance | undefined): Promise<void> => {
	if (!formEl) return;

	await formEl.validate(async (valid: boolean): Promise<void> => {
		if (valid) {
			emit('update:remoteFormResult', FormResult.WORKING);

			try {
				await sessionStore.register({
					data: {
						username: signForm.username,
						password: signForm.password,
						firstName: signForm.firstName,
						lastName: signForm.lastName,
						email: signForm.email,
					},
				});

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

const onBackToSignIn = (): void => {
	router.push({ name: RouteNames.SIGN_IN });
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
