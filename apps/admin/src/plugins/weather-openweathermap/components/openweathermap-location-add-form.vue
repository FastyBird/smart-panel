<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		@submit.prevent="onSubmit"
	>
		<!-- Location Name -->
		<el-form-item
			:label="t('weatherOpenweathermapPlugin.fields.locations.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('weatherOpenweathermapPlugin.fields.locations.name.placeholder')"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherOpenweathermapPlugin.fields.locations.name.description') }}
			</div>
		</el-form-item>

		<!-- Location Type -->
		<el-form-item
			:label="t('weatherOpenweathermapPlugin.fields.locations.locationType.title')"
			prop="locationType"
		>
			<div class="flex flex-row items-center gap-2 w-full">
				<el-select
					v-model="model.locationType"
					:placeholder="t('weatherOpenweathermapPlugin.fields.locations.locationType.placeholder')"
					name="locationType"
					class="flex-1"
				>
					<el-option
						:label="t('weatherOpenweathermapPlugin.fields.locations.locationType.values.latLon')"
						:value="OpenWeatherMapLocationType.lat_lon"
					/>
					<el-option
						:label="t('weatherOpenweathermapPlugin.fields.locations.locationType.values.cityName')"
						:value="OpenWeatherMapLocationType.city_name"
					/>
					<el-option
						:label="t('weatherOpenweathermapPlugin.fields.locations.locationType.values.cityId')"
						:value="OpenWeatherMapLocationType.city_id"
					/>
					<el-option
						:label="t('weatherOpenweathermapPlugin.fields.locations.locationType.values.zipCode')"
						:value="OpenWeatherMapLocationType.zip_code"
					/>
				</el-select>
				<el-button
					:loading="isGettingLocation"
					:disabled="model.locationType !== OpenWeatherMapLocationType.lat_lon"
					class="px-2!"
					@click="getMyLocation"
				>
					<template #icon>
						<icon icon="mdi:map-marker-account-outline" />
					</template>
					{{ t('weatherOpenweathermapPlugin.buttons.myLocation.title') }}
				</el-button>
			</div>
		</el-form-item>

		<!-- Latitude/Longitude fields (when lat_lon type) -->
		<div
			v-if="model.locationType === OpenWeatherMapLocationType.lat_lon"
			class="flex flex-row items-start gap-4"
		>
			<el-form-item
				:label="t('weatherOpenweathermapPlugin.fields.locations.latitude.title')"
				prop="latitude"
				class="flex-1"
			>
				<el-input
					v-model="model.latitude"
					:placeholder="t('weatherOpenweathermapPlugin.fields.locations.latitude.placeholder')"
					name="latitude"
					type="number"
					step="0.0001"
				/>
			</el-form-item>
			<el-form-item
				:label="t('weatherOpenweathermapPlugin.fields.locations.longitude.title')"
				prop="longitude"
				class="flex-1"
			>
				<el-input
					v-model="model.longitude"
					:placeholder="t('weatherOpenweathermapPlugin.fields.locations.longitude.placeholder')"
					name="longitude"
					type="number"
					step="0.0001"
				/>
			</el-form-item>
		</div>

		<!-- City Name field (when city_name type) -->
		<el-form-item
			v-if="model.locationType === OpenWeatherMapLocationType.city_name"
			:label="t('weatherOpenweathermapPlugin.fields.locations.cityName.title')"
			prop="cityName"
		>
			<el-input
				v-model="model.cityName"
				:placeholder="t('weatherOpenweathermapPlugin.fields.locations.cityName.placeholder')"
				name="cityName"
			/>
		</el-form-item>

		<!-- Country Code field (when city_name type) -->
		<el-form-item
			v-if="model.locationType === OpenWeatherMapLocationType.city_name"
			:label="t('weatherOpenweathermapPlugin.fields.locations.countryCode.title')"
			prop="countryCode"
		>
			<el-input
				v-model="model.countryCode"
				:placeholder="t('weatherOpenweathermapPlugin.fields.locations.countryCode.placeholder')"
				name="countryCode"
				maxlength="2"
			/>
		</el-form-item>

		<!-- City ID field (when city_id type) -->
		<el-form-item
			v-if="model.locationType === OpenWeatherMapLocationType.city_id"
			:label="t('weatherOpenweathermapPlugin.fields.locations.cityId.title')"
			prop="cityId"
		>
			<el-input
				v-model="model.cityId"
				:placeholder="t('weatherOpenweathermapPlugin.fields.locations.cityId.placeholder')"
				name="cityId"
				type="number"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherOpenweathermapPlugin.fields.locations.cityId.description') }}
			</div>
		</el-form-item>

		<!-- ZIP Code field (when zip_code type) -->
		<el-form-item
			v-if="model.locationType === OpenWeatherMapLocationType.zip_code"
			:label="t('weatherOpenweathermapPlugin.fields.locations.zipCode.title')"
			prop="zipCode"
		>
			<el-input
				v-model="model.zipCode"
				:placeholder="t('weatherOpenweathermapPlugin.fields.locations.zipCode.placeholder')"
				name="zipCode"
			/>
		</el-form-item>

		<!-- Country Code field (when zip_code type) -->
		<el-form-item
			v-if="model.locationType === OpenWeatherMapLocationType.zip_code"
			:label="t('weatherOpenweathermapPlugin.fields.locations.countryCode.title')"
			prop="zipCountryCode"
		>
			<el-input
				v-model="model.zipCountryCode"
				:placeholder="t('weatherOpenweathermapPlugin.fields.locations.countryCode.placeholder')"
				name="zipCountryCode"
				maxlength="2"
			/>
		</el-form-item>
	</el-form>

	<!-- Map (when lat_lon type) -->
	<div
		v-if="model.locationType === OpenWeatherMapLocationType.lat_lon"
		style="height: 35vh; width: 100%"
	>
		<l-map
			v-model:zoom="zoom"
			:use-global-leaflet="false"
			:center="center"
			@click="onMapClick"
		>
			<l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"></l-tile-layer>
			<l-marker
				v-if="marker"
				:lat-lng="marker"
				:draggable="true"
				@moveend="onMarkerMoveEnd"
			/>
		</l-map>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import 'leaflet/dist/leaflet.css';

