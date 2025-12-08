<template>
	<el-form
		ref="formEl"
		:model="model"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('configModule.fields.locationType.title')"
			prop="locationType"
		>
			<el-select
				v-model="model.locationType"
				:placeholder="t('configModule.fields.locationType.placeholder')"
				name="locationType"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in locationTypeOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<el-button
				class="ml-2 px-5!"
				@click="onUseMyLocation"
			>
				<template #icon>
					<icon icon="mdi:map-marker-account-outline" />
				</template>
				{{ t('configModule.buttons.myLocation.title') }}
			</el-button>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === ConfigModuleWeatherLatLonLocationType.lat_lon"
			:label="t('configModule.fields.coordinates.title')"
			prop="latitude"
		>
			<div class="flex flex-row">
				<el-input
					v-model="model.latitude"
					:placeholder="t('configModule.fields.latitude.placeholder')"
					name="latitude"
				/>

				<el-input
					v-model="model.longitude"
					:placeholder="t('configModule.fields.longitude.placeholder')"
					name="longitude"
					class="ml-2"
				/>
			</div>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === ConfigModuleWeatherCityNameLocationType.city_name"
			:label="t('configModule.fields.cityName.title')"
			prop="cityName"
		>
			<el-select
				v-model="geolocationSearch"
				filterable
				remote
				reserve-keyword
				:placeholder="t('configModule.fields.cityName.placeholder')"
				:remote-method="onGeolocateLocation"
				:loading="geolocationLoading"
				name="cityName"
			>
				<el-option
					v-for="item in geolocationOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === ConfigModuleWeatherCityIdLocationType.city_id"
			:label="t('configModule.fields.cityId.title')"
			prop="cityId"
		>
			<el-select-v2
				v-model="model.cityId"
				:options="cityIdOptions"
				:placeholder="t('configModule.fields.cityId.placeholder')"
				:filter-method="filterCityId"
				size="large"
				clearable
				filterable
			>
				<template #label="{ label, state, country }">
					<div class="flex flex-row items-center gap-2">{{ label }} {{ state }} {{ country }}</div>
				</template>

				<template #default="{ item }">
					<div class="flex flex-row items-center gap-2">{{ item.label }}</div>
				</template>
			</el-select-v2>
		</el-form-item>

		<el-form-item
			v-if="model.locationType === ConfigModuleWeatherZipCodeLocationType.zip_code"
			:label="t('configModule.fields.zipCode.title')"
			prop="zipCode"
		>
			<el-select
				v-model="geolocationSearch"
				filterable
				remote
				reserve-keyword
				:placeholder="t('configModule.fields.zipCode.placeholder')"
				:remote-method="onGeolocateLocation"
				:loading="geolocationLoading"
				name="zipCode"
			>
				<el-option
					v-for="item in geolocationOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.unit.title')"
			prop="unit"
		>
			<el-select
				v-model="model.unit"
				:placeholder="t('configModule.fields.unit.placeholder')"
				name="unit"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in unitOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.openWeatherApiKey.title')"
			prop="openWeatherApiKey"
		>
			<el-input
				v-model="model.openWeatherApiKey"
				:placeholder="t('configModule.fields.openWeatherApiKey.placeholder')"
				name="openWeatherApiKey"
			/>
		</el-form-item>
	</el-form>

	<div style="height: 50vh; width: 100%">
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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSelectV2 } from 'element-plus';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import 'leaflet/dist/leaflet.css';

import { Icon } from '@iconify/vue';
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet';

import { useBackend, useFlashMessage, useLogger } from '../../../common';
import type {
	WeatherModuleGeolocationCitySchema,
	WeatherModuleGeolocationZipSchema,
} from '../../../openapi.constants';
import {
	ConfigModuleWeatherCityIdLocationType,
	ConfigModuleWeatherCityNameLocationType,
	ConfigModuleWeatherLatLonLocationType,
	ConfigModuleWeatherZipCodeLocationType,
} from '../../../openapi.constants';
import { type City, cities } from '../../../spec/openweather-cities';
import { useConfigWeatherEditForm } from '../composables/composables';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { IConfigWeatherFormProps } from './config-weather-form.types';

