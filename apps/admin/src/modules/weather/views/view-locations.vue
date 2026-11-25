<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isLocationsListRoute || inDrawer"
		:title="t('weatherModule.headings.locations')"
		:subtitle="t('weatherModule.subHeadings.locations')"
		icon="mdi:map-marker-multiple"
		:actions="phoneActions"
	>
		<template #actions>
			<el-button
				type="primary"
				data-test-id="add-location"
				@click="onLocationCreate"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>

				{{ t('weatherModule.buttons.addLocation.title') }}
			</el-button>
		</template>
	</view-header>

	<div
		v-if="isLocationsListRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: add and edit open next to the list from tablet portrait up, as their own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<list-locations
				ref="list"
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
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
			/>

			<template #form>
				<view-error :key="formKey">
					<template #icon>
						<icon icon="mdi:map-marker" />
					</template>
					<template #message>
						{{ t('weatherModule.messages.requestError') }}
					</template>

					<!-- Keyed by the location: switching to another location remounts the editor, so its save goes to the
					     location now shown and not to the one opened first -->
					<suspense>
						<router-view
							:key="formKey"
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
		</edit-drawer-layout>
	</div>

	<router-view
		v-else
		:key="formKey"
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

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { type AppBarAction, AppBreadcrumbs, EditDrawerLayout, ViewError, ViewHeader, provideEditDrawer } from '../../../common';
import { useConfigModule } from '../../config';
import ListLocations from '../components/list-locations.vue';
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

defineProps<IViewLocationsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('weatherModule.meta.locations.list.title'),
});

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

const list = ref<InstanceType<typeof ListLocations> | null>(null);

const remoteFormChanged = ref<boolean>(false);

const isLocationsListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.WEATHER_LOCATIONS;
});

const isFormRoute = (): boolean =>
	route.matched.some((matched) => matched.name === RouteNames.WEATHER_LOCATION_ADD || matched.name === RouteNames.WEATHER_LOCATION_EDIT);

const showDrawer = ref<boolean>(isFormRoute());

// Template 4: add and edit open next to this page from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isLocationsListRoute.value);

// One form per location (and one for Add, keyed by the provider picked): a new key remounts the routed form
const formKey = computed<string>((): string => {
	const id = typeof route.params?.id === 'string' ? route.params.id : '';
	const provider = typeof route.query?.provider === 'string' ? route.query.provider : '';

	return `${String(route.name)}:${id}:${provider}`;
});

// The changed flag belongs to the form that is open. Any route change that replaces or closes it clears the flag
// before the next form mounts, so that one starts clean. A declined discard leaves the route, and the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
});

// The phone app bar: Search and Add
const phoneActions = computed<AppBarAction[]>((): AppBarAction[] => [
	{ icon: 'mdi:magnify', label: t('weatherModule.fields.locations.search.placeholder'), handler: onSearch },
	{ icon: 'mdi:plus', label: t('weatherModule.buttons.addLocation.title'), handler: onLocationCreate },
]);

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

const navigate = (to: { name: string; params?: Record<string, string> }): void => {
	if (inDrawer.value) {
		router.replace(to);
	} else {
		router.push(to);
	}
};

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

	navigate({ name: RouteNames.WEATHER_LOCATIONS });

	done?.();
};

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => !showDrawer.value || !remoteFormChanged.value || confirmDiscard();

const onLocationDetail = async (id: IWeatherLocation['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	router.push({ name: RouteNames.WEATHER_LOCATION, params: { id } });
};

const onLocationEdit = async (id: IWeatherLocation['id']): Promise<void> => {
	if ((route.name === RouteNames.WEATHER_LOCATION_EDIT && route.params.id === id) || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.WEATHER_LOCATION_EDIT, params: { id } });
};

const onLocationCreate = async (): Promise<void> => {
	if (route.name === RouteNames.WEATHER_LOCATION_ADD || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.WEATHER_LOCATION_ADD });
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

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
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
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = isFormRoute();
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
		const hasNewLocationsWithoutWeather = newLocations.some((location) => !location.draft && !(location.id in weatherByLocation.value));

		if (hasNewLocationsWithoutWeather) {
			fetchLocationsWeather().catch((error: unknown): void => {
				console.warn('[WEATHER] Failed to re-fetch locations weather:', error);
			});
		}
	},
	{ deep: true }
);
</script>
