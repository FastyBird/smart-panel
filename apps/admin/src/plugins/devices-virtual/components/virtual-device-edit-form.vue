<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('devicesVirtualPlugin.fields.devices.id.title')"
			prop="id"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesVirtualPlugin.fields.devices.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesVirtualPlugin.fields.devices.identifier.title')"
			prop="identifier"
		>
			<el-input
				v-model="model.identifier"
				:placeholder="t('devicesVirtualPlugin.fields.devices.identifier.placeholder')"
				name="identifier"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesVirtualPlugin.fields.devices.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesVirtualPlugin.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesVirtualPlugin.fields.devices.category.title')"
			prop="category"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesVirtualPlugin.fields.devices.category.placeholder')"
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
			:label="t('devicesVirtualPlugin.fields.devices.description.title')"
			prop="description"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('devicesVirtualPlugin.fields.devices.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesVirtualPlugin.fields.devices.enabled.title')"
			prop="enabled"
			label-position="left"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, useDeviceEditForm } from '../../../modules/devices';
import { VIRTUAL_SELECTABLE_CATEGORIES } from '../devices-virtual.constants';
import type { IVirtualDeviceEditForm } from '../schemas/devices.types';
import type { IVirtualDevice } from '../store/devices.store.types';

import type { IVirtualDeviceEditFormProps } from './virtual-device-edit-form.types';

defineOptions({
	name: 'VirtualDeviceEditForm',
});

const props = withDefaults(defineProps<IVirtualDeviceEditFormProps>(), {
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

const {
	categoriesOptions: allCategoriesOptions,
	model,
	formEl,
	formChanged,
	submit,
	formResult,
} = useDeviceEditForm<IVirtualDeviceEditForm>({
	device: props.device as IVirtualDevice,
});

// The category `<el-select>` below is `disabled` — an existing virtual device's category cannot be
// changed through this form today — but `useDeviceEditForm` still maps every `DevicesModuleDeviceCategory`
// unfiltered. Filtering to the same set the wizard's category step and the add form offer keeps this
// list from silently drifting out of sync with them (see `VIRTUAL_SELECTABLE_CATEGORIES`), and is what
// the disabled select uses to resolve the current category's label.
const categoriesOptions = allCategoriesOptions.filter((item) => VIRTUAL_SELECTABLE_CATEGORIES.includes(item.value));

const rules = reactive<FormRules<IVirtualDeviceEditForm>>({
	name: [{ required: true, message: t('devicesVirtualPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
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
