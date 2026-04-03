<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-alert
			type="info"
			:title="t('storageModule.headings.aboutStorage')"
			:description="t('storageModule.texts.aboutStorage')"
			:closable="false"
		/>

		<el-form-item
			:label="t('storageModule.fields.config.primaryStorage.title')"
			prop="primaryStorage"
			class="mt-3"
		>
			<el-select
				v-model="model.primaryStorage"
				:placeholder="t('storageModule.fields.config.primaryStorage.placeholder')"
			>
				<el-option
					v-for="option in storagePluginOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('storageModule.fields.config.fallbackStorage.title')"
			prop="fallbackStorage"
		>
			<el-select
				v-model="model.fallbackStorage"
				:placeholder="t('storageModule.fields.config.fallbackStorage.placeholder')"
				clearable
			>
				<el-option
					v-for="option in storagePluginOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import { useStoragePlugins } from '../composables/useStoragePlugins';
import type { IStorageConfigEditForm } from '../schemas/config.types';

import type { IStorageConfigFormProps } from './storage-config-form.types';

defineOptions({
	name: 'StorageConfigForm',
});

const props = withDefaults(defineProps<IStorageConfigFormProps>(), {
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

const { options: storagePluginOptions } = useStoragePlugins();

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IStorageConfigEditForm>({
	config: props.config,
	messages: {
		success: t('storageModule.messages.config.edited'),
		error: t('storageModule.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IStorageConfigEditForm>>({
	primaryStorage: [{ required: true, message: t('storageModule.fields.config.primaryStorage.validation.required'), trigger: 'change' }],
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
