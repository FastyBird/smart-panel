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
			:label="t('dashboardModule.fields.pages.icon.title')"
			:prop="['icon']"
		>
			<icon-picker
				:model="model.icon"
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
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, type FormRules } from 'element-plus';

import { IconPicker } from '../../../common';
import { FormResult, type FormResultType, type IPageAddForm, usePageAddForm } from '../../../modules/dashboard';

import type { IDeviceDetailPageAddFormProps } from './device-detail-page-add-form.types';

defineOptions({
	name: 'DeviceDetailPageAddForm',
});

const props = withDefaults(defineProps<IDeviceDetailPageAddFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = usePageAddForm({ id: props.id, type: 'device-detail' });

const rules = reactive<FormRules<IPageAddForm>>({
	title: [{ required: true, message: t('dashboardModule.fields.pages.title.validation.required'), trigger: 'change' }],
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
