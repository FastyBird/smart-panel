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
			:label="t('weatherOpenweathermapOnecallPlugin.fields.locations.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('weatherOpenweathermapOnecallPlugin.fields.locations.name.placeholder')"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherOpenweathermapOnecallPlugin.fields.locations.name.description') }}
			</div>
		</el-form-item>

		<!-- City Search with My Location button -->
		<el-form-item :label="t('weatherOpenweathermapOnecallPlugin.fields.locations.citySearch.title')">
			<div class="flex flex-row items-center gap-2 w-full">
				<el-autocomplete
					v-model="searchQuery"
					:fetch-suggestions="handleCitySearch"
					:placeholder="t('weatherOpenweathermapOnecallPlugin.fields.locations.citySearch.placeholder')"
					:loading="isSearching"
					:debounce="500"
					clearable
					class="flex-1"
					@select="handleCitySelect"
				>
					<template #default="{ item }">
						<div class="flex flex-col py-1">
							<span class="font-medium">{{ item.name }}</span>
							<span class="text-xs text-gray-500">
								{{ item.state ? `${item.state}, ` : '' }}{{ item.country }}
								<span class="ml-2 text-gray-400"> ({{ item.lat.toFixed(4) }}, {{ item.lon.toFixed(4) }}) </span>
							</span>
						</div>
					</template>
				</el-autocomplete>
				<el-button
					:loading="isGettingLocation"
					class="px-2!"
					@click="getMyLocation"
				>
					<template #icon>
						<icon icon="mdi:map-marker-account-outline" />
					</template>
					{{ t('weatherOpenweathermapOnecallPlugin.buttons.myLocation.title') }}
				</el-button>
			</div>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherOpenweathermapOnecallPlugin.fields.locations.citySearch.description') }}
			</div>
		</el-form-item>

		<el-divider content-position="left" class="mt-6!">{{ t('weatherOpenweathermapOnecallPlugin.texts.orEnterManually') }}</el-divider>

		<!-- Latitude/Longitude fields -->
		<div class="flex flex-row items-start gap-4">
			<el-form-item
				:label="t('weatherOpenweathermapOnecallPlugin.fields.locations.latitude.title')"
				prop="latitude"
				class="flex-1"
			>
				<el-input
					v-model="model.latitude"
					:placeholder="t('weatherOpenweathermapOnecallPlugin.fields.locations.latitude.placeholder')"
					name="latitude"
					type="number"
					step="0.0001"
				/>
			</el-form-item>
			<el-form-item
				:label="t('weatherOpenweathermapOnecallPlugin.fields.locations.longitude.title')"
				prop="longitude"
				class="flex-1"
			>
				<el-input
					v-model="model.longitude"
					:placeholder="t('weatherOpenweathermapOnecallPlugin.fields.locations.longitude.placeholder')"
					name="longitude"
					type="number"
					step="0.0001"
				/>
			</el-form-item>
		</div>
	</el-form>

	<!-- Map -->
	<div style="height: 35vh; width: 100%">
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

import { ElAutocomplete, ElButton, ElDivider, ElForm, ElFormItem, ElInput } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import 'leaflet/dist/leaflet.css';

import { Icon } from '@iconify/vue';
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet';

import { useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, useLocationsActions } from '../../../modules/weather';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE } from '../weather-openweathermap-onecall.constants';
import { useGeolocation, type IGeolocationCity } from '../composables/composables';

import type { IOpenWeatherMapOneCallLocationAddFormProps } from './openweathermap-onecall-location-add-form.types';

defineOptions({
	name: 'OpenWeatherMapOneCallLocationAddForm',
});

