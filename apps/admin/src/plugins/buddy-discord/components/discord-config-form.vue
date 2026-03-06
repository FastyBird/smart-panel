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
			:title="t('buddyDiscordPlugin.headings.aboutDiscordSettings')"
			:description="t('buddyDiscordPlugin.texts.aboutDiscordSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.enabled.title')"
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
			:label="t('buddyDiscordPlugin.fields.config.botToken.title')"
			prop="botToken"
		>
			<el-input
				v-model="model.botToken"
				:placeholder="t('buddyDiscordPlugin.fields.config.botToken.placeholder')"
				name="botToken"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.botToken.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.guildId.title')"
			prop="guildId"
		>
			<el-input
				v-model="model.guildId"
				:placeholder="t('buddyDiscordPlugin.fields.config.guildId.placeholder')"
				name="guildId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.guildId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.generalChannelId.title')"
			prop="generalChannelId"
		>
			<el-input
				v-model="model.generalChannelId"
				:placeholder="t('buddyDiscordPlugin.fields.config.generalChannelId.placeholder')"
				name="generalChannelId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.generalChannelId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.spaceChannelMappings.title')"
			prop="spaceChannelMappings"
		>
			<el-input
				v-model="model.spaceChannelMappings"
				:placeholder="t('buddyDiscordPlugin.fields.config.spaceChannelMappings.placeholder')"
				name="spaceChannelMappings"
				type="textarea"
				:rows="3"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.spaceChannelMappings.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.allowedRoleId.title')"
			prop="allowedRoleId"
		>
			<el-input
				v-model="model.allowedRoleId"
				:placeholder="t('buddyDiscordPlugin.fields.config.allowedRoleId.placeholder')"
				name="allowedRoleId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.allowedRoleId.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IDiscordConfigEditForm } from '../schemas/config.types';

import type { IDiscordConfigFormProps } from './discord-config-form.types';

defineOptions({
	name: 'DiscordConfigForm',
});

const props = withDefaults(defineProps<IDiscordConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IDiscordConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyDiscordPlugin.messages.config.edited'),
		error: t('buddyDiscordPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IDiscordConfigEditForm>>({});

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
