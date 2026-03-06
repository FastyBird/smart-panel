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
			:title="t('buddyElevenlabsPlugin.headings.aboutApiSettings')"
			:description="t('buddyElevenlabsPlugin.texts.aboutApiSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyElevenlabsPlugin.fields.config.enabled.title')"
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
			:label="t('buddyElevenlabsPlugin.fields.config.apiKey.title')"
			prop="apiKey"
		>
			<el-input
				v-model="model.apiKey"
				:placeholder="t('buddyElevenlabsPlugin.fields.config.apiKey.placeholder')"
				name="apiKey"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyElevenlabsPlugin.fields.config.apiKey.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyElevenlabsPlugin.fields.config.voiceId.title')"
			prop="voiceId"
		>
			<el-input
				v-model="model.voiceId"
				:placeholder="t('buddyElevenlabsPlugin.fields.config.voiceId.placeholder')"
				name="voiceId"
				clearable
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyElevenlabsPlugin.fields.config.voiceId.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IElevenlabsConfigEditForm } from '../schemas/config.types';

import type { IElevenlabsConfigFormProps } from './elevenlabs-config-form.types';

defineOptions({
	name: 'ElevenlabsConfigForm',
});

const props = withDefaults(defineProps<IElevenlabsConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IElevenlabsConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyElevenlabsPlugin.messages.config.edited'),
		error: t('buddyElevenlabsPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IElevenlabsConfigEditForm>>({});

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
