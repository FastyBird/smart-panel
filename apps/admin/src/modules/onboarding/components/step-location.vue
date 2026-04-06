<template>
	<div class="py-4 px-4 max-w-lg mx-auto">
		<el-alert
			type="info"
			:title="t('onboardingModule.location.description')"
			:closable="false"
			show-icon
			class="mb-4!"
		/>

		<!-- City Search with My Location button -->
		<el-form
			label-position="top"
			@submit.prevent
		>
			<el-form-item :label="t('onboardingModule.location.fields.citySearch')">
				<div class="flex flex-row items-center gap-2 w-full">
					<el-autocomplete
						v-model="searchQuery"
						:fetch-suggestions="handleCitySearch"
						:placeholder="t('onboardingModule.location.placeholders.citySearch')"
						:loading="isSearching"
						:debounce="500"
						clearable
						class="flex-1"
						@select="onCitySelect"
					>
						<template #default="{ item }">
							<div class="flex flex-col py-1">
								<span class="font-medium">{{ item.name }}</span>
								<span class="text-xs text-gray-500">
									{{ item.state ? `${item.state}, ` : '' }}{{ item.country }}
									<span class="ml-2 text-gray-400">({{ item.lat.toFixed(4) }}, {{ item.lon.toFixed(4) }})</span>
								</span>
							</div>
						</template>
					</el-autocomplete>
					<el-button
						:loading="isGettingLocation"
						class="px-2!"
						@click="getMyLocationClearCity"
					>
						<template #icon>
							<icon icon="mdi:map-marker-account-outline" />
						</template>
						{{ t('onboardingModule.location.buttons.myLocation') }}
					</el-button>
				</div>
			</el-form-item>

			<el-divider content-position="left">{{ t('onboardingModule.location.orEnterManually') }}</el-divider>

			<div class="flex flex-row flex-nowrap gap-5">
				<el-form-item
					:label="t('onboardingModule.location.fields.latitude')"
					class="flex-1"
				>
					<el-input
						v-model="latitudeModel"
						:placeholder="t('onboardingModule.location.placeholders.latitude')"
						name="latitude"
						type="number"
						step="0.0001"
						@keyup.enter="longitudeInputEl?.focus()"
					/>
				</el-form-item>
				<el-form-item
					:label="t('onboardingModule.location.fields.longitude')"
					class="flex-1"
				>
					<el-input
						ref="longitudeInputEl"
						v-model="longitudeModel"
						:placeholder="t('onboardingModule.location.placeholders.longitude')"
						name="longitude"
						type="number"
						step="0.0001"
					/>
				</el-form-item>
			</div>
		</el-form>

		<!-- Map -->
		<div style="height: 30vh; width: 100%">
			<l-map
				v-model:zoom="zoom"
				:use-global-leaflet="false"
				:center="center"
				@click="onMapClickClearCity"
			>
				<l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
				<l-marker
					v-if="marker"
					:lat-lng="marker"
					:draggable="true"
					@moveend="onMarkerMoveEndClearCity"
				/>
			</l-map>
		</div>

		<el-alert
			type="info"
			:title="t('onboardingModule.location.hint')"
			:closable="false"
			show-icon
			class="mt-4!"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElAutocomplete, ElButton, ElDivider, ElForm, ElFormItem, ElInput, type InputInstance } from 'element-plus';
import { Icon } from '@iconify/vue';
import 'leaflet/dist/leaflet.css';
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet';

import { useFlashMessage } from '../../../common';
import { type IGeolocationCity, useGeolocation } from '../../../plugins/weather-open-meteo/composables/useGeolocation';
import { useAppOnboarding } from '../composables/composables';

defineOptions({
	name: 'StepLocation',
});

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { locationData } = useAppOnboarding();
const { searchCities, isSearching } = useGeolocation();

const longitudeInputEl = ref<InputInstance | undefined>(undefined);
const searchQuery = ref('');
const isGettingLocation = ref(false);

// Map state
const zoom = ref<number>(10);
const center = ref<[number, number]>([50.083328, 14.46667]); // Prague
const marker = ref<[number, number] | null>(null);

const isValidCoordinate = (value: unknown): value is number => {
	if (value === null || value === undefined || value === '') {
		return false;
	}

	const num = Number(value);

	return !isNaN(num) && isFinite(num);
};

