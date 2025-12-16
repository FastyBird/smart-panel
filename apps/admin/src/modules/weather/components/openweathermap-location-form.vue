<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		@submit.prevent="onSubmit"
	>
		<!-- City Search Autocomplete -->
		<el-form-item
			:label="t('weatherModule.fields.locations.citySearch.title')"
		>
			<el-autocomplete
				v-model="searchQuery"
				:fetch-suggestions="handleCitySearch"
				:placeholder="t('weatherModule.fields.locations.citySearch.placeholder')"
				:loading="isSearching"
				:debounce="500"
				clearable
				class="w-full"
				@select="handleCitySelect"
			>
				<template #default="{ item }">
					<div class="flex flex-col py-1">
						<span class="font-medium">{{ item.name }}</span>
						<span class="text-xs text-gray-500">
							{{ item.state ? `${item.state}, ` : '' }}{{ item.country }}
							<span class="ml-2 text-gray-400">
								({{ item.lat.toFixed(4) }}, {{ item.lon.toFixed(4) }})
							</span>
						</span>
					</div>
				</template>
			</el-autocomplete>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherModule.fields.locations.citySearch.description') }}
			</div>
		</el-form-item>

		<el-divider>{{ t('weatherModule.texts.orEnterManually') }}</el-divider>

		<!-- Location Name -->
		<el-form-item
			:label="t('weatherModule.fields.locations.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('weatherModule.fields.locations.name.placeholder')"
			/>
		</el-form-item>

		<!-- Location Type -->
		<el-form-item
			:label="t('weatherModule.fields.locations.locationType.title')"
			prop="locationType"
		>
			<el-select
				v-model="model.locationType"
				:placeholder="t('weatherModule.fields.locations.locationType.placeholder')"
				class="w-full"
			>
				<el-option
					value="lat_lon"
					:label="t('weatherModule.fields.locations.locationType.values.latLon')"
				/>
				<el-option
					value="city_name"
					:label="t('weatherModule.fields.locations.locationType.values.cityName')"
				/>
			</el-select>
		</el-form-item>

		<!-- Latitude/Longitude fields (when lat_lon type) -->
		<template v-if="model.locationType === 'lat_lon'">
			<div class="grid grid-cols-2 gap-4">
				<el-form-item
					:label="t('weatherModule.fields.locations.latitude.title')"
					prop="latitude"
				>
					<el-input-number
						v-model="model.latitude"
						:placeholder="t('weatherModule.fields.locations.latitude.placeholder')"
						:min="-90"
						:max="90"
						:precision="6"
						:step="0.0001"
						controls-position="right"
						class="w-full"
					/>
				</el-form-item>
				<el-form-item
					:label="t('weatherModule.fields.locations.longitude.title')"
					prop="longitude"
				>
					<el-input-number
						v-model="model.longitude"
						:placeholder="t('weatherModule.fields.locations.longitude.placeholder')"
						:min="-180"
						:max="180"
						:precision="6"
						:step="0.0001"
						controls-position="right"
						class="w-full"
					/>
				</el-form-item>
			</div>
		</template>

		<!-- City Name fields (when city_name type) -->
		<template v-if="model.locationType === 'city_name'">
			<div class="grid grid-cols-2 gap-4">
				<el-form-item
					:label="t('weatherModule.fields.locations.cityName.title')"
					prop="cityName"
				>
					<el-input
						v-model="model.cityName"
						:placeholder="t('weatherModule.fields.locations.cityName.placeholder')"
					/>
				</el-form-item>
				<el-form-item
					:label="t('weatherModule.fields.locations.countryCode.title')"
					prop="countryCode"
				>
					<el-input
						v-model="model.countryCode"
						:placeholder="t('weatherModule.fields.locations.countryCode.placeholder')"
						maxlength="2"
					/>
				</el-form-item>
			</div>
		</template>

		<div class="flex justify-end gap-2 mt-4">
			<el-button @click="$emit('cancel')">
				{{ t('weatherModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="primary"
				native-type="submit"
				:loading="isSubmitting"
			>
				{{ t('weatherModule.buttons.save.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAutocomplete, ElButton, ElDivider, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import { useFlashMessage, injectStoresManager } from '../../../common';
import { useGeolocation, type IGeolocationCity } from '../composables/useGeolocation';
import { weatherLocationsStoreKey } from '../store/keys';
import type { IWeatherLocation } from '../store/locations.store.types';

defineOptions({
	name: 'OpenWeatherMapLocationForm',
});

interface IOpenWeatherMapLocationFormProps {
	id: IWeatherLocation['id'];
}

const props = defineProps<IOpenWeatherMapLocationFormProps>();

const emit = defineEmits<{
	(e: 'cancel'): void;
	(e: 'added'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

const { searchCities, isSearching } = useGeolocation();

const formEl = ref<FormInstance | undefined>(undefined);
const isSubmitting = ref(false);
const searchQuery = ref('');

interface ILocationModel {
	name: string;
	locationType: 'lat_lon' | 'city_name';
	latitude: number | null;
	longitude: number | null;
	cityName: string;
	countryCode: string;
}

const model = reactive<ILocationModel>({
	name: '',
	locationType: 'lat_lon',
	latitude: null,
	longitude: null,
	cityName: '',
	countryCode: '',
});

const rules: FormRules<ILocationModel> = {
	name: [
		{
			required: true,
			message: t('weatherModule.fields.locations.name.validation.required'),
			trigger: 'blur',
		},
	],
	locationType: [
		{
			required: true,
			message: t('weatherModule.fields.locations.locationType.validation.required'),
			trigger: 'change',
		},
	],
	latitude: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'lat_lon' && (value === null || value === undefined)) {
					callback(new Error(t('weatherModule.fields.locations.latitude.validation.required')));
				} else {
					callback();
				}
			},
			trigger: 'blur',
		},
	],
	longitude: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'lat_lon' && (value === null || value === undefined)) {
					callback(new Error(t('weatherModule.fields.locations.longitude.validation.required')));
				} else {
					callback();
				}
			},
			trigger: 'blur',
		},
	],
	cityName: [
		{
			validator: (_rule, value, callback) => {
				if (model.locationType === 'city_name' && !value) {
					callback(new Error(t('weatherModule.fields.locations.cityName.validation.required')));
				} else {
					callback();
				}
			},
			trigger: 'blur',
		},
	],
};

