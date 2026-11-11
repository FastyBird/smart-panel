<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('dashboardModule.fields.dataSources.id.title')"
			prop="id"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.dataSources.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<device-property-picker
			v-model:device-id="model.device"
			:channel-id="model.channel"
			:property-id="model.property"
			device-prop="device"
			channel-prop="channel"
			property-prop="property"
			:texts="pickerTexts"
			@update:channel-id="onChannelUpdate"
			@update:property-id="onPropertyUpdate"
		/>

		<el-form-item
			:label="t('dataSourcesDeviceChannelPlugin.fields.icon.title')"
			prop="icon"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('dataSourcesDeviceChannelPlugin.fields.icon.placeholder')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { IconPicker } from '../../../common';
import { FormResult, type FormResultType, type IDataSourceEditFormProps, useDataSourceEditForm } from '../../../modules/dashboard';
import { DevicePropertyPicker, type IDevicePropertyPickerTexts } from '../../../modules/devices';
import type { IDeviceChannelDataSourceEditForm } from '../schemas/data-sources.types';

defineOptions({
	name: 'DeviceChannelDataSourceEditForm',
});

const props = withDefaults(defineProps<IDataSourceEditFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = useDataSourceEditForm<IDeviceChannelDataSourceEditForm>({ dataSource: props.dataSource });

const rules = reactive<FormRules<IDeviceChannelDataSourceEditForm>>({
	device: [{ required: true, message: t('dataSourcesDeviceChannelPlugin.fields.device.validation.required'), trigger: 'change' }],
	channel: [{ required: true, message: t('dataSourcesDeviceChannelPlugin.fields.channel.validation.required'), trigger: 'change' }],
	property: [{ required: true, message: t('dataSourcesDeviceChannelPlugin.fields.property.validation.required'), trigger: 'change' }],
});

// This form shows the same placeholder whether or not there is something to pick from
const pickerTexts = computed<Partial<IDevicePropertyPickerTexts>>(() => ({
	deviceTitle: t('dataSourcesDeviceChannelPlugin.fields.device.title'),
	devicePlaceholder: t('dataSourcesDeviceChannelPlugin.fields.device.placeholder'),
	channelTitle: t('dataSourcesDeviceChannelPlugin.fields.channel.title'),
	channelPlaceholder: t('dataSourcesDeviceChannelPlugin.fields.channel.placeholder'),
	channelEmpty: t('dataSourcesDeviceChannelPlugin.fields.channel.placeholder'),
	propertyTitle: t('dataSourcesDeviceChannelPlugin.fields.property.title'),
	propertyPlaceholder: t('dataSourcesDeviceChannelPlugin.fields.property.placeholder'),
	propertyEmpty: t('dataSourcesDeviceChannelPlugin.fields.property.placeholder'),
}));

// The form model keeps an empty string for a channel and a property not picked yet
const onChannelUpdate = (channelId: string | null): void => {
	model.channel = channelId ?? '';
};

const onPropertyUpdate = (propertyId: string | null): void => {
	model.property = propertyId ?? '';
};

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
