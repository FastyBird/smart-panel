<template>
	<el-form
		ref="formEl"
		:model="model"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('dashboardModule.fields.dataSources.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.dataSources.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput } from 'element-plus';

import { type IPlugin } from '../../../../common';
import { useDataSourceAddForm } from '../../composables/composables';
import { FormResult, type FormResultType } from '../../dashboard.constants';

import type { IDataSourceAddFormProps } from './data-source-add-form.types';

defineOptions({
	name: 'DataSourceAddForm',
});

const props = withDefaults(defineProps<IDataSourceAddFormProps & { type: IPlugin['type'] }>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	onlyDraft: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, formChanged, submit, formResult } = useDataSourceAddForm({
	id: props.id,
	type: props.type,
	parent: props.parent,
	parentId: props.parentId,
	onlyDraft: props.onlyDraft,
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
