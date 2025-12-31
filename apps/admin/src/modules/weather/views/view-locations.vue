<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isLocationsListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:map-marker-multiple"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('weatherModule.headings.locations') }}
		</template>

		<template #subtitle>
			{{ t('weatherModule.subHeadings.locations') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isLocationsListRoute"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('application.buttons.home.title') }}</span>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice && isLocationsListRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onLocationCreate"
	>
		<span class="uppercase">{{ t('weatherModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('weatherModule.headings.locations')"
		:sub-heading="t('weatherModule.subHeadings.locations')"
		:icon="'mdi:map-marker-multiple'"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onLocationCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('weatherModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isLocationsListRoute || isLGDevice"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<list-locations
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="locationsPaginated"
			:all-items="locations"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			:primary-location-id="primaryLocationId"
			:weather-by-location="weatherByLocation"
			:weather-fetch-completed="weatherFetchCompleted"
			:temperature-unit="temperatureUnit"
			@detail="onLocationDetail"
			@edit="onLocationEdit"
			@remove="onLocationRemove"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
			@bulk-action="onBulkAction"
		/>
	</div>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="adjustList ? '300px' : '40%'"
		:with-header="false"
		:before-close="onCloseDrawer"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseDrawer()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<template v-if="showDrawer">
				<list-locations-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:map-marker" />
					</template>
					<template #message>
						{{ t('weatherModule.messages.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="props.id"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { useConfigModule } from '../../config';
import ListLocations from '../components/list-locations.vue';
import ListLocationsAdjust from '../components/list-locations-adjust.vue';
import { useLocationsActions } from '../composables/useLocationsActions';
import { useLocationsDataSource } from '../composables/useLocationsDataSource';
import { useLocationsWeather } from '../composables/useLocationsWeather';
import type { IWeatherLocation } from '../store/locations.store.types';
import { RouteNames, WEATHER_MODULE_NAME } from '../weather.constants';
import { WeatherException } from '../weather.exceptions';

import type { IViewLocationsProps } from './view-locations.types';

defineOptions({
	name: 'ViewLocations',
});

const props = defineProps<IViewLocationsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('weatherModule.meta.locations.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	fetchLocations,
	locations,
	locationsPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
	primaryLocationId,
} = useLocationsDataSource();
const locationActions = useLocationsActions();
const { weatherByLocation, fetchCompleted: weatherFetchCompleted, fetchLocationsWeather } = useLocationsWeather();
const { configModule: weatherConfig } = useConfigModule({ type: WEATHER_MODULE_NAME });

const temperatureUnit = computed<'celsius' | 'fahrenheit'>((): 'celsius' | 'fahrenheit' => {
	const config = weatherConfig.value as { unit?: string } | null;
	return config?.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
});

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isLocationsListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.WEATHER_LOCATIONS;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('weatherModule.breadcrumbs.locations'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	if (adjustList.value) {
		showDrawer.value = false;
		adjustList.value = false;

		done?.();
	} else {
		if (remoteFormChanged.value) {
			ElMessageBox.confirm(t('weatherModule.messages.confirmDiscard'), t('weatherModule.headings.discard'), {
				confirmButtonText: t('weatherModule.buttons.yes.title'),
				cancelButtonText: t('weatherModule.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.WEATHER_LOCATIONS,
						});
					} else {
						router.push({
							name: RouteNames.WEATHER_LOCATIONS,
						});
					}

					done?.();
				})
				.catch((): void => {
					// Just ignore it
				});
		} else {
			if (isLGDevice.value) {
				router.replace({
					name: RouteNames.WEATHER_LOCATIONS,
				});
			} else {
				router.push({
					name: RouteNames.WEATHER_LOCATIONS,
				});
			}

			done?.();
		}
	}
};

const onLocationDetail = (id: IWeatherLocation['id']): void => {
	router.push({
		name: RouteNames.WEATHER_LOCATION,
		params: {
			id,
		},
	});
};

const onLocationEdit = (id: IWeatherLocation['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.WEATHER_LOCATION_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.WEATHER_LOCATION_EDIT,
			params: {
				id,
			},
		});
	}
};

const onLocationCreate = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.WEATHER_LOCATION_ADD,
		});
	} else {
		router.push({
			name: RouteNames.WEATHER_LOCATION_ADD,
		});
	}
};

const onLocationRemove = (id: IWeatherLocation['id']): void => {
	locationActions.remove(id);
};

const onBulkAction = (action: string, items: IWeatherLocation[]): void => {
	switch (action) {
		case 'delete':
			locationActions.bulkRemove(items);
			break;
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchLocations().catch((error: unknown): void => {
		const err = error as Error;

		throw new WeatherException('Something went wrong', err);
	});

	fetchLocationsWeather().catch((error: unknown): void => {
		// Silently fail - weather data is optional for the list
		console.warn('[WEATHER] Failed to fetch locations weather:', error);
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.WEATHER_LOCATION_ADD || matched.name === RouteNames.WEATHER_LOCATION_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.WEATHER_LOCATION_ADD || matched.name === RouteNames.WEATHER_LOCATION_EDIT) !== undefined;
	}
);

// Watch for new locations and re-fetch weather data when locations without weather are detected
watch(
	locations,
	(newLocations): void => {
		if (!weatherFetchCompleted.value || newLocations.length === 0) {
			return;
		}

		// Check if any location doesn't have weather data yet
		const hasNewLocationsWithoutWeather = newLocations.some(
			(location) => !location.draft && !(location.id in weatherByLocation.value)
		);

		if (hasNewLocationsWithoutWeather) {
			fetchLocationsWeather().catch((error: unknown): void => {
				console.warn('[WEATHER] Failed to re-fetch locations weather:', error);
			});
		}
	},
	{ deep: true }
);
</script>
