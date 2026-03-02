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
			:title="t('buddyClaudePlugin.headings.aboutApiSettings')"
			:description="t('buddyClaudePlugin.texts.aboutApiSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyClaudePlugin.fields.config.enabled.title')"
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
			:label="t('buddyClaudePlugin.fields.config.apiKey.title')"
			prop="apiKey"
		>
			<el-input
				v-model="model.apiKey"
				:placeholder="t('buddyClaudePlugin.fields.config.apiKey.placeholder')"
				name="apiKey"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyClaudePlugin.fields.config.apiKey.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyClaudePlugin.fields.config.model.title')"
			prop="model"
		>
			<el-input
				v-model="model.model"
				:placeholder="t('buddyClaudePlugin.fields.config.model.placeholder')"
				name="model"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyClaudePlugin.fields.config.model.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IClaudeConfigEditForm } from '../schemas/config.types';

import type { IClaudeConfigFormProps } from './claude-config-form.types';

defineOptions({
	name: 'ClaudeConfigForm',
});

const props = withDefaults(defineProps<IClaudeConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IClaudeConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyClaudePlugin.messages.config.edited'),
		error: t('buddyClaudePlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IClaudeConfigEditForm>>({});

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
