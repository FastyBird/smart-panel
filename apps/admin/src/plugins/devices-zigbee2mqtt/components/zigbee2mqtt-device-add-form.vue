<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.category.title')"
			prop="category"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.category.placeholder')"
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
			:label="t('devicesZigbee2mqttPlugin.fields.devices.ieeeAddress.title')"
			prop="ieeeAddress"
		>
			<el-input
				v-model="model.ieeeAddress"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.ieeeAddress.placeholder')"
				name="ieeeAddress"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.friendlyName.title')"
			prop="friendlyName"
		>
			<el-input
				v-model="model.friendlyName"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.friendlyName.placeholder')"
				name="friendlyName"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.modelId.title')"
			prop="modelId"
		>
			<el-input
				v-model="model.modelId"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.modelId.placeholder')"
				name="modelId"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.description.title')"
			prop="description"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.enabled.title')"
			prop="enabled"
			label-position="left"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType } from '../../../modules/devices';
import { useDeviceAddForm } from '../composables/useDeviceAddForm';
import type { IZigbee2mqttDeviceAddForm } from '../schemas/devices.types';

import type { IZigbee2mqttDeviceAddFormProps } from './zigbee2mqtt-device-add-form.types';

defineOptions({
	name: 'Zigbee2mqttDeviceAddForm',
});

const props = withDefaults(defineProps<IZigbee2mqttDeviceAddFormProps>(), {
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

const { categoriesOptions, model, formEl, formChanged, submit, formResult } = useDeviceAddForm({
	id: props.id,
});

const rules = reactive<FormRules<IZigbee2mqttDeviceAddForm>>({
	name: [{ required: true, message: t('devicesZigbee2mqttPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesZigbee2mqttPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
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
