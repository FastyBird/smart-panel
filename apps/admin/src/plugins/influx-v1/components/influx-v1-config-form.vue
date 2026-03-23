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
			:title="t('influxV1Plugin.headings.connection')"
			:description="t('influxV1Plugin.texts.about')"
			:closable="false"
		/>

		<el-form-item
			:label="t('influxV1Plugin.fields.config.host.title')"
			prop="host"
			class="mt-3"
		>
			<el-input
				v-model="model.host"
				:placeholder="t('influxV1Plugin.fields.config.host.placeholder')"
				name="host"
			/>
		</el-form-item>

		<el-form-item
			:label="t('influxV1Plugin.fields.config.database.title')"
			prop="database"
		>
			<el-input
				v-model="model.database"
				:placeholder="t('influxV1Plugin.fields.config.database.placeholder')"
				name="database"
			/>
		</el-form-item>

		<el-divider content-position="left" class="mt-6!">{{ t('influxV1Plugin.headings.authentication') }}</el-divider>

		<el-form-item
			:label="t('influxV1Plugin.fields.config.username.title')"
			prop="username"
		>
			<el-input
				v-model="model.username"
				:placeholder="t('influxV1Plugin.fields.config.username.placeholder')"
				name="username"
			/>
		</el-form-item>

		<el-form-item
			:label="t('influxV1Plugin.fields.config.password.title')"
			prop="password"
		>
			<el-input
				v-model="model.password"
				:placeholder="t('influxV1Plugin.fields.config.password.placeholder')"
				name="password"
				type="password"
				show-password
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IInfluxV1ConfigEditForm } from '../schemas/config.types';

import type { IInfluxV1ConfigFormProps } from './influx-v1-config-form.types';

defineOptions({
	name: 'InfluxV1ConfigForm',
});

const props = withDefaults(defineProps<IInfluxV1ConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IInfluxV1ConfigEditForm>({
	config: props.config,
	messages: {
		success: t('influxV1Plugin.messages.config.edited'),
		error: t('influxV1Plugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IInfluxV1ConfigEditForm>>({
	host: [{ required: true, message: t('influxV1Plugin.fields.config.host.validation.required'), trigger: 'change' }],
	database: [{ required: true, message: t('influxV1Plugin.fields.config.database.validation.required'), trigger: 'change' }],
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
