<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('displaysModule.fields.config.deploymentMode.title')"
			prop="deploymentMode"
		>
			<el-select
				v-model="model.deploymentMode"
				:placeholder="t('displaysModule.fields.config.deploymentMode.placeholder')"
				name="deploymentMode"
			>
				<el-option
					label="Standalone"
					value="standalone"
				/>
				<el-option
					label="All-in-one"
					value="all-in-one"
				/>
				<el-option
					label="Combined"
					value="combined"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('displaysModule.fields.config.permitJoinDurationMs.title')"
			prop="permitJoinDurationMs"
		>
			<el-input-number
				v-model="model.permitJoinDurationMs"
				:min="1000"
				:step="1000"
				:placeholder="t('displaysModule.fields.config.permitJoinDurationMs.placeholder')"
				name="permitJoinDurationMs"
			/>
			<template #append>
				<span>{{ t('displaysModule.fields.config.permitJoinDurationMs.unit') }}</span>
			</template>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInputNumber, ElSelect, ElOption, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import type { IDisplaysConfigEditForm } from '../schemas/config.types';

import type { IDisplaysConfigFormProps } from './displays-config-form.types';

defineOptions({
	name: 'DisplaysConfigForm',
});

const props = withDefaults(defineProps<IDisplaysConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IDisplaysConfigEditForm>({
	config: props.config,
	messages: {
		success: t('displaysModule.messages.config.edited'),
		error: t('displaysModule.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IDisplaysConfigEditForm>>({
	deploymentMode: [
		{ required: true, message: t('displaysModule.fields.config.deploymentMode.validation.required'), trigger: 'change' },
	],
	permitJoinDurationMs: [
		{ required: true, message: t('displaysModule.fields.config.permitJoinDurationMs.validation.required'), trigger: 'change' },
		{ type: 'number', min: 1000, message: t('displaysModule.fields.config.permitJoinDurationMs.validation.min'), trigger: 'change' },
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