const props = withDefaults(defineProps<IOpenWeatherMapOneCallLocationAddFormProps>(), {
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
const { add: addLocation } = useLocationsActions();

const { searchCities, isSearching } = useGeolocation();

const formEl = ref<FormInstance | undefined>(undefined);
const searchQuery = ref('');
const isGettingLocation = ref(false);

// Map state
const zoom = ref<number>(10);
const center = ref<[number, number]>([50.083328, 14.46667]); // Prague
const marker = ref<[number, number] | null>(null);

interface ILocationModel {
	name: string;
	latitude: number | null;
	longitude: number | null;
	countryCode: string;
}

const model = reactive<ILocationModel>({
	name: '',
	latitude: null,
	longitude: null,
	countryCode: '',
});

const rules: FormRules<ILocationModel> = {
	name: [
		{
			required: true,
			message: t('weatherOpenweathermapOnecallPlugin.fields.locations.name.validation.required'),
			trigger: 'blur',
		},
	],
	latitude: [
		{
			validator: (_rule, value, callback) => {
				if (value === null || value === undefined || value === '') {
					callback(new Error(t('weatherOpenweathermapOnecallPlugin.fields.locations.latitude.validation.required')));
				} else if (Number(value) < -90 || Number(value) > 90) {
					callback(new Error(t('weatherOpenweathermapOnecallPlugin.fields.locations.latitude.validation.range')));
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
				if (value === null || value === undefined || value === '') {
					callback(new Error(t('weatherOpenweathermapOnecallPlugin.fields.locations.longitude.validation.required')));
				} else if (Number(value) < -180 || Number(value) > 180) {
					callback(new Error(t('weatherOpenweathermapOnecallPlugin.fields.locations.longitude.validation.range')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
};

interface ISearchSuggestion extends IGeolocationCity {
	value: string;
}

const setMarker = (lat: number, lon: number): void => {
	marker.value = [lat, lon];
	center.value = [lat, lon];
	zoom.value = 18;
};

const onMapClick = (e: { latlng: { lat: number; lng: number } }): void => {
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

const handleCitySearch = (query: string, cb: (suggestions: Record<string, unknown>[]) => void): void => {
	if (!query || query.length < 2) {
		cb([]);
		return;
	}

	searchCities(query).then((results) => {
		const suggestions: ISearchSuggestion[] = results.map((city) => ({
			...city,
			value: `${city.name}${city.state ? `, ${city.state}` : ''}, ${city.country}`,
		}));

		cb(suggestions as unknown as Record<string, unknown>[]);
	});
};

const handleCitySelect = (item: Record<string, unknown>): void => {
	const suggestion = item as unknown as ISearchSuggestion;
	model.name = `${suggestion.name}${suggestion.state ? `, ${suggestion.state}` : ''}, ${suggestion.country}`;
	model.latitude = suggestion.lat;
	model.longitude = suggestion.lon;
	model.countryCode = suggestion.country;
	searchQuery.value = '';

	setMarker(suggestion.lat, suggestion.lon);
};

const getMyLocation = (): void => {
	if (!navigator.geolocation) {
		flashMessage.error(t('weatherOpenweathermapOnecallPlugin.messages.geolocationNotSupported'));
		return;
	}

	isGettingLocation.value = true;

	navigator.geolocation.getCurrentPosition(
		(position) => {
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;

			model.latitude = lat;
			model.longitude = lng;

			setMarker(lat, lng);

			isGettingLocation.value = false;
		},
		(error) => {
			isGettingLocation.value = false;
			switch (error.code) {
				case error.PERMISSION_DENIED:
					flashMessage.error(t('weatherOpenweathermapOnecallPlugin.messages.geolocationDenied'));
					break;
				case error.POSITION_UNAVAILABLE:
					flashMessage.error(t('weatherOpenweathermapOnecallPlugin.messages.geolocationUnavailable'));
					break;
				case error.TIMEOUT:
					flashMessage.error(t('weatherOpenweathermapOnecallPlugin.messages.geolocationTimeout'));
					break;
				default:
					flashMessage.error(t('weatherOpenweathermapOnecallPlugin.messages.geolocationError'));
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
			type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
			latitude: model.latitude !== null ? Number(model.latitude) : undefined,
			longitude: model.longitude !== null ? Number(model.longitude) : undefined,
		};

		if (model.countryCode) {
			locationData.country_code = model.countryCode;
		}

		await addLocation({
			id: props.id,
			draft: false,
			data: locationData,
		});

		flashMessage.success(t('weatherOpenweathermapOnecallPlugin.messages.locations.created', { location: model.name }));
		emit('update:remote-form-result', FormResult.OK);
	} catch {
		flashMessage.error(t('weatherOpenweathermapOnecallPlugin.messages.locations.notCreated', { location: model.name }));
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
	() => model.latitude,
	(): void => {
		if (model.latitude !== null && typeof model.latitude !== 'undefined' && model.longitude !== null && typeof model.longitude !== 'undefined') {
			setMarker(model.latitude, model.longitude);
		}
	}
);

watch(
	() => model.longitude,
	(): void => {
		if (model.latitude !== null && typeof model.latitude !== 'undefined' && model.longitude !== null && typeof model.longitude !== 'undefined') {
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
