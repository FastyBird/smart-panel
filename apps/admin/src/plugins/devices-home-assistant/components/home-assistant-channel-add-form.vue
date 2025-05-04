<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<div
			v-loading="loadingDevices"
			:element-loading-text="t('devicesModule.texts.devices.loadingDevices')"
		>
			<el-form-item
				:label="t('devicesHomeAssistantPlugin.fields.channels.device.title')"
				:prop="['device']"
			>
				<el-select
					v-model="model.device"
					:placeholder="t('devicesHomeAssistantPlugin.fields.channels.device.placeholder')"
					name="device"
					filterable
					:readonly="typeof props.device !== 'undefined'"
					:disabled="typeof props.device !== 'undefined'"
				>
					<el-option
						v-for="item in devicesOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>
			</el-form-item>

			<el-alert
				v-if="selectedDevice"
				type="info"
				:title="t('devicesModule.fields.channels.device.description')"
				:description="t(`devicesModule.texts.devices.description.${selectedDevice.category}`)"
				:closable="false"
				show-icon
			/>
		</div>

		<el-divider />

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channels.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channels.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channels.name.title')"
			:prop="['name']"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channels.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channels.category.title')"
			:prop="['category']"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channels.category.placeholder')"
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
			:title="t('devicesModule.fields.channels.category.description')"
			:description="t(`devicesModule.texts.channels.description.${model.category}`)"
			:closable="false"
			show-icon
		/>

		<el-divider />

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channels.description.title')"
			:prop="['description']"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channels.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<template v-if="haDeviceId">
			<el-divider />

			<el-form-item
				:label="t('devicesHomeAssistantPlugin.fields.channels.haEntityId.title')"
				:prop="['haEntityId']"
			>
				<select-discovered-device-entity
					:device-id="haDeviceId"
					v-model="model.haEntityId"
				/>
			</el-form-item>
		</template>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, type FormRules, vLoading } from 'element-plus';

import { FormResult, type FormResultType, type IDevice, useChannelAddForm, useDevices } from '../../../modules/devices';
import { useDiscoveredDevicesOptions } from '../composables/useDiscoveredDevicesOptions';
import { useEntitiesOptions } from '../composables/useEntitiesOptions';
import type { IHomeAssistantChannelAddForm } from '../schemas/channels.types';
import type { IHomeAssistantDevice } from '../store/devices.store.types';

import type { IHomeAssistantChannelAddFormProps } from './home-assistant-channel-add-form.types';
import SelectDiscoveredDeviceEntity from './select-discovered-device-entity.vue';

defineOptions({
	name: 'HomeAssistantChannelAddForm',
});

const props = withDefaults(defineProps<IHomeAssistantChannelAddFormProps>(), {
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

const { devices } = useDevices();
const { categoriesOptions, devicesOptions, model, formEl, formChanged, submit, formResult, loadingDevices } =
	useChannelAddForm<IHomeAssistantChannelAddForm>({
		id: props.id,
		type: props.type,
		deviceId: props.device?.id,
	});

const haDeviceId = computed<IHomeAssistantDevice['haDeviceId'] | undefined>((): IHomeAssistantDevice['haDeviceId'] | undefined => {
	const device = devices.value.find((device) => device.id === model.device);

	return device && 'haDeviceId' in device && typeof device.haDeviceId === 'string' ? device.haDeviceId : undefined;
});

const rules = reactive<FormRules<IHomeAssistantChannelAddForm>>({
	device: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.channels.device.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.channels.category.validation.required'), trigger: 'change' }],
	name: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.channels.name.validation.required'), trigger: 'change' }],
	haEntityId: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.channels.haEntityId.validation.required'), trigger: 'change' }],
});

const selectedDevice = computed<IDevice | undefined>((): IDevice | undefined => {
	return devices.value.find((device) => device.id === model.device);
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
