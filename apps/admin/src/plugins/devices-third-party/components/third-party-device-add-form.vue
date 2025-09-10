<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesThirdPartyPlugin.fields.devices.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesThirdPartyPlugin.fields.devices.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesThirdPartyPlugin.fields.devices.identifier.title')"
			:prop="['identifier']"
		>
			<el-input
				v-model="model.identifier"
				:placeholder="t('devicesThirdPartyPlugin.fields.devices.identifier.placeholder')"
				name="identifier"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesThirdPartyPlugin.fields.devices.name.title')"
			:prop="['name']"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesThirdPartyPlugin.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesThirdPartyPlugin.fields.devices.category.title')"
			:prop="['category']"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesThirdPartyPlugin.fields.devices.category.placeholder')"
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
			:label="t('devicesThirdPartyPlugin.fields.devices.description.title')"
			:prop="['description']"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('devicesThirdPartyPlugin.fields.devices.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesThirdPartyPlugin.fields.devices.enabled.title')"
			:prop="['enabled']"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('devicesThirdPartyPlugin.fields.devices.serviceAddress.title')"
			:prop="['serviceAddress']"
		>
			<el-input
				v-model="model.serviceAddress"
				:placeholder="t('devicesThirdPartyPlugin.fields.devices.serviceAddress.placeholder')"
				name="serviceAddress"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, useDeviceAddForm } from '../../../modules/devices';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';
import type { IThirdPartyDeviceAddForm } from '../schemas/devices.types';

import type { IThirdPartyDeviceAddFormProps } from './third-party-device-add-form.types';

defineOptions({
	name: 'ThirdPartyDeviceAddForm',
});

const props = withDefaults(defineProps<IThirdPartyDeviceAddFormProps>(), {
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

const { categoriesOptions, model, formEl, formChanged, submit, formResult } = useDeviceAddForm<IThirdPartyDeviceAddForm>({
	id: props.id,
	type: DEVICES_THIRD_PARTY_TYPE,
});

const rules = reactive<FormRules<IThirdPartyDeviceAddForm>>({
	category: [{ required: true, message: t('devicesThirdPartyPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
	name: [{ required: true, message: t('devicesThirdPartyPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	serviceAddress: [
		{ required: true, message: t('devicesThirdPartyPlugin.fields.devices.serviceAddress.validation.required'), trigger: 'change' },
		{ type: 'url', message: t('devicesThirdPartyPlugin.fields.devices.serviceAddress.validation.url'), trigger: 'change' },
	],
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