type CityGeolocation = WeatherModuleGeolocationCitySchema;
type ZipGeolocation = WeatherModuleGeolocationZipSchema;

type CityOption = {
	value: City['id'];
	label: string;
	state: City['state'];
	country: City['country'];
	coord: City['coord'];
};

type GroupOption = {
	value: string;
	label: string;
	options: CityOption[];
};

interface GeolocationOption {
	value: string;
	label: string;
	state?: string;
	country: string;
	coord: { lon: number; lat: number };
}

countries.registerLocale(enLocale);

defineOptions({
	name: 'ConfigWeatherForm',
});

const props = withDefaults(defineProps<IConfigWeatherFormProps>(), {
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

const { locationTypeOptions, unitOptions, model, formEl, formChanged, submit, formResult } = useConfigWeatherEditForm({ config: props.config });

const backend = useBackend();
const logger = useLogger();

const zoom = ref<number>(10);

const center = ref<[number, number]>([50.083328, 14.46667]); // Prague
const marker = ref<[number, number] | null>(null);

const filterCityIdBy = ref<string>('');

const geolocationSearch = ref<string>('');
const geolocationLoading = ref<boolean>(false);
const geolocationOptions = ref<GeolocationOption[]>([]);

const cityIdOptions = computed<GroupOption[]>((): GroupOption[] => {
	const q = (filterCityIdBy.value || '').trim().toLowerCase();

	const items = (q ? cities.filter((c) => c.name.toLowerCase().includes(q)) : cities).filter((city) => city.country !== '');

	// Group by country
	const byCountry = new Map<string, CityOption[]>();

	for (const city of items) {
		const label = city.state && city.state.trim().length > 0 ? `${city.name} — ${city.state}` : city.name;

		const opt: CityOption = {
			value: city.id,
			label,
			state: city.state,
			country: city.country,
			coord: city.coord,
		};

		if (!byCountry.has(city.country)) {
			byCountry.set(city.country, []);
		}

		byCountry.get(city.country)!.push(opt);
	}

	// Build groups (sorted by country name; cities sorted by label)
	return Array.from(byCountry.entries())
		.filter(([, list]) => list.length > 0)
		.map(([cc, list]) => ({
			value: cc,
			label: countries.getName(cc, 'en') || cc,
			options: list.sort((a, b) => a.label.localeCompare(b.label)),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
});

const filterCityId = (query: string): void => {
	filterCityIdBy.value = query;
};

const onMapClick = (e: { latlng: { lat: number; lng: number } }): void => {
	if (model.locationType !== ConfigModuleWeatherLatLonLocationType.lat_lon) {
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

			model.locationType = ConfigModuleWeatherLatLonLocationType.lat_lon;

			setMarker(lat, lng);
		},
		(err) => {
			flashMessage.error('Unable to retrieve your location.');

			logger.error(err as unknown as Error);
		}
	);
};

const onGeolocateLocation = async (query: string): Promise<void> => {
	if (query) {
		geolocationLoading.value = true;
		geolocationOptions.value = [];

		if (model.locationType === ConfigModuleWeatherCityNameLocationType.city_name) {
			const cityLocations = await fetchCityNameCoordinates(query);

			for (const city of cityLocations) {
				geolocationOptions.value.push({
					value: `${city.name}${city.state ? ',' + city.state : ''},${city.country}`,
					label: `${city.name}${city.state ? ' — ' + city.state : ''}, ${city.country}`,
					state: city.state && city.state !== '' ? city.state : undefined,
					country: city.country,
					coord: {
						lon: city.lon,
						lat: city.lat,
					},
				});
			}
		} else if (model.locationType === ConfigModuleWeatherZipCodeLocationType.zip_code) {
			const zipLocation = await fetchZipCodeCoordinates(query);

			if (zipLocation !== null) {
				geolocationOptions.value.push({
					value: `${zipLocation.zip},${zipLocation.country}`,
					label: `${zipLocation.name}, ${zipLocation.country}`,
					country: zipLocation.country,
					coord: {
						lon: zipLocation.lon,
						lat: zipLocation.lat,
					},
				});
			}
		}

		geolocationLoading.value = false;
	} else {
		geolocationLoading.value = false;
		geolocationOptions.value = [];
	}
};

const setMarker = (lat: number, lon: number): void => {
	marker.value = [lat, lon];
	center.value = [lat, lon];

	if (model.locationType === ConfigModuleWeatherLatLonLocationType.lat_lon) {
		zoom.value = 18;
	} else {
		zoom.value = 13;
	}
};

const fetchCityNameCoordinates = async (query: string): Promise<CityGeolocation[]> => {
	try {
		const apiResponse = await backend.client.GET(`/weather-module/geolocation/city-to-coordinates`, {
			params: {
				query: {
					city: query,
				},
			},
		});

		if (!apiResponse) {
			return [];
		}

		const { data: responseData } = apiResponse;

		return typeof responseData !== 'undefined' && Array.isArray(responseData.data) ? responseData.data : [];
	} catch (error) {
		logger.error(error as unknown as Error);

		return [];
	}
};

const fetchZipCodeCoordinates = async (query: string): Promise<ZipGeolocation | null> => {
	try {
		const apiResponse = await backend.client.GET(`/weather-module/geolocation/zip-to-coordinates`, {
			params: {
				query: {
					zip: query,
				},
			},
		});

		if (!apiResponse) {
			return null;
		}

		const { data: responseData } = apiResponse;

		return typeof responseData !== 'undefined' && responseData.data ? responseData.data : null;
	} catch (error) {
		logger.error(error as unknown as Error);

		return null;
	}
};

onBeforeMount(async (): Promise<void> => {
	if (model.latitude && model.longitude) {
		setMarker(model.latitude, model.longitude);
	}

	if (model.locationType === ConfigModuleWeatherCityNameLocationType.city_name) {
		if (model.cityName === null) {
			return;
		}

		const cityLocations = await fetchCityNameCoordinates(model.cityName);

		for (const city of cityLocations) {
			geolocationOptions.value.push({
				value: `${city.name}${city.state ? ',' + city.state : ''},${city.country}`,
				label: `${city.name}${city.state ? ' — ' + city.state : ''}, ${city.country}`,
				state: city.state && city.state !== '' ? city.state : undefined,
				country: city.country,
				coord: {
					lon: city.lon,
					lat: city.lat,
				},
			});
		}

		const usedCity = cityLocations.find((city) => city.lat === model.latitude && city.lon === model.longitude);

		if (usedCity) {
			geolocationSearch.value = `${usedCity.name}${usedCity.state ? ',' + usedCity.state : ''},${usedCity.country}`;
		}
	} else if (model.locationType === ConfigModuleWeatherCityIdLocationType.city_id) {
		if (model.cityId === null) {
			return;
		}

		const city = cities.find((city: City) => city.id === model.cityId);

		if (city != null) {
			setMarker(city.coord.lat, city.coord.lon);
		}
	} else if (model.locationType === ConfigModuleWeatherZipCodeLocationType.zip_code) {
		if (model.zipCode === null) {
			return;
		}

		const zipLocation = await fetchZipCodeCoordinates(model.zipCode);

		if (zipLocation !== null) {
			geolocationOptions.value.push({
				value: `${zipLocation.zip},${zipLocation.country}`,
				label: `${zipLocation.name}, ${zipLocation.country}`,
				country: zipLocation.country,
				coord: {
					lon: zipLocation.lon,
					lat: zipLocation.lat,
				},
			});

			geolocationSearch.value = `${zipLocation.zip},${zipLocation.country}`;
		}
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

watch(
	(): number | null => model.cityId,
	(val: number | null): void => {
		if (val == null) return;

		const city = cities.find((city: City) => city.id === val);

		if (city != null) {
			setMarker(city.coord.lat, city.coord.lon);
		}
	}
);

watch(
	(): string => geolocationSearch.value,
	(val: string): void => {
		if (val === '') return;

		const option = geolocationOptions.value.find((item: GeolocationOption) => item.value === val);

		if (option != null) {
			setMarker(option.coord.lat, option.coord.lon);

			if (model.locationType === ConfigModuleWeatherCityNameLocationType.city_name) {
				model.cityName = val;
			} else if (model.locationType === ConfigModuleWeatherZipCodeLocationType.zip_code) {
				model.zipCode = val;
			}

			model.latitude = option.coord.lat;
			model.longitude = option.coord.lon;
		}
	}
);
</script>
