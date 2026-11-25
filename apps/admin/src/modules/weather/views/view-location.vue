<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isLocationRoute || inDrawer"
		:title="location?.name ?? t('weatherModule.meta.locations.detail.title')"
		:subtitle="t('weatherModule.subHeadings.locationDetail', { location: location?.name ?? '' })"
		icon="mdi:map-marker"
		:actions="location ? [{ icon: 'mdi:pencil', label: t('weatherModule.buttons.edit.title'), handler: onEdit }] : []"
		@back="onBack"
	>
		<template #actions>
			<el-tooltip
				v-if="location"
				:content="t('weatherModule.buttons.edit.title')"
				placement="top"
			>
				<el-button
					:aria-label="t('weatherModule.aria.edit', { location: location.name })"
					plain
					data-test-id="location-edit"
					@click="onEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</el-tooltip>
		</template>
	</view-header>

	<div
		v-if="isLocationRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: edit opens next to the detail from tablet portrait up, as its own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<!-- Template 3: the summary card, then a card per part of the weather; the page scrolls as one -->
			<div
				v-if="location"
				class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto [&>*]:shrink-0"
			>
				<location-summary
					:location="location"
					:primary="location.id === primaryLocationId"
					:provider-name="providerName"
				/>

				<state-view
					v-if="isWeatherLoading && !weather"
					kind="loading"
					icon="mdi:weather-partly-cloudy"
					:title="t('weatherModule.texts.misc.loadingWeather')"
				/>

				<!-- The location stays editable when its weather does not load: a wrong place or key is fixed in Edit -->
				<state-view
					v-else-if="hasWeatherError || !weather"
					kind="error"
					icon="mdi:weather-cloudy-alert"
					:title="t('weatherModule.texts.weatherError')"
					:description="t('weatherModule.texts.weatherErrorDescription')"
				>
					<template #action>
						<el-button
							plain
							data-test-id="location-weather-retry"
							@click="onRetry"
						>
							{{ t('weatherModule.buttons.retry.title') }}
						</el-button>
					</template>
				</state-view>

				<div
					v-else
					class="grid grid-cols-1 tl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 items-start"
				>
					<el-card
						shadow="never"
						body-class="flex flex-col gap-3 p-4!"
						data-test-id="location-current-card"
					>
						<span class="text-card-title">{{ t('weatherModule.headings.weather') }}</span>

						<location-detail :current="weather.current" />
					</el-card>

					<div class="flex flex-col gap-4 min-w-0">
						<el-card
							v-if="weather.hourlyForecast && weather.hourlyForecast.length > 0"
							shadow="never"
							body-class="flex flex-col gap-3 p-4!"
							data-test-id="location-hourly-card"
						>
							<span class="text-card-title">{{ t('weatherModule.headings.hourlyForecast') }}</span>

							<location-hourly-forecast
								:hourly-forecast="weather.hourlyForecast"
								:sunrise="weather.current?.sunrise"
								:sunset="weather.current?.sunset"
							/>
						</el-card>

						<el-card
							shadow="never"
							body-class="flex flex-col gap-3 p-4!"
							data-test-id="location-forecast-card"
						>
							<span class="text-card-title">{{ t('weatherModule.headings.forecast') }}</span>

							<location-forecast :forecast="weather.forecast" />
						</el-card>
					</div>
				</div>
			</div>

			<state-view
				v-else-if="isLocationLoading"
				kind="loading"
				icon="mdi:map-marker"
				:title="t('weatherModule.texts.misc.loadingLocation')"
			/>

			<state-view
				v-else
				kind="not-found"
				icon="mdi:map-marker"
				:title="t('weatherModule.messages.locations.notFound')"
			>
				<template #action>
					<el-button
						plain
						@click="onBack"
					>
						{{ t('weatherModule.buttons.back.title') }}
					</el-button>
				</template>
			</state-view>

			<template #form>
				<view-error>
					<template #icon>
						<icon icon="mdi:map-marker" />
					</template>
					<template #message>
						{{ t('weatherModule.messages.requestError') }}
					</template>

					<suspense>
						<router-view v-slot="{ Component }">
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</edit-drawer-layout>
	</div>

	<!-- Phone: the edit form is its own page -->
	<router-view
		v-else
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElMessageBox, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, StateView, ViewError, ViewHeader, provideEditDrawer } from '../../../common';
import { useConfigModule } from '../../config';
import LocationDetail from '../components/location-detail.vue';
import LocationForecast from '../components/location-forecast.vue';
import LocationHourlyForecast from '../components/location-hourly-forecast.vue';
import LocationSummary from '../components/location-summary.vue';
import { useLocation } from '../composables/useLocation';
import { useLocationWeather } from '../composables/useLocationWeather';
import { useWeatherLocationsPlugins } from '../composables/useWeatherLocationsPlugins';
import { RouteNames, WEATHER_MODULE_NAME } from '../weather.constants';

