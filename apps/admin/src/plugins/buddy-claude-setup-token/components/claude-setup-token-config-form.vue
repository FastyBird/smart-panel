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
			:title="t('buddyClaudeSetupTokenPlugin.headings.aboutApiSettings')"
			:closable="false"
		>
			{{ t('buddyClaudeSetupTokenPlugin.texts.aboutApiSettings') }}
		</el-alert>

		<el-form-item
			:label="t('buddyClaudeSetupTokenPlugin.fields.config.enabled.title')"
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
			:label="t('buddyClaudeSetupTokenPlugin.fields.config.accessToken.title')"
			prop="accessToken"
		>
			<el-input
				v-model="model.accessToken"
				:placeholder="t('buddyClaudeSetupTokenPlugin.fields.config.accessToken.placeholder')"
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
			{{ t('buddyClaudeSetupTokenPlugin.fields.config.accessToken.howTo') }}
			<code class="font-bold">claude setup-token</code>
			{{ t('buddyClaudeSetupTokenPlugin.fields.config.accessToken.howToSuffix') }}
			<br />
			{{ t('buddyClaudeSetupTokenPlugin.fields.config.accessToken.machineNote') }}
		</el-alert>

		<el-form-item
			:label="t('buddyClaudeSetupTokenPlugin.fields.config.model.title')"
			prop="model"
		>
			<el-select
				v-model="model.model"
				:placeholder="t('buddyClaudeSetupTokenPlugin.fields.config.model.placeholder')"
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
				{{ t('buddyClaudeSetupTokenPlugin.fields.config.model.description') }}
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
import { BUDDY_CLAUDE_SETUP_TOKEN_MODELS } from '../buddy-claude-setup-token.models';
import type { IClaudeSetupTokenConfigEditForm } from '../schemas/config.types';

import type { IClaudeSetupTokenConfigFormProps } from './claude-setup-token-config-form.types';

defineOptions({
	name: 'ClaudeSetupTokenConfigForm',
});

const props = withDefaults(defineProps<IClaudeSetupTokenConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IClaudeSetupTokenConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyClaudeSetupTokenPlugin.messages.config.edited'),
		error: t('buddyClaudeSetupTokenPlugin.messages.config.notEdited'),
	},
});

const modelOptions = BUDDY_CLAUDE_SETUP_TOKEN_MODELS;

const rules = reactive<FormRules<IClaudeSetupTokenConfigEditForm>>({});

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
