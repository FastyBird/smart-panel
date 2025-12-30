<template>
	<el-form
		ref="stepOneFormEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item prop="haDeviceId">
			<!-- eslint-disable vue/no-mutating-props -->
			<el-select
				v-model="model.haDeviceId"
				:placeholder="t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.placeholder')"
				:loading="itemsOptionsLoading"
				:disabled="totalOptionsCount === 0"
				name="haDeviceId"
				filterable
				@change="onDeviceChange"
			>
				<el-option-group
					v-for="group in itemsOptions"
					:key="group.label"
					:label="group.label"
				>
					<el-option
						v-for="item in group.options"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					>
						<span class="flex items-center gap-2">
							<el-tag
								:type="item.type === 'device' ? 'primary' : 'success'"
								size="small"
							>
								{{ item.type === 'device' ? 'Device' : 'Helper' }}
							</el-tag>
							{{ item.label }}
						</span>
					</el-option>
				</el-option-group>
			</el-select>
			<template v-if="!itemsOptionsLoading && totalOptionsCount === 0">
				<div class="text-sm text-gray-500 mt-2">
					{{ t('devicesHomeAssistantPlugin.messages.devices.noDiscoveredDevices') }}
				</div>
			</template>
		</el-form-item>

		<div class="flex flex-col gap-2">
			<el-alert
				v-if="selectedItemInfo"
				type="info"
				:title="t('devicesHomeAssistantPlugin.headings.device.deviceInformation')"
				:closable="false"
				show-icon
			>
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 my-0">
					<dt>{{ t('devicesHomeAssistantPlugin.fields.devices.name.title') }}:</dt>
					<dd class="m-0 inline-block font-bold">
						{{ selectedItemInfo.name }}
					</dd>
					<dt v-if="selectedItemInfo.type === 'device'">
						{{ t('devicesHomeAssistantPlugin.fields.devices.entities.title') }}:
					</dt>
					<dd
						v-if="selectedItemInfo.type === 'device'"
						class="m-0"
					>
						{{ selectedItemInfo.entitiesCount }}
					</dd>
					<dt v-if="selectedItemInfo.type === 'helper'">
						{{ t('devicesHomeAssistantPlugin.fields.devices.domain.title') }}:
					</dt>
					<dd
						v-if="selectedItemInfo.type === 'helper'"
						class="m-0"
					>
						{{ selectedItemInfo.domain }}
					</dd>
					<dt>{{ t('devicesHomeAssistantPlugin.fields.devices.type.title') }}:</dt>
					<dd class="m-0">
						<el-tag
							:type="selectedItemInfo.type === 'device' ? 'primary' : 'success'"
							size="small"
						>
							{{ selectedItemInfo.type === 'device' ? 'Device' : 'Helper' }}
						</el-tag>
					</dd>
				</dl>
			</el-alert>

			<el-alert
				v-if="selectedItemInfo && selectedItemInfo.adoptedDeviceId"
				type="warning"
				:title="t('devicesHomeAssistantPlugin.messages.devices.alreadyAdopted')"
				:description="t('devicesHomeAssistantPlugin.messages.devices.alreadyAdoptedDescription')"
				:closable="false"
				show-icon
			/>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElOptionGroup, ElSelect, ElTag, type FormInstance, type FormRules } from 'element-plus';

import { useDiscoveredDevices } from '../../composables/useDiscoveredDevices';
import { useDiscoveredHelpers } from '../../composables/useDiscoveredHelpers';
import type { IDiscoveryOptionGroup } from '../../composables/types';
import type { IHomeAssistantDeviceAddForm } from '../../schemas/devices.types';

interface IDeviceSelectionStepProps {
	model: IHomeAssistantDeviceAddForm;
	itemsOptions: IDiscoveryOptionGroup[];
	itemsOptionsLoading: boolean;
}

const props = defineProps<IDeviceSelectionStepProps>();

const emit = defineEmits<{
	(e: 'device-change', deviceId: string): void;
}>();

const { t } = useI18n();

const { devices } = useDiscoveredDevices();
const { helpers } = useDiscoveredHelpers();

const totalOptionsCount = computed(() => {
	return props.itemsOptions.reduce((acc, group) => acc + group.options.length, 0);
});

const selectedItemInfo = computed(() => {
	if (!props.model.haDeviceId) {
		return null;
	}

	// Check if it's a device
	const device = devices.value.find((d) => d.id === props.model.haDeviceId);
	if (device) {
		return {
			type: 'device' as const,
			name: device.name,
			entitiesCount: device.entities.length,
			adoptedDeviceId: device.adoptedDeviceId,
		};
	}

	// Check if it's a helper
	const helper = helpers.value.find((h) => h.entityId === props.model.haDeviceId);
	if (helper) {
		return {
			type: 'helper' as const,
			name: helper.name,
			domain: helper.domain,
			adoptedDeviceId: helper.adoptedDeviceId,
		};
	}

	return null;
});

const rules = reactive<FormRules<IHomeAssistantDeviceAddForm>>({
	haDeviceId: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.devices.haDeviceId.validation.required'), trigger: 'change' }],
});

const onDeviceChange = (deviceId: string): void => {
	emit('device-change', deviceId);
};

const stepOneFormEl = ref<FormInstance | undefined>(undefined);

defineExpose({
	stepOneFormEl,
});
</script>
