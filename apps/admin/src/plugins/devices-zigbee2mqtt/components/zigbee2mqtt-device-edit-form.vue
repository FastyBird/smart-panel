<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.id.title')"
			prop="id"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

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
				readonly
				disabled
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

		<el-divider />

		<el-form-item
			:label="t('devicesZigbee2mqttPlugin.fields.devices.zigbee2mqttDeviceId.title')"
			prop="identifier"
		>
			<el-select
				v-model="model.identifier"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.zigbee2mqttDeviceId.placeholder')"
				:loading="devicesOptionsLoading"
				name="identifier"
				filterable
				disabled
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
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { FormResult, type FormResultType } from '../../../modules/devices';
import { useDeviceEditForm } from '../composables/useDeviceEditForm';
import { useDiscoveredDevices } from '../composables/useDiscoveredDevices';
import type { IZigbee2mqttDeviceEditForm } from '../schemas/devices.types';
import type { IZigbee2mqttDevice } from '../store/devices.store.types';

import type { IZigbee2mqttDeviceEditFormProps } from './zigbee2mqtt-device-edit-form.types';

defineOptions({
	name: 'Zigbee2mqttDeviceEditForm',
});

const props = withDefaults(defineProps<IZigbee2mqttDeviceEditFormProps>(), {
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

const { categoriesOptions, model, formEl, formChanged, submit, formResult } = useDeviceEditForm({
	device: props.device as IZigbee2mqttDevice,
});

const { devices, isLoading: devicesOptionsLoading } = useDiscoveredDevices();

const devicesOptions = computed(() => {
	// Include ALL devices (including adopted ones) for the edit form
	const sortedDevices = orderBy(devices.value, [(d) => d.friendlyName.toLowerCase()], ['asc']);

	return sortedDevices.map((device) => ({
		value: device.id,
		label: device.friendlyName,
		manufacturer: device.manufacturer,
		model: device.model,
		available: device.available,
	}));
});

const rules = reactive<FormRules<IZigbee2mqttDeviceEditForm>>({
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
