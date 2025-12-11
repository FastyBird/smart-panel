<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('weatherModule.fields.config.locationType.title')"
			prop="locationType"
		>
			<el-select
				v-model="model.locationType"
				:placeholder="t('weatherModule.fields.config.locationType.placeholder')"
				name="locationType"
			>
				<el-option
					:label="t('weatherModule.fields.config.locationType.values.latLon')"
					value="lat_lon"
				/>
				<el-option
					:label="t('weatherModule.fields.config.locationType.values.cityName')"
					value="city_name"
				/>
				<el-option
					:label="t('weatherModule.fields.config.locationType.values.cityId')"
					value="city_id"
				/>
				<el-option
					:label="t('weatherModule.fields.config.locationType.values.zipCode')"
					value="zip_code"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === 'lat_lon'"
			:label="t('weatherModule.fields.config.latitude.title')"
			prop="latitude"
		>
			<el-input-number
				v-model="model.latitude"
				:min="-90"
				:max="90"
				:step="0.0001"
				:placeholder="t('weatherModule.fields.config.latitude.placeholder')"
				name="latitude"
			/>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === 'lat_lon'"
			:label="t('weatherModule.fields.config.longitude.title')"
			prop="longitude"
		>
			<el-input-number
				v-model="model.longitude"
				:min="-180"
				:max="180"
				:step="0.0001"
				:placeholder="t('weatherModule.fields.config.longitude.placeholder')"
				name="longitude"
			/>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === 'city_name'"
			:label="t('weatherModule.fields.config.cityName.title')"
			prop="cityName"
		>
			<el-input
				v-model="model.cityName"
				:placeholder="t('weatherModule.fields.config.cityName.placeholder')"
				name="cityName"
			/>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === 'city_id'"
			:label="t('weatherModule.fields.config.cityId.title')"
			prop="cityId"
		>
			<el-input-number
				v-model="model.cityId"
				:min="1"
				:placeholder="t('weatherModule.fields.config.cityId.placeholder')"
				name="cityId"
			/>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === 'zip_code'"
			:label="t('weatherModule.fields.config.zipCode.title')"
			prop="zipCode"
		>
			<el-input
				v-model="model.zipCode"
				:placeholder="t('weatherModule.fields.config.zipCode.placeholder')"
				name="zipCode"
			/>
		</el-form-item>

		<el-form-item
			:label="t('weatherModule.fields.config.unit.title')"
			prop="unit"
		>
			<el-select
				v-model="model.unit"
				:placeholder="t('weatherModule.fields.config.unit.placeholder')"
				name="unit"
			>
				<el-option
					:label="t('weatherModule.fields.config.unit.values.celsius')"
					value="celsius"
				/>
				<el-option
					:label="t('weatherModule.fields.config.unit.values.fahrenheit')"
					value="fahrenheit"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('weatherModule.fields.config.openWeatherApiKey.title')"
			prop="openWeatherApiKey"
		>
			<el-input
				v-model="model.openWeatherApiKey"
				type="password"
				:placeholder="t('weatherModule.fields.config.openWeatherApiKey.placeholder')"
				name="openWeatherApiKey"
				show-password
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect, ElOption, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import type { IWeatherConfigEditForm } from '../schemas/config.types';

import type { IWeatherConfigFormProps } from './weather-config-form.types';

defineOptions({
	name: 'WeatherConfigForm',
});

const props = withDefaults(defineProps<IWeatherConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IWeatherConfigEditForm>({
	config: props.config,
	messages: {
		success: t('weatherModule.messages.config.edited'),
		error: t('weatherModule.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IWeatherConfigEditForm>>({
	locationType: [{ required: true, message: t('weatherModule.fields.config.locationType.validation.required'), trigger: 'change' }],
	unit: [{ required: true, message: t('weatherModule.fields.config.unit.validation.required'), trigger: 'change' }],
	latitude: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'lat_lon' && (value === null || value === undefined)) {
					callback(new Error(t('weatherModule.fields.config.latitude.validation.required')));
				} else if (model.locationType === 'lat_lon' && (value < -90 || value > 90)) {
					callback(new Error(t('weatherModule.fields.config.latitude.validation.range')));
				} else {
					callback();
				}
			},
			trigger: 'change',
		},
	],
	longitude: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'lat_lon' && (value === null || value === undefined)) {
					callback(new Error(t('weatherModule.fields.config.longitude.validation.required')));
				} else if (model.locationType === 'lat_lon' && (value < -180 || value > 180)) {
					callback(new Error(t('weatherModule.fields.config.longitude.validation.range')));
				} else {
					callback();
				}
			},
			trigger: 'change',
		},
	],
	cityName: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'city_name' && (!value || value.trim() === '')) {
					callback(new Error(t('weatherModule.fields.config.cityName.validation.required')));
				} else {
					callback();
				}
			},
			trigger: 'change',
		},
	],
	cityId: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'city_id' && (value === null || value === undefined || value < 1)) {
					callback(new Error(t('weatherModule.fields.config.cityId.validation.required')));
				} else {
					callback();
				}
			},
			trigger: 'change',
		},
	],
	zipCode: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'zip_code' && (!value || value.trim() === '')) {
					callback(new Error(t('weatherModule.fields.config.zipCode.validation.required')));
				} else {
					callback();
				}
			},
			trigger: 'change',
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
