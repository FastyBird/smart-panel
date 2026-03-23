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
			:title="t('devicesReTerminalPlugin.headings.aboutPluginStatus')"
			:description="t('devicesReTerminalPlugin.texts.aboutPluginStatus')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesReTerminalPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesReTerminalPlugin.headings.aboutPolling')"
			:description="t('devicesReTerminalPlugin.texts.aboutPolling')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesReTerminalPlugin.fields.config.polling.interval.title')"
			prop="polling.interval"
			class="mt-3"
		>
			<el-input-number
				v-model="model.polling.interval"
				:min="1000"
				:step="1000"
				name="polling.interval"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInputNumber, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IReTerminalConfigEditForm } from '../schemas/config.types';

import type { IReTerminalConfigFormProps } from './reterminal-config-form.types';

defineOptions({
	name: 'ReTerminalConfigForm',
});

const props = withDefaults(defineProps<IReTerminalConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IReTerminalConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesReTerminalPlugin.messages.config.edited'),
		error: t('devicesReTerminalPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IReTerminalConfigEditForm>>({
	'polling.interval': [
		{ required: true, message: t('devicesReTerminalPlugin.fields.config.polling.interval.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesReTerminalPlugin.fields.config.polling.interval.validation.number'),
			validator: (rule, value) => value >= 1000,
			trigger: 'change',
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
