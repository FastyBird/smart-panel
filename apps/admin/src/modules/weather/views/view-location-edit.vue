<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:map-marker"
				class="w[32px] h[32px]"
			/>
		</template>

		<template #title>
			{{ t('weatherModule.headings.editLocation') }}
		</template>

		<template #subtitle>
			{{ location?.name ?? t('weatherModule.subHeadings.editLocation') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="() => (remoteFormChanged ? onDiscard() : onClose())"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSubmit"
	>
		<span class="uppercase">{{ t('weatherModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<template v-if="location">
				<!-- Plugin-provided form component -->
				<component
					:is="locationEditFormComponent"
					v-if="hasPluginForm"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:location="location"
				/>

				<!-- Fallback for unknown providers -->
				<el-alert
					v-else
					:title="t('weatherModule.headings.unsupportedProvider')"
					:description="t('weatherModule.texts.unsupportedProvider', { provider: location.type })"
					:closable="false"
					show-icon
					type="warning"
				/>
			</template>

			<el-skeleton
				v-else-if="isLoading"
				:rows="5"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice && location"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					v-if="remoteFormChanged"
					link
					class="mr-2"
					@click="onDiscard"
				>
					{{ t('weatherModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('weatherModule.buttons.cancel.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult !== FormResult.NONE || !remoteFormChanged"
					type="primary"
					class="order-2"
					@click="onSubmit"
				>
					<template
						v-if="remoteFormResult === FormResult.OK || remoteFormResult === FormResult.ERROR"
						#icon
					>
						<icon
							v-if="remoteFormResult === FormResult.OK"
							icon="mdi:check-circle"
						/>
						<icon
							v-else-if="remoteFormResult === FormResult.ERROR"
							icon="mdi:cross-circle"
						/>
					</template>
					{{ t('weatherModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElIcon, ElMessageBox, ElScrollbar, ElSkeleton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints, useFlashMessage } from '../../../common';
import { useLocation } from '../composables';
import { useWeatherLocationsPlugins } from '../composables/useWeatherLocationsPlugins';
import { FormResult, type FormResultType, RouteNames } from '../weather.constants';
import { WeatherApiException, WeatherException } from '../weather.exceptions';
import type { IWeatherLocation } from '../store/locations.store.types';

import type { IViewLocationEditProps } from './view-location-edit.types';

defineOptions({
	name: 'ViewLocationEdit',
});

const props = defineProps<IViewLocationEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

useMeta({
	title: t('weatherModule.meta.locations.edit.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const isDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.WEATHER_LOCATION;
		}) !== undefined
);

const locationId = computed(() => props.id);
const { location, isLoading, fetchLocation } = useLocation({ id: locationId });

// Track if location was previously loaded to detect deletion vs not found
const wasLocationLoaded = ref<boolean>(false);

const { getElement } = useWeatherLocationsPlugins();

const locationEditFormComponent = computed(() => {
	if (!location.value) return undefined;
	const element = getElement(location.value.type);
	return element?.components?.locationEditForm;
});

const hasPluginForm = computed(() => !!locationEditFormComponent.value);

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items: { label: string; route: RouteLocationResolvedGeneric }[] = [
			{
				label: t('weatherModule.breadcrumbs.locations'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
			},
		];

		if (isDetailRoute.value) {
			items.push({
				label: t('weatherModule.breadcrumbs.locationDetail', { location: location.value?.name }),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } }),
			});
			items.push({
				label: t('weatherModule.breadcrumbs.editLocation'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATION_DETAIL_EDIT, params: { id: props.id } }),
			});
		} else {
			items.push({
				label: t('weatherModule.breadcrumbs.editLocation'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATION_EDIT, params: { id: props.id } }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('weatherModule.messages.confirmDiscard'), t('weatherModule.headings.discard'), {
		confirmButtonText: t('weatherModule.buttons.yes.title'),
		cancelButtonText: t('weatherModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				}
			} else {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.WEATHER_LOCATIONS });
				} else {
					router.push({ name: RouteNames.WEATHER_LOCATIONS });
				}
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
		} else {
			router.push({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.WEATHER_LOCATIONS });
		} else {
			router.push({ name: RouteNames.WEATHER_LOCATIONS });
		}
	}
};

onBeforeMount((): void => {
	fetchLocation()
		.then((): void => {
			// Mark as loaded if location was successfully fetched
			if (location.value !== null) {
				wasLocationLoaded.value = true;
			}
			if (!isLoading.value && location.value === null && !wasLocationLoaded.value) {
				throw new WeatherException('Location not found');
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof WeatherApiException && err.code === 404) {
				throw new WeatherException('Location not found');
			} else if (err instanceof WeatherException) {
				throw err;
			} else {
				throw new WeatherException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				}
			} else {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.WEATHER_LOCATIONS });
				} else {
					router.push({ name: RouteNames.WEATHER_LOCATIONS });
				}
			}
		}
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if location was never loaded (initial load failed)
		if (!val && location.value === null && !wasLocationLoaded.value) {
			throw new WeatherException('Location not found');
		}
	}
);

watch(
	(): IWeatherLocation | null => location.value,
	(val: IWeatherLocation | null): void => {
		if (val !== null) {
			wasLocationLoaded.value = true;
		} else if (wasLocationLoaded.value && !isLoading.value) {
			// Location was previously loaded but is now null - it was deleted
			flashMessage.warning(t('weatherModule.messages.locations.deletedWhileEditing'), { duration: 0 });
			// Redirect to locations list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.WEATHER_LOCATIONS });
			} else {
				router.push({ name: RouteNames.WEATHER_LOCATIONS });
			}
		} else if (!isLoading.value && val === null && !wasLocationLoaded.value) {
			// Location was never loaded - initial load failed
			throw new WeatherException('Location not found');
		}
	}
);
</script>
