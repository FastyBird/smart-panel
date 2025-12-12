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
			:title="t('mdnsModule.headings.aboutServiceAdvertisement')"
			:description="t('mdnsModule.texts.aboutServiceAdvertisement')"
			:closable="false"
		/>

		<el-form-item
			:label="t('mdnsModule.fields.config.serviceName.title')"
			prop="serviceName"
			class="mt-3"
		>
			<el-input
				v-model="model.serviceName"
				:placeholder="t('mdnsModule.fields.config.serviceName.placeholder')"
				name="serviceName"
			/>
		</el-form-item>

		<el-form-item
			:label="t('mdnsModule.fields.config.serviceType.title')"
			prop="serviceType"
		>
			<el-input
				v-model="model.serviceType"
				:placeholder="t('mdnsModule.fields.config.serviceType.placeholder')"
				name="serviceType"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import type { IMdnsConfigEditForm } from '../schemas/config.types';

import type { IMdnsConfigFormProps } from './mdns-config-form.types';

defineOptions({
	name: 'MdnsConfigForm',
});

const props = withDefaults(defineProps<IMdnsConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IMdnsConfigEditForm>({
	config: props.config,
	messages: {
		success: t('mdnsModule.messages.config.edited'),
		error: t('mdnsModule.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IMdnsConfigEditForm>>({
	serviceName: [{ required: true, message: t('mdnsModule.fields.config.serviceName.validation.required'), trigger: 'change' }],
	serviceType: [{ required: true, message: t('mdnsModule.fields.config.serviceType.validation.required'), trigger: 'change' }],
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
