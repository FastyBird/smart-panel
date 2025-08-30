<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('dashboardModule.fields.pages.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.pages.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.title.title')"
			:prop="['title']"
		>
			<el-input
				v-model="model.title"
				:placeholder="t('dashboardModule.fields.pages.title.placeholder')"
				name="title"
			/>
		</el-form-item>

		<el-form-item
			:label="t('pagesDeviceDetailPlugin.fields.device.title')"
			:prop="['device']"
		>
			<el-select
				v-model="model.device"
				:placeholder="t('pagesDeviceDetailPlugin.fields.device.placeholder')"
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
			:label="t('dashboardModule.fields.pages.icon.title')"
			:prop="['icon']"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('dashboardModule.fields.pages.icon.placeholder')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.order.title')"
			:prop="['order']"
		>
			<el-input-number
				v-model="model.order"
				:placeholder="t('dashboardModule.fields.pages.order.placeholder')"
				name="order"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.showTopBar.title')"
			:prop="['showTopBar']"
		>
			<el-switch
				v-model="model.showTopBar"
				name="showTopBar"
			/>
		</el-form-item>

		<display-profile-select
			v-model="model.display"
			:required="false"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { IconPicker } from '../../../common';
import { DashboardException, FormResult, type FormResultType, type IPageAddFormProps, usePageAddForm } from '../../../modules/dashboard';
import { type IDevice, useDevices } from '../../../modules/devices';
import { DisplayProfileSelect } from '../../../modules/system';
import { PAGES_DEVICE_DETAIL_TYPE } from '../pages-device-detail.constants';
import type { IDeviceDetailPageAddForm } from '../schemas/pages.types';

defineOptions({
	name: 'DeviceDetailPageAddForm',
});

const props = withDefaults(defineProps<IPageAddFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = usePageAddForm<IDeviceDetailPageAddForm>({
	id: props.id,
	type: PAGES_DEVICE_DETAIL_TYPE,
});

const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();

const rules = reactive<FormRules<IDeviceDetailPageAddForm>>({
	title: [{ required: true, message: t('dashboardModule.fields.pages.title.validation.required'), trigger: 'change' }],
	device: [{ required: true, message: t('pagesDeviceDetailPlugin.fields.device.validation.required'), trigger: 'change' }],
});

const devicesOptions = computed<{ value: IDevice['id']; label: string }[]>((): { value: IDevice['id']; label: string }[] => {
	return orderBy<IDevice>(devices.value, [(device: IDevice) => device.name], ['asc']).map((device) => ({ value: device.id, label: device.name }));
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
</script>
