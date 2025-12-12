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
			:title="t('weatherModule.headings.aboutLocationSettings')"
			:description="t('weatherModule.texts.aboutLocationSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('weatherModule.fields.config.locationType.title')"
			prop="locationType"
			class="mt-3"
		>
			<div class="flex flex-row items-center gap-2 w-full">
				<el-select
					v-model="model.locationType"
					:placeholder="t('weatherModule.fields.config.locationType.placeholder')"
					name="locationType"
					class="flex-1"
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
				<el-button
					@click="onUseMyLocation"
					class="px-2!"
				>
					<template #icon>
						<icon icon="mdi:map-marker-account-outline" />
					</template>
					{{ t('configModule.buttons.myLocation.title') }}
				</el-button>
			</div>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === 'lat_lon'"
			:label="t('configModule.fields.coordinates.title')"
			prop="latitude"
		>
			<div class="flex flex-row gap-2">
				<el-input
					v-model="model.latitude"
					:placeholder="t('configModule.fields.latitude.placeholder')"
					name="latitude"
					type="number"
					step="0.0001"
				/>
				<el-input
					v-model="model.longitude"
					:placeholder="t('configModule.fields.longitude.placeholder')"
					name="longitude"
					type="number"
					step="0.0001"
				/>
			</div>
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

		<hr />

		<el-form-item
			:label="t('weatherModule.fields.config.unit.title')"
			prop="unit"
			class="mt-3"
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

	<div
		v-if="model.locationType === 'lat_lon'"
		style="height: 50vh; width: 100%"
	>
		<l-map
			v-model="zoom"
			v-model:zoom="zoom"
			:use-global-leaflet="false"
			:center="center"
			@click="onMapClick"
		>
			<l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"></l-tile-layer>
			<l-marker
				v-if="marker"
				:lat-lng="marker"
			/>
		</l-map>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect, ElOption, type FormRules } from 'element-plus';
import 'leaflet/dist/leaflet.css';

import { Icon } from '@iconify/vue';
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet';

import { useFlashMessage } from '../../../common';
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
const flashMessage = useFlashMessage();

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IWeatherConfigEditForm>({
	config: props.config,
	messages: {
		success: t('weatherModule.messages.config.edited'),
		error: t('weatherModule.messages.config.notEdited'),
	},
});

const zoom = ref<number>(10);
const center = ref<[number, number]>([50.083328, 14.46667]); // Prague
const marker = ref<[number, number] | null>(null);

const onMapClick = (e: { latlng: { lat: number; lng: number } }): void => {
	if (model.locationType !== 'lat_lon') {
		return;
	}

	const { lat, lng } = e.latlng;

	setMarker(lat, lng);

	model.latitude = lat;
	model.longitude = lng;
};

const onUseMyLocation = (): void => {
	if (!navigator.geolocation) {
		flashMessage.error('Geolocation is not supported by your browser.');

		return;
	}

	navigator.geolocation.getCurrentPosition(
		(pos) => {
			const lat = pos.coords.latitude;
			const lng = pos.coords.longitude;

			model.latitude = lat;
			model.longitude = lng;

			model.locationType = 'lat_lon';

			setMarker(lat, lng);
		},
		(err) => {
			flashMessage.error('Unable to retrieve your location.');

			console.error(err);
		}
	);
};

const setMarker = (lat: number, lon: number): void => {
	marker.value = [lat, lon];
	center.value = [lat, lon];

	if (model.locationType === 'lat_lon') {
		zoom.value = 18;
	} else {
		zoom.value = 13;
	}
};

onBeforeMount(async (): Promise<void> => {
	if (model.latitude && model.longitude) {
		setMarker(model.latitude, model.longitude);
	}
});

watch(
	(): string => model.locationType,
	(): void => {
		if (model.locationType === 'lat_lon' && model.latitude && model.longitude) {
			setMarker(model.latitude, model.longitude);
		}
	}
);

watch(
	(): number | null => model.latitude,
	(): void => {
		if (model.locationType === 'lat_lon' && model.latitude !== null && model.longitude !== null) {
			setMarker(model.latitude, model.longitude);
		}
	}
);

watch(
	(): number | null => model.longitude,
	(): void => {
		if (model.locationType === 'lat_lon' && model.latitude !== null && model.longitude !== null) {
			setMarker(model.latitude, model.longitude);
		}
	}
);

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
