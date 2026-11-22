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
			mode="add"
			identifier="editable"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, type FormRules } from 'element-plus';

import { DeviceFormFrame, FormResult, type FormResultType, useDeviceAddForm } from '../../../modules/devices';
import { DEVICES_VIRTUAL_TYPE, VIRTUAL_SELECTABLE_CATEGORIES } from '../devices-virtual.constants';
import type { IVirtualDeviceAddForm } from '../schemas/devices.types';

import type { IVirtualDeviceAddFormProps } from './virtual-device-add-form.types';

defineOptions({
	name: 'VirtualDeviceAddForm',
});

const props = withDefaults(defineProps<IVirtualDeviceAddFormProps>(), {
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
} = useDeviceAddForm<IVirtualDeviceAddForm>({
	id: props.id,
	type: DEVICES_VIRTUAL_TYPE,
});

// `useDeviceAddForm` maps every `DevicesModuleDeviceCategory` — this plugin cannot drive the six that
// need closed-loop control (see `VIRTUAL_SELECTABLE_CATEGORIES`), the same set the construction
// wizard's category step already excludes. Without this filter, this generic form (reachable via
// Devices → Add device → Virtual Devices, independent of the wizard) offers a category the backend's
// `ValidateCategoryAllowed` then rejects with a raw exception message.
const categoriesOptions = allCategoriesOptions.filter((item) => VIRTUAL_SELECTABLE_CATEGORIES.includes(item.value));

const rules = reactive<FormRules<IVirtualDeviceAddForm>>({
	category: [{ required: true, message: t('devicesVirtualPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
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
