<template>
	<el-form
		ref="stepOneFormEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item prop="ieeeAddress">
			<!-- eslint-disable vue/no-mutating-props -->
			<el-select
				v-model="model.ieeeAddress"
				:placeholder="t('devicesZigbee2mqttPlugin.fields.devices.ieeeAddress.placeholder')"
				:loading="devicesOptionsLoading"
				:disabled="devicesOptions.length === 0"
				name="ieeeAddress"
				filterable
				@change="onDeviceChange"
			>
				<el-option
					v-for="item in devicesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				>
					<div class="flex flex-row justify-between items-center w-full overflow-hidden">
						<div class="grow-1">{{ item.label }}</div>
						<div v-if="item.manufacturer || item.model" class="text-sm">
							{{ [item.manufacturer].filter(Boolean).join(' - ') }}
						</div>
					</div>
				</el-option>
			</el-select>
			<template v-if="!devicesOptionsLoading && devicesOptions.length === 0">
				<div class="text-sm text-gray-500 mt-2">
					{{ t('devicesZigbee2mqttPlugin.messages.devices.noDiscoveredDevices') }}
				</div>
			</template>
		</el-form-item>

		<div class="flex flex-col gap-2">
			<el-alert
				v-if="selectedDeviceInfo"
				type="info"
				:title="t('devicesZigbee2mqttPlugin.headings.device.deviceInfo')"
				:closable="false"
				show-icon
			>
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 my-0">
					<dt>{{ t('devicesZigbee2mqttPlugin.fields.devices.friendlyName.title') }}:</dt>
					<dd class="m-0 inline-block font-bold">
						{{ selectedDeviceInfo.friendlyName }}
					</dd>
					<template v-if="selectedDeviceInfo.manufacturer">
						<dt>{{ t('devicesZigbee2mqttPlugin.fields.devices.manufacturer.title') }}:</dt>
						<dd class="m-0">{{ selectedDeviceInfo.manufacturer }}</dd>
					</template>
					<template v-if="selectedDeviceInfo.model">
						<dt>{{ t('devicesZigbee2mqttPlugin.fields.devices.model.title') }}:</dt>
						<dd class="m-0">{{ selectedDeviceInfo.model }}</dd>
					</template>
				</dl>
			</el-alert>

			<el-alert
				v-if="selectedDeviceInfo && !selectedDeviceInfo.available"
				type="warning"
				:title="t('devicesZigbee2mqttPlugin.messages.devices.deviceOffline')"
				:closable="false"
				show-icon
			/>

			<el-alert
				v-if="selectedDeviceInfo && selectedDeviceInfo.adoptedDeviceId"
				type="warning"
				:title="t('devicesZigbee2mqttPlugin.messages.devices.alreadyAdopted')"
				:description="t('devicesZigbee2mqttPlugin.messages.devices.alreadyAdoptedDescription')"
				:closable="false"
				show-icon
			/>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, type FormInstance, type FormRules } from 'element-plus';

import { useDiscoveredDevices } from '../../composables/useDiscoveredDevices';
import type { IDiscoveredDeviceOption } from '../../composables/useDiscoveredDevicesOptions';
import type { IZigbee2mqttDeviceAddMultiStepForm } from '../../schemas/devices.types';

interface IDeviceSelectionStepProps {
	model: IZigbee2mqttDeviceAddMultiStepForm;
	devicesOptions: IDiscoveredDeviceOption[];
	devicesOptionsLoading: boolean;
}

const props = defineProps<IDeviceSelectionStepProps>();

const emit = defineEmits<{
	(e: 'device-change', deviceId: string): void;
}>();

const { t } = useI18n();

const { devices } = useDiscoveredDevices();

const selectedDeviceInfo = computed(() => {
	if (!props.model.ieeeAddress) {
		return null;
	}

	return devices.value.find((d) => d.id === props.model.ieeeAddress) || null;
});

const rules = reactive<FormRules<IZigbee2mqttDeviceAddMultiStepForm>>({
	ieeeAddress: [
		{ required: true, message: t('devicesZigbee2mqttPlugin.fields.devices.ieeeAddress.validation.required'), trigger: 'change' },
	],
});

const onDeviceChange = (deviceId: string): void => {
	emit('device-change', deviceId);
};

const stepOneFormEl = ref<FormInstance | undefined>(undefined);

defineExpose({
	stepOneFormEl,
});
</script>
