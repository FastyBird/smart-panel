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
			:show-id="false"
		>
			<plugin-form-section :title="t('devicesReTerminalPlugin.sections.connection')">
				<el-form-item
					:label="t('devicesReTerminalPlugin.fields.devices.variant.title')"
					prop="variant"
				>
					<el-select
						v-model="model.variant"
						:placeholder="t('devicesReTerminalPlugin.fields.devices.variant.placeholder')"
						name="variant"
					>
						<el-option
							v-for="item in variantOptions"
							:key="item.value"
							:label="item.label"
							:value="item.value"
						/>
					</el-select>
				</el-form-item>
			</plugin-form-section>
		</device-form-frame>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, type FormRules } from 'element-plus';

import { PluginFormSection } from '../../../common';
import { DeviceFormFrame, FormResult, type FormResultType } from '../../../modules/devices';
import { DevicesReTerminalPluginVariant } from '../../../openapi.constants';
import { useDeviceAddForm } from '../composables/useDeviceAddForm';
import type { IReTerminalDeviceAddForm } from '../schemas/devices.types';

import type { IReTerminalDeviceAddFormProps } from './reterminal-device-add-form.types';

defineOptions({
	name: 'ReTerminalDeviceAddForm',
});

const props = withDefaults(defineProps<IReTerminalDeviceAddFormProps>(), {
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

const { categoriesOptions, model, formEl, formChanged, submit, formResult } = useDeviceAddForm({
	id: props.id,
});

const variantOptions = [
	{ value: DevicesReTerminalPluginVariant.reterminal, label: 'reTerminal CM4' },
	{ value: DevicesReTerminalPluginVariant.reterminal_dm, label: 'reTerminal DM' },
];

const rules = reactive<FormRules<IReTerminalDeviceAddForm>>({
	name: [{ required: true, message: t('devicesReTerminalPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesReTerminalPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
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
