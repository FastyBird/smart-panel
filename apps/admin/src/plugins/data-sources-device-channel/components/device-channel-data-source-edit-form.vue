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
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.dataSources.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('dataSourcesDeviceChannelPlugin.fields.device.title')"
			:prop="['device']"
		>
			<el-select
				v-model="model.device"
				:placeholder="t('dataSourcesDeviceChannelPlugin.fields.device.placeholder')"
				name="device"
				:loading="loadingDevices"
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

		<el-form-item
			:label="t('dataSourcesDeviceChannelPlugin.fields.channel.title')"
			:prop="['channel']"
		>
			<el-select
				v-model="model.channel"
				:placeholder="t('dataSourcesDeviceChannelPlugin.fields.channel.placeholder')"
				name="channel"
				:loading="loadingChannels"
				filterable
			>
				<el-option
					v-for="item in channelsOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('dataSourcesDeviceChannelPlugin.fields.property.title')"
			:prop="['property']"
		>
			<el-select
				v-model="model.property"
				:placeholder="t('dataSourcesDeviceChannelPlugin.fields.property.placeholder')"
				name="property"
				:loading="loadingProperties"
				filterable
			>
				<el-option
					v-for="item in propertiesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('dataSourcesDeviceChannelPlugin.fields.icon.title')"
			:prop="['icon']"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('dataSourcesDeviceChannelPlugin.fields.icon.placeholder')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElOption, ElSelect, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { IconPicker } from '../../../common';
import {
	DashboardException,
	FormResult,
	type FormResultType,
	type IDataSourceEditFormProps,
	useDataSourceEditForm,
} from '../../../modules/dashboard';
import { type IChannel, type IChannelProperty, type IDevice, useChannels, useChannelsProperties, useDevices } from '../../../modules/devices';
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

const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();
const { channels, fetchChannels, areLoading: loadingChannels } = useChannels({ deviceId: model.device });
const { properties, fetchProperties, areLoading: loadingProperties } = useChannelsProperties({ channelId: model.channel });

const rules = reactive<FormRules<IDeviceChannelDataSourceEditForm>>({
	device: [{ required: true, message: t('dataSourcesDeviceChannelPlugin.fields.device.validation.required'), trigger: 'change' }],
	channel: [{ required: true, message: t('dataSourcesDeviceChannelPlugin.fields.channel.validation.required'), trigger: 'change' }],
	property: [{ required: true, message: t('dataSourcesDeviceChannelPlugin.fields.property.validation.required'), trigger: 'change' }],
});

const devicesOptions = computed<{ value: IDevice['id']; label: string }[]>((): { value: IDevice['id']; label: string }[] => {
	return orderBy<IDevice>(devices.value, [(device: IDevice) => device.name], ['asc']).map((device) => ({ value: device.id, label: device.name }));
});

const channelsOptions = computed<{ value: IChannel['id']; label: string }[]>((): { value: IChannel['id']; label: string }[] => {
	return orderBy<IChannel>(
		channels.value.filter((channel: IChannel) => channel.device === model.device),
		[(channel: IChannel) => channel.name],
		['asc']
	).map((channel) => ({
		value: channel.id,
		label: channel.name,
	}));
});

const propertiesOptions = computed<{ value: IChannelProperty['id']; label: string }[]>((): { value: IChannelProperty['id']; label: string }[] => {
	return orderBy<IChannelProperty>(
		properties.value.filter((property: IChannelProperty) => property.channel === model.channel),
		[(property: IChannelProperty) => property.name],
		['asc']
	).map((property) => ({
		value: property.id,
		label: property.name || property.category,
	}));
});

onBeforeMount((): void => {
	if (!loadingDevices.value) {
		fetchDevices().catch((error: unknown): void => {
			const err = error as Error;

			throw new DashboardException('Something went wrong', err);
		});
	}
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

watch(
	(): IDevice['id'] => model.device,
	(): void => {
		if (!model.device) {
			return;
		}

		if (!loadingChannels.value) {
			fetchChannels().catch((error: unknown): void => {
				const err = error as Error;

				throw new DashboardException('Something went wrong', err);
			});
		}
	},
	{
		immediate: true,
	}
);

watch(
	(): IChannel['id'] => model.channel,
	(): void => {
		if (!model.channel) {
			return;
		}

		if (!loadingProperties.value) {
			fetchProperties().catch((error: unknown): void => {
				const err = error as Error;

				throw new DashboardException('Something went wrong', err);
			});
		}
	},
	{
		immediate: true,
	}
);
</script>
