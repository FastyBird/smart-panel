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
			:title="t('notificationsWebhookPlugin.headings.aboutWebhookSettings')"
			:description="t('notificationsWebhookPlugin.texts.aboutWebhookSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('notificationsWebhookPlugin.fields.config.enabled.title')"
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
			:label="t('notificationsWebhookPlugin.fields.config.url.title')"
			prop="url"
		>
			<config-secret-input
				v-model="model.url"
				:configured="model.urlConfigured"
				:placeholder="t('notificationsWebhookPlugin.fields.config.url.placeholder')"
				name="url"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsWebhookPlugin.fields.config.url.description') }}
			</div>
			<el-alert
				v-if="showHttpWarning"
				type="warning"
				:title="t('notificationsWebhookPlugin.fields.config.url.httpWarning')"
				:closable="false"
				class="mt-2"
			/>
		</el-form-item>

		<el-form-item
			:label="t('notificationsWebhookPlugin.fields.config.headers.title')"
			prop="headers"
		>
			<config-secret-input
				v-model="model.headers"
				:configured="model.headersConfigured"
				:placeholder="t('notificationsWebhookPlugin.fields.config.headers.placeholder')"
				type="textarea"
				:rows="4"
				name="headers"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsWebhookPlugin.fields.config.headers.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('notificationsWebhookPlugin.fields.config.minSeverity.title')"
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
				{{ t('notificationsWebhookPlugin.fields.config.minSeverity.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IWebhookConfigEditForm } from '../schemas/config.types';
import { isValidHeadersJson } from '../schemas/webhook-headers.schemas';
import { isValidWebhookUrl } from '../schemas/webhook-url.schemas';

import type { IWebhookConfigFormProps } from './webhook-config-form.types';

defineOptions({
	name: 'WebhookConfigForm',
});

const props = withDefaults(defineProps<IWebhookConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IWebhookConfigEditForm>({
	config: props.config,
	messages: {
		success: t('notificationsWebhookPlugin.messages.config.edited'),
		error: t('notificationsWebhookPlugin.messages.config.notEdited'),
	},
});

const severityOptions: { value: 'info' | 'warning' | 'error' | 'critical'; label: string }[] = [
	{ value: 'info', label: t('notificationsWebhookPlugin.fields.config.minSeverity.options.info') },
	{ value: 'warning', label: t('notificationsWebhookPlugin.fields.config.minSeverity.options.warning') },
	{ value: 'error', label: t('notificationsWebhookPlugin.fields.config.minSeverity.options.error') },
	{ value: 'critical', label: t('notificationsWebhookPlugin.fields.config.minSeverity.options.critical') },
];

const showHttpWarning = computed<boolean>(() => typeof model.url === 'string' && model.url.trim().toLowerCase().startsWith('http://'));

const rules = reactive<FormRules<IWebhookConfigEditForm>>({
	url: [
		{
			validator: (_rule, value, callback) => {
				if (typeof value === 'string' && value.trim() !== '' && !isValidWebhookUrl(value)) {
					callback(new Error(t('notificationsWebhookPlugin.fields.config.url.invalid')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	headers: [
		{
			validator: (_rule, value, callback) => {
				if (typeof value === 'string' && value.trim() !== '' && !isValidHeadersJson(value)) {
					callback(new Error(t('notificationsWebhookPlugin.fields.config.headers.invalidJson')));

					return;
				}

				const headersProvided = typeof value === 'string' && value.trim() !== '';

				if (showHttpWarning.value && headersProvided) {
					callback(new Error(t('notificationsWebhookPlugin.fields.config.headers.requiresHttps')));

					return;
				}

				callback();
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
