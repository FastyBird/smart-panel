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
			:title="t('influxdbModule.headings.aboutInfluxDb')"
			:description="t('influxdbModule.texts.aboutInfluxDb')"
			:closable="false"
		/>

		<el-form-item
			:label="t('influxdbModule.fields.config.host.title')"
			prop="host"
			class="mt-3"
		>
			<el-input
				v-model="model.host"
				:placeholder="t('influxdbModule.fields.config.host.placeholder')"
				name="host"
			/>
		</el-form-item>

		<el-form-item
			:label="t('influxdbModule.fields.config.database.title')"
			prop="database"
		>
			<el-input
				v-model="model.database"
				:placeholder="t('influxdbModule.fields.config.database.placeholder')"
				name="database"
			/>
		</el-form-item>

		<el-divider>{{ t('influxdbModule.headings.authentication') }}</el-divider>

		<el-form-item
			:label="t('influxdbModule.fields.config.username.title')"
			prop="username"
		>
			<el-input
				v-model="model.username"
				:placeholder="t('influxdbModule.fields.config.username.placeholder')"
				name="username"
			/>
		</el-form-item>

		<el-form-item
			:label="t('influxdbModule.fields.config.password.title')"
			prop="password"
		>
			<el-input
				v-model="model.password"
				:placeholder="t('influxdbModule.fields.config.password.placeholder')"
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

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import type { IInfluxDbConfigEditForm } from '../schemas/config.types';

import type { IInfluxDbConfigFormProps } from './influxdb-config-form.types';

defineOptions({
	name: 'InfluxDbConfigForm',
});

const props = withDefaults(defineProps<IInfluxDbConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
	(e: 'update:remoteFormChanged', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IInfluxDbConfigEditForm>({
	config: props.config,
	messages: {
		success: t('influxdbModule.messages.config.edited'),
		error: t('influxdbModule.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IInfluxDbConfigEditForm>>({
	host: [{ required: true, message: t('influxdbModule.fields.config.host.validation.required'), trigger: 'change' }],
	database: [{ required: true, message: t('influxdbModule.fields.config.database.validation.required'), trigger: 'change' }],
});

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remoteFormResult', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remoteFormSubmit', false);

			submit().catch(() => {
				// The form is not valid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remoteFormReset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remoteFormChanged', val);
	}
);
</script>
