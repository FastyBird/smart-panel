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
			:title="t('devicesShellyV1Plugin.headings.aboutPluginStatus')"
			:description="t('devicesShellyV1Plugin.texts.aboutPluginStatus')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesShellyV1Plugin.fields.config.enabled.title')"
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
			:title="t('devicesShellyV1Plugin.headings.aboutDiscovery')"
			:description="t('devicesShellyV1Plugin.texts.aboutDiscovery')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesShellyV1Plugin.fields.config.discovery.enabled.title')"
			prop="discovery.enabled"
			class="mt-3"
			label-position="left"
		>
			<el-switch
				v-model="model.discovery.enabled"
				name="discoveryEnabled"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesShellyV1Plugin.fields.config.discovery.interface.title')"
			prop="discovery.interface"
		>
			<el-input
				v-model="model.discovery.interface"
				:placeholder="t('devicesShellyV1Plugin.fields.config.discovery.interface.placeholder')"
				name="discoveryInterface"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesShellyV1Plugin.headings.aboutTimeouts')"
			:description="t('devicesShellyV1Plugin.texts.aboutTimeouts')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesShellyV1Plugin.fields.config.timeouts.requestTimeout.title')"
			prop="timeouts.requestTimeout"
			class="mt-3"
		>
			<el-input
				v-model="model.timeouts.requestTimeout"
				:placeholder="t('devicesShellyV1Plugin.fields.config.timeouts.requestTimeout.placeholder')"
				name="timeouts.requestTimeout"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesShellyV1Plugin.fields.config.timeouts.staleTimeout.title')"
			prop="timeouts.staleTimeout"
		>
			<el-input
				v-model="model.timeouts.staleTimeout"
				:placeholder="t('devicesShellyV1Plugin.fields.config.timeouts.staleTimeout.placeholder')"
				name="timeouts.staleTimeout"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IShellyV1ConfigEditForm } from '../schemas/config.types';

import type { IShellyV1ConfigFormProps } from './shelly-v1-config-form.types';

defineOptions({
	name: 'ShellyV1ConfigForm',
});

const props = withDefaults(defineProps<IShellyV1ConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IShellyV1ConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesShellyV1Plugin.messages.config.edited'),
		error: t('devicesShellyV1Plugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IShellyV1ConfigEditForm>>({
	'timeouts.requestTimeout': [
		{ required: true, message: t('devicesShellyV1Plugin.fields.config.timeouts.requestTimeout.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesShellyV1Plugin.fields.config.timeouts.requestTimeout.validation.number'),
			validator: (rule, value) => value >= 1,
			trigger: 'change',
		},
	],
	'timeouts.staleTimeout': [
		{ required: true, message: t('devicesShellyV1Plugin.fields.config.timeouts.staleTimeout.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesShellyV1Plugin.fields.config.timeouts.staleTimeout.validation.number'),
			validator: (rule, value) => value >= 1,
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
