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
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElAutocomplete, ElButton, ElDivider, ElForm, ElFormItem, ElInput, type InputInstance } from 'element-plus';
import { Icon } from '@iconify/vue';
import 'leaflet/dist/leaflet.css';
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet';

import { type ILocationModel, useLocationMap } from '../../../plugins/weather-open-meteo/composables/useLocationMap';
import { useAppOnboarding } from '../composables/composables';

defineOptions({
	name: 'StepLocation',
});

const { t } = useI18n();
const { locationData } = useAppOnboarding();

const longitudeInputEl = ref<InputInstance | undefined>(undefined);

// Bridge onboarding locationData to the ILocationModel interface used by useLocationMap
const locationModel: ILocationModel = reactive({
	get name() {
		return locationData.city || '';
	},
	set name(value: string) {
		locationData.city = value;
	},
	get latitude() {
		return locationData.latitude;
	},
	set latitude(value: number | null) {
		locationData.latitude = value;
	},
	get longitude() {
		return locationData.longitude;
	},
	set longitude(value: number | null) {
		locationData.longitude = value;
	},
	countryCode: '',
});

const {
	searchQuery,
	isSearching,
	isGettingLocation,
	zoom,
	center,
	marker,
	onMapClick,
	onMarkerMoveEnd,
	handleCitySearch,
	handleCitySelect,
	getMyLocation,
} = useLocationMap(locationModel);

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

const onCitySelect = (item: Record<string, unknown>): void => {
	handleCitySelect(item);

	// useLocationMap sets model.name to the full formatted name,
	// but onboarding only needs the short city name for locationData.city
	const suggestion = item as unknown as { name: string };
	locationData.city = suggestion.name;
};

const onMapClickClearCity = (e: { latlng: { lat: number; lng: number } }): void => {
	locationData.city = '';
	onMapClick(e);
};

const onMarkerMoveEndClearCity = (e: { target: { getLatLng: () => { lat: number; lng: number } } }): void => {
	locationData.city = '';
	onMarkerMoveEnd(e);
};

const getMyLocationClearCity = (): void => {
	getMyLocation(() => {
		locationData.city = '';
	});
};
</script>
