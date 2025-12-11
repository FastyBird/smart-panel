<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('loggerRotatingFilePlugin.fields.config.enabled.title')"
			prop="enabled"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<hr />

		<el-form-item
			:label="t('loggerRotatingFilePlugin.fields.config.dir.title')"
			prop="dir"
			class="mt-3"
		>
			<el-input
				v-model="model.dir"
				:placeholder="t('loggerRotatingFilePlugin.fields.config.dir.placeholder')"
				name="dir"
			/>
		</el-form-item>

		<el-form-item
			:label="t('loggerRotatingFilePlugin.fields.config.retentionDays.title')"
			prop="retentionDays"
			class="mt-3"
		>
			<el-input-number
				v-model="model.retentionDays"
				:placeholder="t('loggerRotatingFilePlugin.fields.config.retentionDays.placeholder')"
				name="retentionDays"
			/>
		</el-form-item>

		<el-form-item
			:label="t('loggerRotatingFilePlugin.fields.config.cleanupCron.title')"
			prop="cleanupCron"
			class="mt-3"
		>
			<el-input
				v-model="model.cleanupCron"
				:placeholder="t('loggerRotatingFilePlugin.fields.config.cleanupCron.placeholder')"
				name="cleanupCron"
			/>
		</el-form-item>

		<el-form-item
			:label="t('loggerRotatingFilePlugin.fields.config.filePrefix.title')"
			prop="filePrefix"
			class="mt-3"
		>
			<el-input
				v-model="model.filePrefix"
				:placeholder="t('loggerRotatingFilePlugin.fields.config.filePrefix.placeholder')"
				name="filePrefix"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IRotatingFileConfigEditForm } from '../schemas/config.types';

import type { IRotatingFileConfigFormProps } from './rotating-file-config-form.types';

defineOptions({
	name: 'RotatingFileConfigForm',
});

const props = withDefaults(defineProps<IRotatingFileConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IRotatingFileConfigEditForm>({
	config: props.config,
	messages: {
		success: t('loggerRotatingFilePlugin.messages.config.edited'),
		error: t('loggerRotatingFilePlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IRotatingFileConfigEditForm>>({
	dir: [
		{
			type: 'string',
			trigger: 'change',
			message: t('loggerRotatingFilePlugin.fields.config.dir.validation.nonEmpty'),
		},
	],
	retentionDays: [
		{
			type: 'integer',
			min: 1,
			trigger: 'change',
			message: t('loggerRotatingFilePlugin.fields.config.retentionDays.validation.min'),
		},
	],
	cleanupCron: [
		{
			validator: (_rule, value: string) => isLikelyCron(value),
			trigger: 'blur',
			message: t('loggerRotatingFilePlugin.fields.config.cleanupCron.validation.invalid'),
		},
	],
	filePrefix: [
		{
			validator: (_rule, value: string) => isSafePrefix(value),
			trigger: 'blur',
			message: t('loggerRotatingFilePlugin.fields.config.filePrefix.validation.pattern'),
		},
	],
});

const isLikelyCron = (val: string): boolean => {
	if (val === '' || val === null) {
		return true;
	}

	const s = val.trim();

	return /^([\d*/?,\-]+)\s+([\d*/?,\-]+)\s+([\d*/?,\-]+)\s+([\d*/?,A-Za-z\-]+)\s+([\d*/?,A-Za-z\-]+)$/.test(s);
};

const isSafePrefix = (val: string): boolean => val === '' || val === null || /^[A-Za-z0-9._-]+$/.test(val ?? '');

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
