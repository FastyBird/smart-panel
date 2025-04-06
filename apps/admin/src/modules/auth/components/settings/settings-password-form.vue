<template>
	<el-form
		ref="passwordFormEl"
		:model="passwordForm"
		:rules="rules"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('authModule.fields.currentPassword.title')"
			prop="currentPassword"
		>
			<el-input
				v-model="passwordForm.currentPassword"
				name="currentPassword"
				type="password"
				show-password
			/>
		</el-form-item>

		<el-form-item
			:label="t('authModule.fields.newPassword.title')"
			prop="newPassword"
		>
			<el-input
				v-model="passwordForm.newPassword"
				name="newPassword"
				type="password"
				show-password
			/>
		</el-form-item>

		<el-form-item
			:label="t('authModule.fields.repeatPassword.title')"
			prop="repeatPassword"
		>
			<el-input
				v-model="passwordForm.repeatPassword"
				name="repeatPassword"
				type="password"
				show-password
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { InternalRuleItem } from 'async-validator';
import { ElForm, ElFormItem, ElInput, type FormInstance, type FormRules } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult, type FormResultType, Layout } from '../../auth.constants';
import { sessionStoreKey } from '../../store/keys';

import type { SettingsPasswordFormFields, SettingsPasswordFormProps } from './settings-password-form.types';

defineOptions({
	name: 'SettingsPasswordForm',
});

const props = withDefaults(defineProps<SettingsPasswordFormProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

const passwordFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<SettingsPasswordFormFields>>({
	currentPassword: [{ required: true, message: t('authModule.fields.currentPassword.validation.required'), trigger: 'change' }],
	newPassword: [{ required: true, message: t('authModule.fields.newPassword.validation.required'), trigger: 'change' }],
	repeatPassword: [
		{
			validator: (_rule: InternalRuleItem, value: string, callback: (message?: Error) => void): void => {
				if (value === '') {
					callback(new Error(t('authModule.fields.repeatPassword.validation.required')));
				} else if (value !== passwordForm.newPassword) {
					callback(new Error(t('authModule.fields.repeatPassword.validation.different')));
				} else {
					callback();
				}
			},
			trigger: 'change',
		},
	],
});

const passwordForm = reactive<SettingsPasswordFormFields>({
	currentPassword: '',
	newPassword: '',
	repeatPassword: '',
});

let timer: number;

const clearResult = (): void => {
	window.clearTimeout(timer);

	emit('update:remoteFormResult', FormResult.NONE);
};

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remoteFormSubmit', false);

			passwordFormEl.value!.clearValidate();

			passwordFormEl.value!.validate(async (valid: boolean): Promise<void> => {
				if (!valid) {
					return;
				}

				emit('update:remoteFormResult', FormResult.WORKING);

				const errorMessage = t('authModule.messages.passwordNotEdited');

				try {
					await sessionStore.edit({
						id: props.profile.id,
						data: {
							password: {
								current: passwordForm.currentPassword,
								new: passwordForm.newPassword,
							},
						},
					});

					emit('update:remoteFormResult', FormResult.OK);

					flashMessage.success(t('authModule.messages.passwordEdited'));

					timer = window.setTimeout(clearResult, 2000);
				} catch (error: unknown) {
					if (error instanceof Error && 'exception' in error && error.exception instanceof Error) {
						flashMessage.exception(errorMessage);
					} else {
						flashMessage.error(errorMessage);
					}

					emit('update:remoteFormResult', FormResult.ERROR);

					timer = window.setTimeout(clearResult, 2000);
				}
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remoteFormReset', false);

		if (val) {
			passwordFormEl.value?.resetFields();

			passwordForm.currentPassword = '';
			passwordForm.newPassword = '';
			passwordForm.repeatPassword = '';
		}
	}
);
</script>