interface ISearchSuggestion extends IGeolocationCity {
	value: string;
}

const handleCitySearch = async (query: string, cb: (suggestions: ISearchSuggestion[]) => void): Promise<void> => {
	if (!query || query.length < 2) {
		cb([]);
		return;
	}

	const results = await searchCities(query);
	const suggestions: ISearchSuggestion[] = results.map((city) => ({
		...city,
		value: `${city.name}${city.state ? `, ${city.state}` : ''}, ${city.country}`,
	}));

	cb(suggestions);
};

const handleCitySelect = (item: ISearchSuggestion): void => {
	// Auto-fill the form with selected city data
	model.name = `${item.name}${item.state ? `, ${item.state}` : ''}, ${item.country}`;
	model.locationType = 'lat_lon';
	model.latitude = item.lat;
	model.longitude = item.lon;
	model.cityName = item.name;
	model.countryCode = item.country;

	// Clear search query
	searchQuery.value = '';
};

const onSubmit = async (): Promise<void> => {
	if (!formEl.value) return;

	const valid = await formEl.value.validate().catch(() => false);
	if (!valid) return;

	isSubmitting.value = true;

	try {
		const locationData: Record<string, unknown> = {
			name: model.name,
			type: 'weather-openweathermap',
			location_type: model.locationType,
		};

		if (model.locationType === 'lat_lon') {
			locationData.latitude = model.latitude;
			locationData.longitude = model.longitude;
		} else if (model.locationType === 'city_name') {
			locationData.city_name = model.cityName;
			locationData.country_code = model.countryCode || undefined;
		}

		await locationsStore.add({
			id: props.id,
			draft: false,
			data: locationData,
		});

		flashMessage.success(t('weatherModule.messages.locations.created', { location: model.name }));
		emit('added');
	} catch {
		flashMessage.error(t('weatherModule.messages.locations.notCreated', { location: model.name }));
	} finally {
		isSubmitting.value = false;
	}
};
</script>
