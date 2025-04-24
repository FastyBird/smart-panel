<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('dashboardModule.fields.tiles.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.tiles.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<el-row v-if="props.withPosition">
			<el-col :span="12">
				<el-form-item
					:label="t('dashboardModule.fields.tiles.row.title')"
					:prop="['row']"
				>
					<el-input-number
						v-model="model.row"
						:placeholder="t('dashboardModule.fields.tiles.row.placeholder')"
						name="row"
					/>
				</el-form-item>
			</el-col>
			<el-col :span="12">
				<el-form-item
					:label="t('dashboardModule.fields.tiles.col.title')"
					:prop="['col']"
				>
					<el-input-number
						v-model="model.col"
						:placeholder="t('dashboardModule.fields.tiles.col.placeholder')"
						name="col"
					/>
				</el-form-item>
			</el-col>
		</el-row>

		<el-row v-if="props.withSize">
			<el-col :span="12">
				<el-form-item
					:label="t('dashboardModule.fields.tiles.rowSpan.title')"
					:prop="['rowSpan']"
				>
					<el-input-number
						v-model="model.rowSpan"
						:placeholder="t('dashboardModule.fields.tiles.rowSpan.placeholder')"
						name="rowSpan"
					/>
				</el-form-item>
			</el-col>
			<el-col :span="12">
				<el-form-item
					:label="t('dashboardModule.fields.tiles.colSpan.title')"
					:prop="['colSpan']"
				>
					<el-input-number
						v-model="model.colSpan"
						:placeholder="t('dashboardModule.fields.tiles.colSpan.placeholder')"
						name="colSpan"
					/>
				</el-form-item>
			</el-col>
		</el-row>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCol, ElForm, ElFormItem, ElInput, ElInputNumber, ElRow, type FormRules } from 'element-plus';

import { type IPlugin } from '../../../../common';
import { useTileAddForm } from '../../composables/composables';
import { FormResult, type FormResultType } from '../../dashboard.constants';
import type { ITileAddForm } from '../../schemas/tiles.types';

import type { ITileAddFormProps } from './tile-add-form.types';

defineOptions({
	name: 'TileAddForm',
});

const props = withDefaults(defineProps<ITileAddFormProps & { type: IPlugin['type'] }>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	onlyDraft: false,
	withPosition: true,
	withSize: true,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, formChanged, submit, formResult } = useTileAddForm({
	id: props.id,
	type: props.type,
	parent: props.parent,
	parentId: props.parentId,
	onlyDraft: props.onlyDraft,
});

const rules = reactive<FormRules<ITileAddForm>>({
	row: [{ required: true, message: t('dashboardModule.fields.tiles.row.validation.required'), trigger: 'change' }],
	col: [{ required: true, message: t('dashboardModule.fields.tiles.col.validation.required'), trigger: 'change' }],
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