import type { IViewLocationProps } from './view-location.types';

defineOptions({
	name: 'ViewLocation',
});

const props = defineProps<IViewLocationProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const { meta } = useMeta({
	title: t('weatherModule.meta.locations.detail.title'),
});

const locationId = computed(() => props.id);

const { location, isLoading: isLocationLoading, fetchLocation } = useLocation({ id: locationId });
const { weather, isLoading: isWeatherLoading, hasError: hasWeatherError, fetchLocationWeather } = useLocationWeather();
const { configModule: weatherConfig } = useConfigModule({ type: WEATHER_MODULE_NAME });
const { options: providerOptions } = useWeatherLocationsPlugins();

const remoteFormChanged = ref<boolean>(false);

const isLocationRoute = computed<boolean>((): boolean => route.name === RouteNames.WEATHER_LOCATION);

const showDrawer = computed<boolean>((): boolean => route.name === RouteNames.WEATHER_LOCATION_DETAIL_EDIT);

// Template 4: the edit form opens next to the detail from tablet portrait up, as its own page on phone
const { inDrawer } = provideEditDrawer((): boolean => showDrawer.value);

const primaryLocationId = computed<string | null>((): string | null => {
	const config = weatherConfig.value as { primaryLocationId?: string | null } | null;

	return config?.primaryLocationId ?? null;
});

const providerName = computed<string>((): string => {
	const type = location.value?.type ?? '';

	return providerOptions.value.find((option) => option.value === type)?.label ?? type;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('weatherModule.breadcrumbs.locations'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
			},
			{
				label: t('weatherModule.breadcrumbs.locationDetail', { location: location.value?.name }),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } }),
			},
		];
	}
);

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('weatherModule.messages.confirmDiscard'), t('weatherModule.headings.discard'), {
			confirmButtonText: t('weatherModule.buttons.discard.title'),
			cancelButtonText: t('weatherModule.buttons.keepEditing.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const onCloseDrawer = async (done?: () => void): Promise<void> => {
	if (remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	router.replace({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });

	done?.();
};

const onEdit = (): void => {
	if (showDrawer.value) {
		return;
	}

	const to = { name: RouteNames.WEATHER_LOCATION_DETAIL_EDIT, params: { id: props.id } };

	if (inDrawer.value) {
		router.replace(to);
	} else {
		router.push(to);
	}
};

const onBack = async (): Promise<void> => {
	if (showDrawer.value && remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	router.push({ name: RouteNames.WEATHER_LOCATIONS });
};

const onRetry = async (): Promise<void> => {
	await fetchLocationWeather(props.id).catch(() => {
		// The error state shows it
	});
};

const load = async (id: string): Promise<void> => {
	await fetchLocation().catch(() => {
		// The not-found state shows it
	});

	await fetchLocationWeather(id).catch(() => {
		// The error state shows it
	});
};

onBeforeMount((): void => {
	void load(props.id);
});

// Another location on the same route (the breadcrumb or a link): load its record and its weather
watch(
	(): string => props.id,
	(newId: string, oldId: string): void => {
		if (newId !== oldId) {
			void load(newId);
		}
	}
);

watch(
	(): string | undefined => location.value?.name,
	(name: string | undefined): void => {
		meta.title = name ?? t('weatherModule.meta.locations.detail.title');
	},
	{ immediate: true }
);

// The changed flag belongs to the form that is open; closing it clears the flag
watch(showDrawer, (open: boolean): void => {
	if (!open) {
		remoteFormChanged.value = false;
	}
});
</script>
