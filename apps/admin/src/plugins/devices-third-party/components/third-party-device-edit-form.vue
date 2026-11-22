<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<device-form-frame
			:model="model"
			:categories-options="categoriesOptions"
			mode="edit"
			identifier="editable"
		>
			<plugin-form-section :title="t('devicesThirdPartyPlugin.sections.connection')">
				<el-form-item
					:label="t('devicesThirdPartyPlugin.fields.devices.serviceAddress.title')"
					prop="serviceAddress"
				>
					<el-input
						v-model="model.serviceAddress"
						:placeholder="t('devicesThirdPartyPlugin.fields.devices.serviceAddress.placeholder')"
						name="serviceAddress"
					/>
				</el-form-item>
			</plugin-form-section>
		</device-form-frame>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { PluginFormSection } from '../../../common';
import { DeviceFormFrame, FormResult, type FormResultType, useDeviceEditForm } from '../../../modules/devices';
import type { IThirdPartyDeviceEditForm } from '../schemas/devices.types';
import type { IThirdPartyDevice } from '../store/devices.store.types';

import type { IThirdPartyDeviceEditFormProps } from './third-party-device-edit-form.types';

defineOptions({
	name: 'ThirdPartyDeviceEditForm',
});

const props = withDefaults(defineProps<IThirdPartyDeviceEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { categoriesOptions, model, formEl, formChanged, submit, formResult } = useDeviceEditForm<IThirdPartyDeviceEditForm>({
	device: props.device as IThirdPartyDevice,
});

const rules = reactive<FormRules<IThirdPartyDeviceEditForm>>({
	name: [{ required: true, message: t('devicesThirdPartyPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	serviceAddress: [
		{ required: true, message: t('devicesThirdPartyPlugin.fields.devices.serviceAddress.validation.required'), trigger: 'change' },
		{ type: 'url', message: t('devicesThirdPartyPlugin.fields.devices.serviceAddress.validation.url'), trigger: 'change' },
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
