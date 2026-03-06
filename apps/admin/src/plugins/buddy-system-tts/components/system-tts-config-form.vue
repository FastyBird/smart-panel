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
			:title="t('buddySystemTtsPlugin.headings.aboutSettings')"
			:description="t('buddySystemTtsPlugin.texts.aboutSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddySystemTtsPlugin.fields.config.enabled.title')"
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
			:label="t('buddySystemTtsPlugin.fields.config.engine.title')"
			prop="engine"
		>
			<el-input
				v-model="model.engine"
				:placeholder="t('buddySystemTtsPlugin.fields.config.engine.placeholder')"
				name="engine"
				clearable
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddySystemTtsPlugin.fields.config.engine.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddySystemTtsPlugin.fields.config.voice.title')"
			prop="voice"
		>
			<el-input
				v-model="model.voice"
				:placeholder="t('buddySystemTtsPlugin.fields.config.voice.placeholder')"
				name="voice"
				clearable
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddySystemTtsPlugin.fields.config.voice.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { ISystemTtsConfigEditForm } from '../schemas/config.types';

import type { ISystemTtsConfigFormProps } from './system-tts-config-form.types';

defineOptions({
	name: 'SystemTtsConfigForm',
});

const props = withDefaults(defineProps<ISystemTtsConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<ISystemTtsConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddySystemTtsPlugin.messages.config.edited'),
		error: t('buddySystemTtsPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<ISystemTtsConfigEditForm>>({});

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