import { Icon } from '@iconify/vue';
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, weatherLocationsStoreKey } from '../../../modules/weather';
import { OpenWeatherMapLocationType, WEATHER_OPENWEATHERMAP_PLUGIN_TYPE } from '../weather-openweathermap.constants';

import type { IOpenWeatherMapLocationAddFormProps } from './openweathermap-location-add-form.types';

defineOptions({
	name: 'OpenWeatherMapLocationAddForm',
});

const props = withDefaults(defineProps<IOpenWeatherMapLocationAddFormProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', submit: boolean): void;
	(e: 'update:remote-form-result', result: FormResultType): void;
	(e: 'update:remote-form-reset', reset: boolean): void;
	(e: 'update:remote-form-changed', changed: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

const formEl = ref<FormInstance | undefined>(undefined);
const isGettingLocation = ref(false);

// Map state
const zoom = ref<number>(10);
const center = ref<[number, number]>([50.083328, 14.46667]); // Prague
const marker = ref<[number, number] | null>(null);

interface ILocationModel {
	name: string;
	locationType: (typeof OpenWeatherMapLocationType)[keyof typeof OpenWeatherMapLocationType];
	latitude: number | null;
	longitude: number | null;
	cityName: string;
	countryCode: string;
	cityId: string;
	zipCode: string;
	zipCountryCode: string;
}

const model = reactive<ILocationModel>({
	name: '',
	locationType: OpenWeatherMapLocationType.lat_lon,
	latitude: null,
	longitude: null,
	cityName: '',
	countryCode: '',
	cityId: '',
	zipCode: '',
	zipCountryCode: '',
});

const rules: FormRules<ILocationModel> = {
	name: [
		{
			required: true,
			message: t('weatherOpenweathermapPlugin.fields.locations.name.validation.required'),
			trigger: 'blur',
		},
	],
	locationType: [
		{
			required: true,
			message: t('weatherOpenweathermapPlugin.fields.locations.locationType.validation.required'),
			trigger: 'change',
		},
	],
	latitude: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === OpenWeatherMapLocationType.lat_lon && (value === null || value === undefined || value === '')) {
					callback(new Error(t('weatherOpenweathermapPlugin.fields.locations.latitude.validation.required')));
				} else if (model.locationType === OpenWeatherMapLocationType.lat_lon && (Number(value) < -90 || Number(value) > 90)) {
					callback(new Error(t('weatherOpenweathermapPlugin.fields.locations.latitude.validation.range')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	longitude: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === OpenWeatherMapLocationType.lat_lon && (value === null || value === undefined || value === '')) {
					callback(new Error(t('weatherOpenweathermapPlugin.fields.locations.longitude.validation.required')));
				} else if (model.locationType === OpenWeatherMapLocationType.lat_lon && (Number(value) < -180 || Number(value) > 180)) {
					callback(new Error(t('weatherOpenweathermapPlugin.fields.locations.longitude.validation.range')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	cityName: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === OpenWeatherMapLocationType.city_name && (!value || value.trim() === '')) {
					callback(new Error(t('weatherOpenweathermapPlugin.fields.locations.cityName.validation.required')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	cityId: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === OpenWeatherMapLocationType.city_id && (!value || value.trim() === '')) {
					callback(new Error(t('weatherOpenweathermapPlugin.fields.locations.cityId.validation.required')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	zipCode: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === OpenWeatherMapLocationType.zip_code && (!value || value.trim() === '')) {
					callback(new Error(t('weatherOpenweathermapPlugin.fields.locations.zipCode.validation.required')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
};

const setMarker = (lat: number, lon: number): void => {
	marker.value = [lat, lon];
	center.value = [lat, lon];

	if (model.locationType === OpenWeatherMapLocationType.lat_lon) {
		zoom.value = 18;
	} else {
		zoom.value = 13;
	}
};

const onMapClick = (e: { latlng: { lat: number; lng: number } }): void => {
	if (model.locationType !== OpenWeatherMapLocationType.lat_lon) {
		return;
	}

	const { lat, lng } = e.latlng;

	setMarker(lat, lng);

	model.latitude = lat;
	model.longitude = lng;
};

const onMarkerMoveEnd = (e: { target: { getLatLng: () => { lat: number; lng: number } } }): void => {
	const { lat, lng } = e.target.getLatLng();

	model.latitude = lat;
	model.longitude = lng;
	marker.value = [lat, lng];
};

const getMyLocation = (): void => {
	if (!navigator.geolocation) {
		flashMessage.error(t('weatherOpenweathermapPlugin.messages.geolocationNotSupported'));
		return;
	}

	isGettingLocation.value = true;

	navigator.geolocation.getCurrentPosition(
		(position) => {
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;

			model.latitude = lat;
			model.longitude = lng;
			model.locationType = OpenWeatherMapLocationType.lat_lon;

			setMarker(lat, lng);

			isGettingLocation.value = false;
		},
		(error) => {
			isGettingLocation.value = false;
			switch (error.code) {
				case error.PERMISSION_DENIED:
					flashMessage.error(t('weatherOpenweathermapPlugin.messages.geolocationDenied'));
					break;
				case error.POSITION_UNAVAILABLE:
					flashMessage.error(t('weatherOpenweathermapPlugin.messages.geolocationUnavailable'));
					break;
				case error.TIMEOUT:
					flashMessage.error(t('weatherOpenweathermapPlugin.messages.geolocationTimeout'));
					break;
				default:
					flashMessage.error(t('weatherOpenweathermapPlugin.messages.geolocationError'));
			}
		},
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0,
		}
	);
};

const onSubmit = async (): Promise<void> => {
	if (!formEl.value) return;

	emit('update:remote-form-result', FormResult.WORKING);

	const valid = await formEl.value.validate().catch(() => false);
	if (!valid) {
		emit('update:remote-form-result', FormResult.NONE);
		return;
	}

	try {
		const locationData: { name: string; type: string } & Record<string, unknown> = {
			name: model.name,
			type: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
			location_type: model.locationType,
		};

		if (model.locationType === OpenWeatherMapLocationType.lat_lon) {
			locationData.latitude = model.latitude !== null ? Number(model.latitude) : undefined;
			locationData.longitude = model.longitude !== null ? Number(model.longitude) : undefined;
		} else if (model.locationType === OpenWeatherMapLocationType.city_name) {
			locationData.city_name = model.cityName;
			locationData.country_code = model.countryCode || undefined;
		} else if (model.locationType === OpenWeatherMapLocationType.city_id) {
			locationData.city_id = model.cityId ? parseInt(model.cityId, 10) : undefined;
		} else if (model.locationType === OpenWeatherMapLocationType.zip_code) {
			locationData.zip_code = model.zipCode;
			locationData.country_code = model.zipCountryCode || undefined;
		}

		await locationsStore.add({
			id: props.id,
			draft: false,
			data: locationData,
		});

		flashMessage.success(t('weatherOpenweathermapPlugin.messages.locations.created', { location: model.name }));
		emit('update:remote-form-result', FormResult.OK);
	} catch {
		flashMessage.error(t('weatherOpenweathermapPlugin.messages.locations.notCreated', { location: model.name }));
		emit('update:remote-form-result', FormResult.ERROR);

		setTimeout(() => {
			emit('update:remote-form-result', FormResult.NONE);
		}, 2000);
	}
};

onBeforeMount((): void => {
	if (model.latitude && model.longitude) {
		setMarker(model.latitude, model.longitude);
	}
});

watch(
	() => model.locationType,
	(): void => {
		if (model.locationType === OpenWeatherMapLocationType.lat_lon && model.latitude && model.longitude) {
			setMarker(model.latitude, model.longitude);
		}
	}
);

watch(
	() => model.latitude,
	(): void => {
		if (
			model.locationType === OpenWeatherMapLocationType.lat_lon &&
			model.latitude !== null &&
			typeof model.latitude !== 'undefined' &&
			model.longitude !== null &&
			typeof model.longitude !== 'undefined'
		) {
			setMarker(model.latitude, model.longitude);
		}
	}
);

watch(
	() => model.longitude,
	(): void => {
		if (
			model.locationType === OpenWeatherMapLocationType.lat_lon &&
			model.latitude !== null &&
			typeof model.latitude !== 'undefined' &&
			model.longitude !== null &&
			typeof model.longitude !== 'undefined'
		) {
			setMarker(model.latitude, model.longitude);
		}
	}
);

watch(
	() => props.remoteFormSubmit,
	(val) => {
		if (val) {
			emit('update:remote-form-submit', false);
			onSubmit();
		}
	}
);

watch(
	() => props.remoteFormReset,
	(val) => {
		if (val) {
			emit('update:remote-form-reset', false);
			formEl.value?.resetFields();
		}
	}
);

watch(
	model,
	() => {
		emit('update:remote-form-changed', true);
	},
	{ deep: true }
);
</script>
