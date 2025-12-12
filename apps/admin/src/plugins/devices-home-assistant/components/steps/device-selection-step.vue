<template>
	<el-form
		ref="stepOneFormEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.title')"
			prop="haDeviceId"
		>
			<!-- eslint-disable vue/no-mutating-props -->
			<el-select
				v-model="model.haDeviceId"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.placeholder')"
				:loading="devicesOptionsLoading"
				:disabled="devicesOptions.length === 0"
				name="haDeviceId"
				filterable
				@change="onDeviceChange"
			>
				<el-option
					v-for="item in devicesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
			<template v-if="!devicesOptionsLoading && devicesOptions.length === 0">
				<div class="text-sm text-gray-500 mt-2">
					{{ t('devicesHomeAssistantPlugin.messages.devices.noDiscoveredDevices') }}
				</div>
			</template>
		</el-form-item>

		<el-alert
			v-if="selectedDeviceInfo"
			type="info"
			:title="t('devicesHomeAssistantPlugin.headings.device.deviceSelection')"
			:closable="false"
			show-icon
		>
			<dl class="grid grid-cols-[auto_1fr] gap-x-4 my-0">
				<dt>{{ t('devicesHomeAssistantPlugin.fields.devices.name.title') }}:</dt>
				<dd class="m-0 inline-block font-bold">
					{{ selectedDeviceInfo.name }}
				</dd>
			</dl>
		</el-alert>

		<el-alert
			v-if="selectedDeviceInfo && selectedDeviceInfo.adoptedDeviceId"
			type="warning"
			:title="t('devicesHomeAssistantPlugin.messages.devices.exists')"
			:closable="false"
			show-icon
			class="mt-4"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, type FormInstance, type FormRules } from 'element-plus';

import { useDiscoveredDevices } from '../../composables/useDiscoveredDevices';
import type { IHomeAssistantDeviceAddForm } from '../../schemas/devices.types';

interface IDeviceSelectionStepProps {
	model: IHomeAssistantDeviceAddForm;
	stepOneFormEl: FormInstance | undefined;
	devicesOptions: { value: string; label: string }[];
	devicesOptionsLoading: boolean;
}

const props = defineProps<IDeviceSelectionStepProps>();

const emit = defineEmits<{
	(e: 'device-change', deviceId: string): void;
}>();

const { t } = useI18n();

const { devices } = useDiscoveredDevices();

const selectedDeviceInfo = computed(() => {
	if (!props.model.haDeviceId) {
		return null;
	}

	return devices.value.find((d) => d.id === props.model.haDeviceId) || null;
});

const rules = reactive<FormRules<IHomeAssistantDeviceAddForm>>({
	haDeviceId: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.validation.required'), trigger: 'change' }],
});

const onDeviceChange = (deviceId: string): void => {
	emit('device-change', deviceId);
};
</script>
