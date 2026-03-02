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
			:closable="false"
		>
			{{ t('buddyClaudeOauthPlugin.texts.aboutApiSettings') }}
		</el-alert>

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

		<el-alert
			type="info"
			:closable="false"
			show-icon
			class="mb-2!"
		>
			{{ t('buddyClaudeOauthPlugin.fields.config.accessToken.howTo') }}
			<code class="font-bold">claude setup-token</code>
			{{ t('buddyClaudeOauthPlugin.fields.config.accessToken.howToSuffix') }}
			<br />
			{{ t('buddyClaudeOauthPlugin.fields.config.accessToken.machineNote') }}
		</el-alert>

		<el-form-item
			:label="t('buddyClaudeOauthPlugin.fields.config.model.title')"
			prop="model"
		>
			<el-select
				v-model="model.model"
				:placeholder="t('buddyClaudeOauthPlugin.fields.config.model.placeholder')"
				filterable
				allow-create
				default-first-option
				class="w-full"
			>
				<el-option
					v-for="option in modelOptions"
					:key="option"
					:label="option"
					:value="option"
				/>
			</el-select>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyClaudeOauthPlugin.fields.config.model.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElSelect,
	ElSwitch,
	type FormRules,
} from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { BUDDY_CLAUDE_OAUTH_MODELS } from '../buddy-claude-oauth.models';
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

const modelOptions = BUDDY_CLAUDE_OAUTH_MODELS;

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
