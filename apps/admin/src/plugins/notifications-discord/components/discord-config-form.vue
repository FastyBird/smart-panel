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
			:title="t('notificationsDiscordPlugin.headings.aboutDiscordSettings')"
			:description="t('notificationsDiscordPlugin.texts.aboutDiscordSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('notificationsDiscordPlugin.fields.config.enabled.title')"
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
			:label="t('notificationsDiscordPlugin.fields.config.webhookUrl.title')"
			prop="webhookUrl"
		>
			<config-secret-input
				v-model="model.webhookUrl"
				:configured="model.webhookUrlConfigured"
				:placeholder="t('notificationsDiscordPlugin.fields.config.webhookUrl.placeholder')"
				name="webhookUrl"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsDiscordPlugin.fields.config.webhookUrl.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('notificationsDiscordPlugin.fields.config.username.title')"
			prop="username"
		>
			<el-input
				v-model="model.username"
				:placeholder="t('notificationsDiscordPlugin.fields.config.username.placeholder')"
				name="username"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsDiscordPlugin.fields.config.username.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('notificationsDiscordPlugin.fields.config.minSeverity.title')"
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
				{{ t('notificationsDiscordPlugin.fields.config.minSeverity.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { INotificationsDiscordConfigEditForm } from '../schemas/config.types';
import { isValidDiscordWebhookUrl } from '../schemas/discord-webhook-url.schemas';

import type { INotificationsDiscordConfigFormProps } from './discord-config-form.types';

defineOptions({
	name: 'NotificationsDiscordConfigForm',
});

const props = withDefaults(defineProps<INotificationsDiscordConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<INotificationsDiscordConfigEditForm>({
	config: props.config,
	messages: {
		success: t('notificationsDiscordPlugin.messages.config.edited'),
		error: t('notificationsDiscordPlugin.messages.config.notEdited'),
	},
});

const severityOptions: { value: 'info' | 'warning' | 'error' | 'critical'; label: string }[] = [
	{ value: 'info', label: t('notificationsDiscordPlugin.fields.config.minSeverity.options.info') },
	{ value: 'warning', label: t('notificationsDiscordPlugin.fields.config.minSeverity.options.warning') },
	{ value: 'error', label: t('notificationsDiscordPlugin.fields.config.minSeverity.options.error') },
	{ value: 'critical', label: t('notificationsDiscordPlugin.fields.config.minSeverity.options.critical') },
];

const rules = reactive<FormRules<INotificationsDiscordConfigEditForm>>({
	webhookUrl: [
		{
			validator: (_rule, value, callback) => {
				if (typeof value === 'string' && value.trim() !== '' && !isValidDiscordWebhookUrl(value)) {
					callback(new Error(t('notificationsDiscordPlugin.fields.config.webhookUrl.invalid')));
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
