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
			:title="t('buddyTelegramPlugin.headings.aboutTelegramSettings')"
			:description="t('buddyTelegramPlugin.texts.aboutTelegramSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyTelegramPlugin.fields.config.enabled.title')"
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
			:label="t('buddyTelegramPlugin.fields.config.botToken.title')"
			prop="botToken"
		>
			<el-input
				v-model="model.botToken"
				:placeholder="t('buddyTelegramPlugin.fields.config.botToken.placeholder')"
				name="botToken"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyTelegramPlugin.fields.config.botToken.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyTelegramPlugin.fields.config.allowedUserIds.title')"
			prop="allowedUserIds"
		>
			<el-input
				v-model="model.allowedUserIds"
				:placeholder="t('buddyTelegramPlugin.fields.config.allowedUserIds.placeholder')"
				name="allowedUserIds"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyTelegramPlugin.fields.config.allowedUserIds.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { ITelegramConfigEditForm } from '../schemas/config.types';

import type { ITelegramConfigFormProps } from './telegram-config-form.types';

defineOptions({
	name: 'TelegramConfigForm',
});

const props = withDefaults(defineProps<ITelegramConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<ITelegramConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyTelegramPlugin.messages.config.edited'),
		error: t('buddyTelegramPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<ITelegramConfigEditForm>>({});

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
