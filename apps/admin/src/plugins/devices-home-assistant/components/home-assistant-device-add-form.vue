<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.name.title')"
			:prop="['name']"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.category.title')"
			:prop="['category']"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.category.placeholder')"
				name="category"
				filterable
			>
				<el-option
					v-for="item in categoriesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-alert
			v-if="model.category"
			type="info"
			:title="t('devicesModule.fields.devices.category.description')"
			:description="t(`devicesModule.texts.devices.description.${model.category}`)"
			:closable="false"
			show-icon
		/>

		<el-divider />

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.description.title')"
			:prop="['description']"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.title')"
			:prop="['haDeviceId']"
		>
			<el-select
				v-model="model.haDeviceId"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.placeholder')"
				:loading="devicesOptionsLoading"
				name="haDeviceId"
				filterable
			>
				<el-option
					v-for="item in devicesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, useDeviceAddForm } from '../../../modules/devices';
import { useDiscoveredDevicesOptions } from '../composables/useDiscoveredDevicesOptions';
import { DEVICES_HOME_ASSISTANT_PLUGIN_TYPE } from '../devices-home-assistant.constants';
import type { IHomeAssistantDeviceAddForm } from '../schemas/devices.types';

import type { IHomeAssistantDeviceAddFormProps } from './home-assistant-device-add-form.types';

defineOptions({
	name: 'HomeAssistantDeviceAddForm',
});

const props = withDefaults(defineProps<IHomeAssistantDeviceAddFormProps>(), {
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

const { categoriesOptions, model, formEl, formChanged, submit, formResult } = useDeviceAddForm<IHomeAssistantDeviceAddForm>({
	id: props.id,
	type: DEVICES_HOME_ASSISTANT_PLUGIN_TYPE,
});

const { devicesOptions, areLoading: devicesOptionsLoading } = useDiscoveredDevicesOptions();

const rules = reactive<FormRules<IHomeAssistantDeviceAddForm>>({
	category: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
	name: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	haDeviceId: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.validation.required'), trigger: 'change' }],
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
