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
			:title="t('notificationsTelegramPlugin.headings.aboutTelegramSettings')"
			:description="t('notificationsTelegramPlugin.texts.aboutTelegramSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('notificationsTelegramPlugin.fields.config.enabled.title')"
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
			:label="t('notificationsTelegramPlugin.fields.config.botToken.title')"
			prop="botToken"
		>
			<config-secret-input
				v-model="model.botToken"
				:configured="model.botTokenConfigured"
				:placeholder="t('notificationsTelegramPlugin.fields.config.botToken.placeholder')"
				name="botToken"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsTelegramPlugin.fields.config.botToken.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('notificationsTelegramPlugin.fields.config.chatId.title')"
			prop="chatId"
		>
			<el-input
				v-model="model.chatId"
				:placeholder="t('notificationsTelegramPlugin.fields.config.chatId.placeholder')"
				name="chatId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('notificationsTelegramPlugin.fields.config.chatId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('notificationsTelegramPlugin.fields.config.minSeverity.title')"
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
				{{ t('notificationsTelegramPlugin.fields.config.minSeverity.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { INotificationsTelegramConfigEditForm } from '../schemas/config.types';

import type { INotificationsTelegramConfigFormProps } from './telegram-config-form.types';

defineOptions({
	name: 'NotificationsTelegramConfigForm',
});

const props = withDefaults(defineProps<INotificationsTelegramConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<INotificationsTelegramConfigEditForm>({
	config: props.config,
	messages: {
		success: t('notificationsTelegramPlugin.messages.config.edited'),
		error: t('notificationsTelegramPlugin.messages.config.notEdited'),
	},
});

const severityOptions: { value: 'info' | 'warning' | 'error' | 'critical'; label: string }[] = [
	{ value: 'info', label: t('notificationsTelegramPlugin.fields.config.minSeverity.options.info') },
	{ value: 'warning', label: t('notificationsTelegramPlugin.fields.config.minSeverity.options.warning') },
	{ value: 'error', label: t('notificationsTelegramPlugin.fields.config.minSeverity.options.error') },
	{ value: 'critical', label: t('notificationsTelegramPlugin.fields.config.minSeverity.options.critical') },
];

const rules = reactive<FormRules<INotificationsTelegramConfigEditForm>>({});

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
