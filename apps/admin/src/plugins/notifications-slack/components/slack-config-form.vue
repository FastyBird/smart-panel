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
			:title="t('notificationsSlackPlugin.headings.aboutSlackSettings')"
			:description="t('notificationsSlackPlugin.texts.aboutSlackSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('notificationsSlackPlugin.fields.config.enabled.title')"
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
			:label="t('notificationsSlackPlugin.fields.config.webhookUrl.title')"
			prop="webhookUrl"
		>
			<config-secret-input
				v-model="model.webhookUrl"
				:configured="model.webhookUrlConfigured"
				:placeholder="t('notificationsSlackPlugin.fields.config.webhookUrl.placeholder')"
				name="webhookUrl"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsSlackPlugin.fields.config.webhookUrl.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('notificationsSlackPlugin.fields.config.minSeverity.title')"
			prop="minSeverity"
		>
			<el-select
				v-model="model.minSeverity"
				class="w-full"
			>
				<el-option
					v-for="option in severityOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsSlackPlugin.fields.config.minSeverity.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { ISlackConfigEditForm } from '../schemas/config.types';
import { isValidSlackWebhookUrl } from '../schemas/slack-webhook-url.schemas';

import type { ISlackConfigFormProps } from './slack-config-form.types';

defineOptions({
	name: 'SlackConfigForm',
});

const props = withDefaults(defineProps<ISlackConfigFormProps>(), {
	remoteFormSubmit: false,
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<ISlackConfigEditForm>({
	config: props.config,
	messages: {
		success: t('notificationsSlackPlugin.messages.config.edited'),
		error: t('notificationsSlackPlugin.messages.config.notEdited'),
	},
});

const severityOptions: { value: 'info' | 'warning' | 'error' | 'critical'; label: string }[] = [
	{ value: 'info', label: t('notificationsSlackPlugin.fields.config.minSeverity.options.info') },
	{ value: 'warning', label: t('notificationsSlackPlugin.fields.config.minSeverity.options.warning') },
	{ value: 'error', label: t('notificationsSlackPlugin.fields.config.minSeverity.options.error') },
	{ value: 'critical', label: t('notificationsSlackPlugin.fields.config.minSeverity.options.critical') },
];

const rules = reactive<FormRules<ISlackConfigEditForm>>({
	webhookUrl: [
		{
			validator: (_rule, value, callback) => {
				if (typeof value === 'string' && value.trim() !== '' && !isValidSlackWebhookUrl(value)) {
					callback(new Error(t('notificationsSlackPlugin.fields.config.webhookUrl.invalid')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
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
