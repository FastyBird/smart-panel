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
		>
			<plugin-form-section :title="t('devicesZigbee2mqttPlugin.sections.connection')">
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
			</plugin-form-section>
		</device-form-frame>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { PluginFormSection } from '../../../common';
import { DeviceFormFrame, FormResult, type FormResultType } from '../../../modules/devices';
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