const setMarker = (lat: number, lon: number, setZoom?: number): void => {
	marker.value = [lat, lon];
	center.value = [lat, lon];

	if (setZoom !== undefined) {
		zoom.value = setZoom;
	}
};

const latitudeModel = computed({
	get: () => (locationData.latitude !== null ? String(locationData.latitude) : ''),
	set: (val: string) => {
		locationData.city = '';
		if (val === '') {
			locationData.latitude = null;
			return;
		}
		const num = Number(val);
		locationData.latitude = isNaN(num) ? null : num;
	},
});

const longitudeModel = computed({
	get: () => (locationData.longitude !== null ? String(locationData.longitude) : ''),
	set: (val: string) => {
		locationData.city = '';
		if (val === '') {
			locationData.longitude = null;
			return;
		}
		const num = Number(val);
		locationData.longitude = isNaN(num) ? null : num;
	},
});

interface ISearchSuggestion extends IGeolocationCity {
	value: string;
}

const handleCitySearch = (query: string, cb: (suggestions: Record<string, unknown>[]) => void): void => {
	if (!query || query.length < 2) {
		cb([]);
		return;
	}

	searchCities(query)
		.then((results) => {
			const suggestions: ISearchSuggestion[] = results.map((city) => ({
				...city,
				value: `${city.name}${city.state ? `, ${city.state}` : ''}, ${city.country}`,
			}));

			cb(suggestions as unknown as Record<string, unknown>[]);
		})
		.catch(() => {
			cb([]);
		});
};

const onCitySelect = (item: Record<string, unknown>): void => {
	const suggestion = item as unknown as ISearchSuggestion;

	locationData.city = suggestion.name;
	locationData.latitude = suggestion.lat;
	locationData.longitude = suggestion.lon;
	searchQuery.value = '';

	setMarker(suggestion.lat, suggestion.lon, 12);
};

const onMapClickClearCity = (e: { latlng: { lat: number; lng: number } }): void => {
	const { lat, lng } = e.latlng;

	locationData.city = '';
	locationData.latitude = lat;
	locationData.longitude = lng;
	marker.value = [lat, lng];
};

const onMarkerMoveEndClearCity = (e: { target: { getLatLng: () => { lat: number; lng: number } } }): void => {
	const { lat, lng } = e.target.getLatLng();

	locationData.city = '';
	locationData.latitude = lat;
	locationData.longitude = lng;
	marker.value = [lat, lng];
};

const getMyLocationClearCity = (): void => {
	if (!navigator.geolocation) {
		flashMessage.error(t('onboardingModule.location.messages.geolocationNotSupported'));
		return;
	}

	isGettingLocation.value = true;

	navigator.geolocation.getCurrentPosition(
		(position) => {
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;

			locationData.city = '';
			locationData.latitude = lat;
			locationData.longitude = lng;

			setMarker(lat, lng, 12);

			isGettingLocation.value = false;
		},
		(error) => {
			isGettingLocation.value = false;
			switch (error.code) {
				case error.PERMISSION_DENIED:
					flashMessage.error(t('onboardingModule.location.messages.geolocationDenied'));
					break;
				case error.POSITION_UNAVAILABLE:
					flashMessage.error(t('onboardingModule.location.messages.geolocationUnavailable'));
					break;
				case error.TIMEOUT:
					flashMessage.error(t('onboardingModule.location.messages.geolocationTimeout'));
					break;
				default:
					flashMessage.error(t('onboardingModule.location.messages.geolocationError'));
			}
		},
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0,
		}
	);
};

onBeforeMount((): void => {
	if (isValidCoordinate(locationData.latitude) && isValidCoordinate(locationData.longitude)) {
		setMarker(Number(locationData.latitude), Number(locationData.longitude), 18);
	}
});

watch(
	() => [locationData.latitude, locationData.longitude] as const,
	([lat, lon]): void => {
		if (isValidCoordinate(lat) && isValidCoordinate(lon)) {
			const latNum = Number(lat);
			const lonNum = Number(lon);

			marker.value = [latNum, lonNum];
			center.value = [latNum, lonNum];
		}
	}
);
</script>
