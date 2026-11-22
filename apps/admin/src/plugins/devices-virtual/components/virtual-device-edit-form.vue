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
			identifier="editable"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, type FormRules } from 'element-plus';

import { DeviceFormFrame, FormResult, type FormResultType, useDeviceEditForm } from '../../../modules/devices';
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
