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
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('pagesDeviceDetailPlugin.fields.device.title')"
			:prop="['device']"
		>
			<el-select
				v-model="model.device"
				:placeholder="t('pagesDeviceDetailPlugin.fields.device.placeholder')"
				name="device"
				:loading="loadingDevices"
				filterable
			>
				<el-option
					v-for="item in devicesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
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
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

import { ElCol, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElRow, ElSelect, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { DashboardException, FormResult, type FormResultType, type ITileEditFormProps, useTileEditForm } from '../../../modules/dashboard';
import { type IDevice, useDevices } from '../../../modules/devices';
import type { IDevicePreviewTileEditForm } from '../schemas/tiles.types';

defineOptions({
	name: 'DevicePreviewTileEditForm',
});

const props = withDefaults(defineProps<ITileEditFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = useTileEditForm<IDevicePreviewTileEditForm>({
	tile: props.tile,
	onlyDraft: props.onlyDraft,
});

const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();

const rules = reactive<FormRules<IDevicePreviewTileEditForm>>({
	row: [{ required: true, message: t('dashboardModule.fields.tiles.row.validation.required'), trigger: 'change' }],
	col: [{ required: true, message: t('dashboardModule.fields.tiles.col.validation.required'), trigger: 'change' }],
	device: [{ required: true, message: t('tilesDevicePreviewPlugin.fields.device.validation.required'), trigger: 'change' }],
});

const devicesOptions = computed<{ value: IDevice['id']; label: string }[]>((): { value: IDevice['id']; label: string }[] => {
	return orderBy<IDevice>(devices.value, [(device: IDevice) => device.name], ['asc']).map((device) => ({ value: device.id, label: device.name }));
});

onBeforeMount((): void => {
	fetchDevices().catch((error: unknown): void => {
		const err = error as Error;

		throw new DashboardException('Something went wrong', err);
	});
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
