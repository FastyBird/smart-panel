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
			:title="t('buddyClaudeOauthPlugin.headings.aboutApiSettings')"
			:description="t('buddyClaudeOauthPlugin.texts.aboutApiSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.enabled.title')"
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
			:label="t('buddyClaudeOauthPlugin.fields.config.clientId.title')"
			prop="clientId"
		>
			<el-input
				v-model="model.clientId"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.clientId.placeholder')"
				name="clientId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyClaudeOauthPlugin.fields.config.clientId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.clientSecret.title')"
			prop="clientSecret"
		>
			<el-input
				v-model="model.clientSecret"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.clientSecret.placeholder')"
				name="clientSecret"
				type="password"
				show-password
			/>
		</el-form-item>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.accessToken.title')"
			prop="accessToken"
		>
			<el-input
				v-model="model.accessToken"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.accessToken.placeholder')"
				name="accessToken"
				type="password"
				show-password
			/>
		</el-form-item>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.refreshToken.title')"
			prop="refreshToken"
		>
			<el-input
				v-model="model.refreshToken"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.refreshToken.placeholder')"
				name="refreshToken"
				type="password"
				show-password
			/>
		</el-form-item>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.model.title')"
			prop="model"
		>
			<el-input
				v-model="model.model"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.model.placeholder')"
				name="model"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyClaudeOauthPlugin.fields.config.model.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IClaudeOauthConfigEditForm } from '../schemas/config.types';

import type { IClaudeOauthConfigFormProps } from './claude-oauth-config-form.types';

defineOptions({
	name: 'ClaudeOauthConfigForm',
});

const props = withDefaults(defineProps<IClaudeOauthConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IClaudeOauthConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyClaudeOauthPlugin.messages.config.edited'),
		error: t('buddyClaudeOauthPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IClaudeOauthConfigEditForm>>({});

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
