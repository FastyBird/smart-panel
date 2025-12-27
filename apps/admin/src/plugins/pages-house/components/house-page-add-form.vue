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
			prop="id"
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
			prop="title"
		>
			<el-input
				v-model="model.title"
				:placeholder="t('dashboardModule.fields.pages.title.placeholder')"
				name="title"
			/>
		</el-form-item>

		<el-form-item
			:label="t('pagesHousePlugin.fields.viewMode.title')"
			prop="viewMode"
		>
			<el-select
				v-model="model.viewMode"
				:placeholder="t('pagesHousePlugin.fields.viewMode.placeholder')"
				name="viewMode"
				clearable
			>
				<el-option
					value="simple"
					:label="t('pagesHousePlugin.fields.viewMode.options.simple')"
				/>
				<el-option
					value="detailed"
					:label="t('pagesHousePlugin.fields.viewMode.options.detailed')"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('pagesHousePlugin.fields.showWeather.title')"
			prop="showWeather"
		>
			<el-switch
				v-model="model.showWeather"
				name="showWeather"
			/>
			<el-text
				size="small"
				class="block mt-1 text-gray-500"
			>
				{{ t('pagesHousePlugin.fields.showWeather.description') }}
			</el-text>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.icon.title')"
			prop="icon"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('dashboardModule.fields.pages.icon.placeholder')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.order.title')"
			prop="order"
		>
			<el-input-number
				v-model="model.order"
				:placeholder="t('dashboardModule.fields.pages.order.placeholder')"
				name="order"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.showTopBar.title')"
			prop="showTopBar"
		>
			<el-switch
				v-model="model.showTopBar"
				name="showTopBar"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.displays.title')"
			:prop="['displays']"
		>
			<displays-multi-select
				v-model="model.displays"
				:placeholder="t('dashboardModule.fields.pages.displays.placeholder')"
			/>
			<el-text
				size="small"
				class="block mt-1 text-gray-500"
			>
				{{ t('dashboardModule.fields.pages.displays.description') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, ElText, type FormRules } from 'element-plus';

import { IconPicker } from '../../../common';
import { FormResult, type FormResultType, type IPageAddFormProps, usePageAddForm } from '../../../modules/dashboard';
import { DisplaysMultiSelect } from '../../../modules/displays';
import { PAGES_HOUSE_TYPE } from '../pages-house.constants';
import type { IHousePageAddForm } from '../schemas/pages.types';

defineOptions({
	name: 'HousePageAddForm',
});

const props = withDefaults(defineProps<IPageAddFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = usePageAddForm<IHousePageAddForm>({
	id: props.id,
	type: PAGES_HOUSE_TYPE,
});

// Set defaults for house page
if (model.value.viewMode === undefined) {
	model.value.viewMode = 'simple';
}
if (model.value.showWeather === undefined) {
	model.value.showWeather = true;
}

const rules = reactive<FormRules<IHousePageAddForm>>({
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
