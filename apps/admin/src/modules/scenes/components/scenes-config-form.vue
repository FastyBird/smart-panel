<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('scenes.fields.config.executionTimeoutMs.title')"
			prop="executionTimeoutMs"
		>
			<el-input-number
				v-model="model.executionTimeoutMs"
				:min="1000"
				:max="300000"
				:step="1000"
				name="executionTimeoutMs"
			/>
			<template #extra>
				<span class="el-form-item__extra">
					{{ t('scenes.fields.config.executionTimeoutMs.hint') }}
				</span>
			</template>
		</el-form-item>

		<el-form-item
			:label="t('scenes.fields.config.maxConcurrentExecutions.title')"
			prop="maxConcurrentExecutions"
		>
			<el-input-number
				v-model="model.maxConcurrentExecutions"
				:min="1"
				:max="100"
				:step="1"
				name="maxConcurrentExecutions"
			/>
			<template #extra>
				<span class="el-form-item__extra">
					{{ t('scenes.fields.config.maxConcurrentExecutions.hint') }}
				</span>
			</template>
		</el-form-item>

		<el-form-item
			:label="t('scenes.fields.config.continueOnActionFailure.title')"
			prop="continueOnActionFailure"
		>
			<el-switch
				v-model="model.continueOnActionFailure"
				name="continueOnActionFailure"
			/>
			<template #extra>
				<span class="el-form-item__extra">
					{{ t('scenes.fields.config.continueOnActionFailure.hint') }}
				</span>
			</template>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInputNumber, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import type { IScenesConfigEditForm } from '../schemas/config.types';

import type { IScenesConfigFormProps } from './scenes-config-form.types';

defineOptions({
	name: 'ScenesConfigForm',
});

const props = withDefaults(defineProps<IScenesConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IScenesConfigEditForm>({
	config: props.config,
	messages: {
		success: t('scenes.messages.config.edited'),
		error: t('scenes.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IScenesConfigEditForm>>({
	executionTimeoutMs: [
		{
			type: 'number',
			min: 1000,
			max: 300000,
			message: t('scenes.fields.config.executionTimeoutMs.validation.range'),
			trigger: 'blur',
		},
	],
	maxConcurrentExecutions: [
		{
			type: 'number',
			min: 1,
			max: 100,
			message: t('scenes.fields.config.maxConcurrentExecutions.validation.range'),
			trigger: 'blur',
		},
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
