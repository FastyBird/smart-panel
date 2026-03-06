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
			:title="t('buddySttWhisperLocalPlugin.headings.aboutSettings')"
			:description="t('buddySttWhisperLocalPlugin.texts.aboutSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddySttWhisperLocalPlugin.fields.config.enabled.title')"
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
			:label="t('buddySttWhisperLocalPlugin.fields.config.model.title')"
			prop="model"
		>
			<el-input
				v-model="model.model"
				:placeholder="t('buddySttWhisperLocalPlugin.fields.config.model.placeholder')"
				name="model"
				clearable
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddySttWhisperLocalPlugin.fields.config.model.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddySttWhisperLocalPlugin.fields.config.language.title')"
			prop="language"
		>
			<el-input
				v-model="model.language"
				:placeholder="t('buddySttWhisperLocalPlugin.fields.config.language.placeholder')"
				name="language"
				clearable
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddySttWhisperLocalPlugin.fields.config.language.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { ISttWhisperLocalConfigEditForm } from '../schemas/config.types';

import type { ISttWhisperLocalConfigFormProps } from './stt-whisper-local-config-form.types';

defineOptions({
	name: 'SttWhisperLocalConfigForm',
});

const props = withDefaults(defineProps<ISttWhisperLocalConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<ISttWhisperLocalConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddySttWhisperLocalPlugin.messages.config.edited'),
		error: t('buddySttWhisperLocalPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<ISttWhisperLocalConfigEditForm>>({});

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
