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
			:title="t('influxV2Plugin.headings.connection')"
			:description="t('influxV2Plugin.texts.about')"
			:closable="false"
		/>

		<el-form-item
			:label="t('influxV2Plugin.fields.config.url.title')"
			prop="url"
			class="mt-3"
		>
			<el-input
				v-model="model.url"
				:placeholder="t('influxV2Plugin.fields.config.url.placeholder')"
				name="url"
			/>
		</el-form-item>

		<el-form-item
			:label="t('influxV2Plugin.fields.config.org.title')"
			prop="org"
		>
			<el-input
				v-model="model.org"
				:placeholder="t('influxV2Plugin.fields.config.org.placeholder')"
				name="org"
			/>
		</el-form-item>

		<el-form-item
			:label="t('influxV2Plugin.fields.config.bucket.title')"
			prop="bucket"
		>
			<el-input
				v-model="model.bucket"
				:placeholder="t('influxV2Plugin.fields.config.bucket.placeholder')"
				name="bucket"
			/>
		</el-form-item>

		<el-divider content-position="left" class="mt-6!">{{ t('influxV2Plugin.headings.authentication') }}</el-divider>

		<el-form-item
			:label="t('influxV2Plugin.fields.config.token.title')"
			prop="token"
		>
			<el-input
				v-model="model.token"
				:placeholder="t('influxV2Plugin.fields.config.token.placeholder')"
				name="token"
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
import type { IInfluxV2ConfigEditForm } from '../schemas/config.types';

import type { IInfluxV2ConfigFormProps } from './influx-v2-config-form.types';

defineOptions({
	name: 'InfluxV2ConfigForm',
});

const props = withDefaults(defineProps<IInfluxV2ConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IInfluxV2ConfigEditForm>({
	config: props.config,
	messages: {
		success: t('influxV2Plugin.messages.config.edited'),
		error: t('influxV2Plugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IInfluxV2ConfigEditForm>>({
	url: [{ required: true, message: t('influxV2Plugin.fields.config.url.validation.required'), trigger: 'change' }],
	org: [{ required: true, message: t('influxV2Plugin.fields.config.org.validation.required'), trigger: 'change' }],
	bucket: [{ required: true, message: t('influxV2Plugin.fields.config.bucket.validation.required'), trigger: 'change' }],
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
