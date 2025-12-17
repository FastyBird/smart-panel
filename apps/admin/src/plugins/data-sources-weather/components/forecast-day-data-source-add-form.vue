<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('dashboardModule.fields.dataSources.id.title')"
			prop="id"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.dataSources.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('dataSourcesWeatherPlugin.fields.locationId.title')"
			prop="locationId"
		>
			<el-select
				v-model="model.locationId"
				:placeholder="t('dataSourcesWeatherPlugin.fields.locationId.placeholder')"
				name="locationId"
				:loading="loadingLocations"
				filterable
				clearable
			>
				<el-option
					v-for="item in locationsOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-alert
			:description="t('dataSourcesWeatherPlugin.fields.locationId.description')"
			:closable="false"
			show-icon
			type="info"
			class="mb-4"
		/>

		<el-form-item
			:label="t('dataSourcesWeatherPlugin.fields.dayOffset.title')"
			prop="dayOffset"
		>
			<el-input-number
				v-model="model.dayOffset"
				:placeholder="t('dataSourcesWeatherPlugin.fields.dayOffset.placeholder')"
				:min="0"
				:max="7"
				name="dayOffset"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dataSourcesWeatherPlugin.fields.field.title')"
			prop="field"
		>
			<el-select
				v-model="model.field"
				:placeholder="t('dataSourcesWeatherPlugin.fields.field.placeholder')"
				name="field"
				filterable
			>
				<el-option
					v-for="item in fieldOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('dataSourcesWeatherPlugin.fields.icon.title')"
			prop="icon"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('dataSourcesWeatherPlugin.fields.icon.placeholder')"
			/>
		</el-form-item>

	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { IconPicker } from '../../../common';
import { DashboardException, FormResult, type FormResultType, type IDataSourceAddFormProps, useDataSourceAddForm } from '../../../modules/dashboard';
import { type IWeatherLocation, useLocations } from '../../../modules/weather';
import { DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE, WeatherDataField } from '../data-sources-weather.constants';
import type { IForecastDayDataSourceAddForm } from '../schemas/data-sources.types';

defineOptions({
	name: 'ForecastDayDataSourceAddForm',
});

const props = withDefaults(defineProps<IDataSourceAddFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = useDataSourceAddForm<IForecastDayDataSourceAddForm>({
	id: props.id,
	type: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	parent: props.parent,
	parentId: props.parentId,
});

const { locations, fetchLocations, areLoading: loadingLocations } = useLocations();

const rules = reactive<FormRules<IForecastDayDataSourceAddForm>>({
	dayOffset: [
		{ required: true, message: t('dataSourcesWeatherPlugin.fields.dayOffset.validation.required'), trigger: 'change' },
		{ type: 'number', min: 0, message: t('dataSourcesWeatherPlugin.fields.dayOffset.validation.min'), trigger: 'change' },
		{ type: 'number', max: 7, message: t('dataSourcesWeatherPlugin.fields.dayOffset.validation.max'), trigger: 'change' },
	],
	field: [{ required: true, message: t('dataSourcesWeatherPlugin.fields.field.validation.required'), trigger: 'change' }],
});

const locationsOptions = computed<{ value: IWeatherLocation['id']; label: string }[]>((): { value: IWeatherLocation['id']; label: string }[] => {
	return orderBy<IWeatherLocation>(locations.value, [(location: IWeatherLocation) => location.name], ['asc']).map((location) => ({
		value: location.id,
		label: location.name,
	}));
});

const fieldOptions = computed<{ value: WeatherDataField; label: string }[]>(() => {
	return Object.values(WeatherDataField).map((field) => ({
		value: field,
		label: t(`dataSourcesWeatherPlugin.fieldOptions.${field}`),
	}));
});

onBeforeMount((): void => {
	if (!loadingLocations.value) {
		fetchLocations().catch((error: unknown): void => {
			const err = error as Error;

			throw new DashboardException('Something went wrong', err);
		});
	}
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
