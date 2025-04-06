<template>
	<el-form
		ref="profileFormEl"
		:model="profileForm"
		:rules="rules"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('authModule.fields.email.title')"
			prop="email"
		>
			<el-input
				v-model="profileForm.email"
				name="email"
			/>
		</el-form-item>

		<el-form-item
			:label="t('authModule.fields.firstName.title')"
			prop="firstName"
		>
			<el-input
				v-model="profileForm.firstName"
				name="firstName"
			/>
		</el-form-item>

		<el-form-item
			:label="t('authModule.fields.lastName.title')"
			prop="lastName"
		>
			<el-input
				v-model="profileForm.lastName"
				name="lastName"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, type FormInstance, type FormRules } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult, type FormResultType, Layout } from '../../auth.constants';
import { sessionStoreKey } from '../../store/keys';

import type { SettingsProfileFormFields, SettingsProfileFormProps } from './settings-profile-form.types';

defineOptions({
	name: 'SettingsProfileForm',
});

const props = withDefaults(defineProps<SettingsProfileFormProps>(), {
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

const profileFormEl = ref<FormInstance | undefined>(undefined);

const rules = reactive<FormRules<SettingsProfileFormFields>>({
	email: [
		{ required: false, message: t('authModule.fields.email.validation.required'), trigger: 'change' },
		{ type: 'email', message: t('authModule.fields.email.validation.email'), trigger: 'change' },
	],
	firstName: [{ required: false, message: t('authModule.fields.firstName.validation.required'), trigger: 'change' }],
	lastName: [{ required: false, message: t('authModule.fields.lastName.validation.required'), trigger: 'change' }],
});

const profileForm = reactive<SettingsProfileFormFields>({
	email: props.profile.email ?? '@',
	firstName: props.profile.firstName,
	lastName: props.profile.lastName,
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

			profileFormEl.value!.clearValidate();

			profileFormEl.value!.validate(async (valid: boolean): Promise<void> => {
				if (!valid) {
					return;
				}

				emit('update:remoteFormResult', FormResult.WORKING);

				const errorMessage = t('authModule.messages.profileNotEdited');

				try {
					await sessionStore.edit({
						id: props.profile.id,
						data: {
							firstName: profileForm.firstName,
							lastName: profileForm.lastName,
							email: profileForm.email,
						},
					});

					emit('update:remoteFormResult', FormResult.OK);

					flashMessage.success(t('authModule.messages.profileEdited'));

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
			profileForm.email = props.profile.email ?? '@';
			profileForm.firstName = props.profile.firstName;
			profileForm.lastName = props.profile.lastName;
		}
	}
);
</script>
