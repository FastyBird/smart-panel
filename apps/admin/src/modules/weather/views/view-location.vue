<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isLocationRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:map-marker"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('weatherModule.headings.locationDetail', { location: location?.name }) }}
		</template>

		<template #subtitle>
			{{ t('weatherModule.subHeadings.locationDetail', { location: location?.name }) }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onClose"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice && isLocationRoute && location"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onEdit"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:pencil" />
			</el-icon>
		</template>
	</app-bar-button>

	<view-header
		:heading="t('weatherModule.headings.locationDetail', { location: location?.name })"
		:sub-heading="t('weatherModule.subHeadings.locationDetail', { location: location?.name })"
		icon="mdi:map-marker"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					v-if="location"
					plain
					class="px-4! ml-2!"
					@click="onEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</div>
		</template>
	</view-header>

	<!-- Loading state -->
	<div
		v-if="isLocationLoading || isWeatherLoading"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-card class="mt-2">
			<el-skeleton
				:rows="5"
				animated
			/>
		</el-card>
	</div>

	<!-- Error state - weather failed to load -->
	<div
		v-else-if="hasWeatherError || !weather"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-card
			class="mt-2"
			body-class="flex flex-row justify-center"
		>
			<el-result class="h-full max-w-[700px]">
				<template #icon>
					<icon-with-child :size="80">
						<template #primary>
							<icon icon="mdi:weather-cloudy" />
						</template>
						<template #secondary>
							<icon icon="mdi:alert-circle" />
						</template>
					</icon-with-child>
				</template>

				<template #title>
					{{ t('weatherModule.texts.weatherError') }}
				</template>

				<template #sub-title>
					{{ t('weatherModule.texts.weatherErrorDescription') }}
				</template>

				<template #extra>
					<el-button
						type="primary"
						@click="onRetry"
					>
						{{ t('weatherModule.buttons.retry.title') }}
					</el-button>
				</template>
			</el-result>
		</el-card>
	</div>

	<!-- Success state - show weather data -->
	<el-scrollbar
		v-else-if="(isLocationRoute || isLGDevice) && location && weather"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-card
			class="mt-2"
			body-class="p-0!"
		>
			<location-detail
				:location="location"
				:current="weather.current"
			/>
		</el-card>

		<el-card class="mt-4 mb-2">
			<template #header>
				<div class="flex items-center">
					<el-icon :size="20">
						<icon icon="mdi:calendar-week" />
					</el-icon>
					<span class="ml-2 font-medium">{{ t('weatherModule.headings.forecast') }}</span>
				</div>
			</template>

			<location-forecast :forecast="weather.forecast" />
		</el-card>
	</el-scrollbar>

	<!-- Router view for small devices when not on main route -->
	<router-view
		v-else-if="location && weather"
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<!-- Location not found -->
	<div
		v-else
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-card
			class="mt-2"
			body-class="flex flex-row justify-center"
		>
			<el-result class="h-full max-w-[700px]">
				<template #icon>
					<icon-with-child :size="80">
						<template #primary>
							<icon icon="mdi:map-marker" />
						</template>
						<template #secondary>
							<icon icon="mdi:help" />
						</template>
					</icon-with-child>
				</template>

				<template #title>
					{{ t('weatherModule.messages.locations.notFound') }}
				</template>

				<template #extra>
					<el-button
						type="primary"
						@click="onClose"
					>
						{{ t('weatherModule.buttons.back.title') }}
					</el-button>
				</template>
			</el-result>
		</el-card>
	</div>

	<!-- Drawer for large devices -->
	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="'40%'"
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
				<view-error>
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

import { ElButton, ElCard, ElDrawer, ElIcon, ElMessageBox, ElResult, ElScrollbar, ElSkeleton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, IconWithChild, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import LocationDetail from '../components/location-detail.vue';
import LocationForecast from '../components/location-forecast.vue';
import { useLocation } from '../composables/useLocation';
import { useLocationWeather } from '../composables/useLocationWeather';
import { RouteNames } from '../weather.constants';

import type { IViewLocationProps } from './view-location.types';

defineOptions({
	name: 'ViewLocation',
});

const props = defineProps<IViewLocationProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('weatherModule.meta.locations.detail.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const locationId = computed(() => props.id);

const { location, isLoading: isLocationLoading, fetchLocation } = useLocation({ id: locationId });
const { weather, isLoading: isWeatherLoading, hasError: hasWeatherError, fetchLocationWeather } = useLocationWeather();

const mounted = ref<boolean>(false);
const showDrawer = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const isLocationRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.WEATHER_LOCATION;
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

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('weatherModule.messages.confirmDiscard'), t('weatherModule.headings.discard'), {
			confirmButtonText: t('weatherModule.buttons.yes.title'),
			cancelButtonText: t('weatherModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.WEATHER_LOCATION,
						params: { id: props.id },
					});
				} else {
					router.push({
						name: RouteNames.WEATHER_LOCATION,
						params: { id: props.id },
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
				name: RouteNames.WEATHER_LOCATION,
				params: { id: props.id },
			});
		} else {
			router.push({
				name: RouteNames.WEATHER_LOCATION,
				params: { id: props.id },
			});
		}

		done?.();
	}
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.WEATHER_LOCATIONS });
	} else {
		router.push({ name: RouteNames.WEATHER_LOCATIONS });
	}
};

const onEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.WEATHER_LOCATION_DETAIL_EDIT,
			params: { id: props.id },
		});
	} else {
		router.push({
			name: RouteNames.WEATHER_LOCATION_DETAIL_EDIT,
			params: { id: props.id },
		});
	}
};

const onRetry = async (): Promise<void> => {
	await fetchLocationWeather(props.id);
};

onBeforeMount(async (): Promise<void> => {
	await fetchLocation();
	await fetchLocationWeather(props.id).catch(() => {
		// Error is handled by hasError state in useLocationWeather
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.WEATHER_LOCATION_DETAIL_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.WEATHER_LOCATION_DETAIL_EDIT) !== undefined;
	}
);
</script>
