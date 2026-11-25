<template>
	<el-form
		ref="formEl"
		:model="model"
		label-position="top"
		status-icon
	>
		<data-source-form-frame :model="model" />
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';

import { ElForm } from 'element-plus';

import { useDataSourceEditForm } from '../../composables/composables';
import { FormResult, type FormResultType } from '../../dashboard.constants';

import type { IDataSourceEditFormProps } from './data-source-edit-form.types';
import DataSourceFormFrame from './data-source-form-frame.vue';

defineOptions({
	name: 'DataSourceEditForm',
});

const props = withDefaults(defineProps<IDataSourceEditFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = useDataSourceEditForm({ dataSource: props.dataSource, onlyDraft: props.onlyDraft });

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
