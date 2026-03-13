<template>
	<el-form
		ref="unlockFormEl"
		:model="unlockForm"
		:rules="rules"
		label-position="top"
		status-icon
		class="px-5"
		@submit.prevent="onSubmit"
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

		<el-button
			type="primary"
			size="large"
			class="block w-full mb-3"
			@click="onSubmit(unlockFormEl)"
		>
			{{ t('authModule.buttons.unlock.title') }}
		</el-button>

		<div class="flex flex-row justify-between items-center mt-4">
			<el-button
				type="danger"
				link
				@click="onSignOut"
			>
				{{ t('authModule.buttons.signOut.title') }}
			</el-button>

			<el-button
				type="info"
				link
				@click="onSignInAsOther"
			>
				{{ t('authModule.buttons.signInAsOther.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElFormItem, ElInput, type FormInstance, type FormRules, type InputInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../../common';
import { FormResult, type FormResultType } from '../../auth.constants';
import { sessionStoreKey } from '../../store/keys';

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
	(e: 'signInAsOther'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

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
			const username = sessionStore.profile?.username;

			if (!username) {
				emit('update:remoteFormResult', FormResult.ERROR);

				return;
			}

			emit('update:remoteFormResult', FormResult.WORKING);

			try {
				await sessionStore.create({ data: { username, password: unlockForm.password } });

				emit('update:remoteFormResult', FormResult.OK);
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

const onSignInAsOther = (): void => {
	emit('signInAsOther');
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
