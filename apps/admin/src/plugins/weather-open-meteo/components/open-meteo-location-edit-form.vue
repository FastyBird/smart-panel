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
			:label="t('weatherOpenMeteoPlugin.fields.locations.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('weatherOpenMeteoPlugin.fields.locations.name.placeholder')"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherOpenMeteoPlugin.fields.locations.name.description') }}
			</div>
		</el-form-item>

		<!-- City Search with My Location button -->
		<el-form-item :label="t('weatherOpenMeteoPlugin.fields.locations.citySearch.title')">
			<div class="flex flex-row items-center gap-2 w-full">
				<el-autocomplete
					v-model="searchQuery"
					:fetch-suggestions="handleCitySearch"
					:placeholder="t('weatherOpenMeteoPlugin.fields.locations.citySearch.placeholder')"
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
					{{ t('weatherOpenMeteoPlugin.buttons.myLocation.title') }}
				</el-button>
			</div>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherOpenMeteoPlugin.fields.locations.citySearch.description') }}
			</div>
		</el-form-item>

		<el-divider content-position="left" class="mt-6!">{{ t('weatherOpenMeteoPlugin.texts.orEnterManually') }}</el-divider>

		<!-- Latitude/Longitude fields -->
		<div class="flex flex-row items-start gap-4">
			<el-form-item
				:label="t('weatherOpenMeteoPlugin.fields.locations.latitude.title')"
				prop="latitude"
				class="flex-1"
			>
				<el-input
					v-model="model.latitude"
					:placeholder="t('weatherOpenMeteoPlugin.fields.locations.latitude.placeholder')"
					name="latitude"
					type="number"
					step="0.0001"
				/>
			</el-form-item>
			<el-form-item
				:label="t('weatherOpenMeteoPlugin.fields.locations.longitude.title')"
				prop="longitude"
				class="flex-1"
			>
				<el-input
					v-model="model.longitude"
					:placeholder="t('weatherOpenMeteoPlugin.fields.locations.longitude.placeholder')"
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
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAutocomplete, ElButton, ElDivider, ElForm, ElFormItem, ElInput } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import 'leaflet/dist/leaflet.css';

import { Icon } from '@iconify/vue';
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet';

import { useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, useLocationsActions } from '../../../modules/weather';
import { WEATHER_OPEN_METEO_PLUGIN_TYPE } from '../weather-open-meteo.constants';
import { useLocationMap, type ILocationModel } from '../composables/composables';

import type { IOpenMeteoLocationEditFormProps } from './open-meteo-location-edit-form.types';

defineOptions({
	name: 'OpenMeteoLocationEditForm',
});

const props = withDefaults(defineProps<IOpenMeteoLocationEditFormProps>(), {
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
const { edit: editLocation } = useLocationsActions();

const formEl = ref<FormInstance | undefined>(undefined);

// Initialize model from props.location
const getInitialModel = (): ILocationModel => {
	const location = props.location as Record<string, unknown>;

	return {
		name: (location.name as string) || '',
		latitude: (location.latitude as number) ?? null,
		longitude: (location.longitude as number) ?? null,
		countryCode: (location.countryCode as string) || '',
	};
};

const model = reactive<ILocationModel>(getInitialModel());

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
} = useLocationMap(model);

const rules: FormRules<ILocationModel> = {
	name: [
		{
			required: true,
			message: t('weatherOpenMeteoPlugin.fields.locations.name.validation.required'),
			trigger: 'blur',
		},
	],
	latitude: [
		{
			validator: (_rule, value, callback) => {
				if (value === null || value === undefined || value === '') {
					callback(new Error(t('weatherOpenMeteoPlugin.fields.locations.latitude.validation.required')));
				} else if (isNaN(Number(value)) || Number(value) < -90 || Number(value) > 90) {
					callback(new Error(t('weatherOpenMeteoPlugin.fields.locations.latitude.validation.range')));
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
					callback(new Error(t('weatherOpenMeteoPlugin.fields.locations.longitude.validation.required')));
				} else if (isNaN(Number(value)) || Number(value) < -180 || Number(value) > 180) {
					callback(new Error(t('weatherOpenMeteoPlugin.fields.locations.longitude.validation.range')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
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
		const locationData: { type: string; name?: string } & Record<string, unknown> = {
			type: WEATHER_OPEN_METEO_PLUGIN_TYPE,
			name: model.name,
			latitude: model.latitude !== null ? Number(model.latitude) : undefined,
			longitude: model.longitude !== null ? Number(model.longitude) : undefined,
		};

		if (model.countryCode) {
			locationData.country_code = model.countryCode;
		}

		await editLocation({
			id: props.location.id,
			data: locationData,
		});

		flashMessage.success(t('weatherOpenMeteoPlugin.messages.locations.edited', { location: model.name }));
		emit('update:remote-form-result', FormResult.OK);
	} catch {
		flashMessage.error(t('weatherOpenMeteoPlugin.messages.locations.notEdited', { location: model.name }));
		emit('update:remote-form-result', FormResult.ERROR);

		setTimeout(() => {
			emit('update:remote-form-result', FormResult.NONE);
		}, 2000);
	}
};

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
			Object.assign(model, getInitialModel());
			formEl.value?.clearValidate();
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
