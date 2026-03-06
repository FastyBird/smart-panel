<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-alert
			type="info"
			:title="t('buddyWhatsappPlugin.headings.aboutWhatsappSettings')"
			:description="t('buddyWhatsappPlugin.texts.aboutWhatsappSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.phoneNumberId.title')"
			prop="phoneNumberId"
		>
			<el-input
				v-model="model.phoneNumberId"
				:placeholder="t('buddyWhatsappPlugin.fields.config.phoneNumberId.placeholder')"
				name="phoneNumberId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyWhatsappPlugin.fields.config.phoneNumberId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.accessToken.title')"
			prop="accessToken"
		>
			<el-input
				v-model="model.accessToken"
				:placeholder="t('buddyWhatsappPlugin.fields.config.accessToken.placeholder')"
				name="accessToken"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyWhatsappPlugin.fields.config.accessToken.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.webhookVerifyToken.title')"
			prop="webhookVerifyToken"
		>
			<el-input
				v-model="model.webhookVerifyToken"
				:placeholder="t('buddyWhatsappPlugin.fields.config.webhookVerifyToken.placeholder')"
				name="webhookVerifyToken"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyWhatsappPlugin.fields.config.webhookVerifyToken.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.appSecret.title')"
			prop="appSecret"
		>
			<el-input
				v-model="model.appSecret"
				:placeholder="t('buddyWhatsappPlugin.fields.config.appSecret.placeholder')"
				name="appSecret"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyWhatsappPlugin.fields.config.appSecret.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyWhatsappPlugin.fields.config.allowedPhoneNumbers.title')"
			prop="allowedPhoneNumbers"
		>
			<el-input
				v-model="model.allowedPhoneNumbers"
				:placeholder="t('buddyWhatsappPlugin.fields.config.allowedPhoneNumbers.placeholder')"
				name="allowedPhoneNumbers"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyWhatsappPlugin.fields.config.allowedPhoneNumbers.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IWhatsappConfigEditForm } from '../schemas/config.types';

import type { IWhatsappConfigFormProps } from './whatsapp-config-form.types';

defineOptions({
	name: 'WhatsappConfigForm',
});

const props = withDefaults(defineProps<IWhatsappConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IWhatsappConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyWhatsappPlugin.messages.config.edited'),
		error: t('buddyWhatsappPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IWhatsappConfigEditForm>>({});

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
		if (val) {
			emit('update:remote-form-reset', false);

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
