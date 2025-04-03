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
				:label="t('devicesModule.fields.channels.device.title')"
				:prop="['device']"
			>
				<el-select
					v-model="model.device"
					:placeholder="t('devicesModule.fields.channels.device.placeholder')"
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
			:label="t('devicesModule.fields.channels.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesModule.fields.channels.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channels.name.title')"
			:prop="['name']"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesModule.fields.channels.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channels.category.title')"
			:prop="['category']"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesModule.fields.channels.category.placeholder')"
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
			:label="t('devicesModule.fields.channels.description.title')"
			:prop="['description']"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('devicesModule.fields.channels.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, type FormRules, vLoading } from 'element-plus';

import { type IChannelAddForm, useChannelAddForm, useDevices } from '../../composables';
import { FormResult, type FormResultType } from '../../devices.constants';
import type { IDevice } from '../../store';

import type { IChannelAddFormProps } from './channel-add-form.types';

defineOptions({
	name: 'ChannelAddForm',
});

const props = withDefaults(defineProps<IChannelAddFormProps>(), {
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
const { categoriesOptions, devicesOptions, model, formEl, formChanged, submit, formResult, loadingDevices } = useChannelAddForm(
	props.id,
	props.device?.id
);

const rules = reactive<FormRules<IChannelAddForm>>({
	device: [{ required: true, message: t('devicesModule.fields.channels.device.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesModule.fields.channels.category.validation.required'), trigger: 'change' }],
	name: [{ required: true, message: t('devicesModule.fields.channels.name.validation.required'), trigger: 'change' }],
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
				// Form is not valid
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
