<template>
	<el-form
		ref="unlockFormEl"
		:model="unlockForm"
		:rules="rules"
		label-position="top"
		status-icon
		@submit.prevent
	>
		<el-form-item
			:label="t('authModule.fields.password.title')"
			prop="password"
			class="mb-5"
		>
			<el-input
				ref="passwordInputEl"
				v-model="unlockForm.password"
				type="password"
				name="password"
				show-password
				@keyup.enter="onSubmit(unlockFormEl)"
			/>
		</el-form-item>

		<div class="flex flex-col gap-3">
			<el-button
				type="primary"
				size="large"
				class="w-full ml-0!"
				data-test-id="unlock-submit"
				@click="onSubmit(unlockFormEl)"
			>
				{{ t('authModule.buttons.unlock.title') }}
			</el-button>

			<!-- Signing out ends nothing that cannot be had back by signing in, so it is not drawn in red -->
			<el-button
				size="large"
				class="w-full ml-0!"
				data-test-id="unlock-sign-out"
				@click="onSignOut"
			>
				{{ t('authModule.buttons.signOut.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElFormItem, ElInput, type FormInstance, type FormRules, type InputInstance } from 'element-plus';

import { useFlashMessage } from '../../../../common';
import { injectAccountManager } from '../../../../common/services/account-manager';
import { FormResult, type FormResultType } from '../../auth.constants';

import type { UnlockFormFields, UnlockFormProps } from './unlock-form.types';

defineOptions({
	name: 'UnlockForm',
});

const props = withDefaults(defineProps<UnlockFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
	(e: 'signOut'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const accountManager = injectAccountManager();

const unlockFormEl = ref<FormInstance | undefined>(undefined);
const passwordInputEl = ref<InputInstance | undefined>(undefined);

const rules = reactive<FormRules<UnlockFormFields>>({
	password: [{ required: true, message: t('authModule.fields.password.validation.required'), trigger: 'change' }],
});

const unlockForm = reactive<UnlockFormFields>({
	password: '',
});

const onSubmit = async (formEl: FormInstance | undefined): Promise<void> => {
	if (!formEl) return;

	await formEl.validate(async (valid: boolean): Promise<void> => {
		if (valid) {
			const username = accountManager?.details.value?.username;

			if (!username) {
				emit('update:remoteFormResult', FormResult.ERROR);

				flashMessage.error(t('authModule.messages.requestError'));

				return;
			}

			emit('update:remoteFormResult', FormResult.WORKING);

			try {
				const success = await accountManager!.signIn({ username, password: unlockForm.password });

				if (success) {
					emit('update:remoteFormResult', FormResult.OK);
				} else {
					emit('update:remoteFormResult', FormResult.ERROR);

					flashMessage.error(t('authModule.messages.invalidPassword'));
				}
			} catch {
				emit('update:remoteFormResult', FormResult.ERROR);

				flashMessage.error(t('authModule.messages.invalidPassword'));
			}
		}
	});
};

const onSignOut = (): void => {
	emit('signOut');
};

onMounted((): void => {
	passwordInputEl.value?.focus();
});

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remoteFormReset', false);

		if (val) {
			if (!unlockFormEl.value) return;

			unlockFormEl.value.resetFields();
		}
	}
);
</script>
