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
			:title="t('devicesHomeAssistantPlugin.headings.aboutConnectionSettings')"
			:description="t('devicesHomeAssistantPlugin.texts.aboutConnectionSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.config.enabled.title')"
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
			:label="t('devicesHomeAssistantPlugin.fields.config.apiKey.title')"
			prop="apiKey"
		>
			<el-input
				v-model="model.apiKey"
				:placeholder="t('devicesHomeAssistantPlugin.fields.config.apiKey.placeholder')"
				name="apiKey"
				:rows="4"
				type="textarea"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.config.hostname.title')"
			prop="hostname"
		>
			<el-input
				v-model="model.hostname"
				:placeholder="t('devicesHomeAssistantPlugin.fields.config.hostname.placeholder')"
				name="hostname"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IHomeAssistantConfigEditForm } from '../schemas/config.types';

import type { IHomeAssistantConfigFormProps } from './home-assistant-config-form.types';

defineOptions({
	name: 'HomeAssistantConfigForm',
});

const props = withDefaults(defineProps<IHomeAssistantConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IHomeAssistantConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesHomeAssistantPlugin.messages.config.edited'),
		error: t('devicesHomeAssistantPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IHomeAssistantConfigEditForm>>({
	hostname: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.config.hostname.validation.required'), trigger: 'change' }],
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
				// The form is not valid
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

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
