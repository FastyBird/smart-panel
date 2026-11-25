<template>
	<view-header
		:title="t('weatherModule.headings.editLocation')"
		:subtitle="location?.name ?? t('weatherModule.subHeadings.editLocation')"
		icon="mdi:map-marker"
		left="close"
		:primary="{ label: t('weatherModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
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

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-if="location !== null"
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="remoteFormChanged && remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElAlert, ElMessageBox, ElScrollbar, ElSkeleton } from 'element-plus';

import { AppBreadcrumbs, FormFooter, ViewHeader, useBreakpoints, useEditDrawer, useFlashMessage, useSizeClass } from '../../../common';
import { useLocation } from '../composables';
import { useWeatherLocationsPlugins } from '../composables/useWeatherLocationsPlugins';
import type { IWeatherLocation } from '../store/locations.store.types';
import { FormResult, type FormResultType, RouteNames } from '../weather.constants';
import { WeatherApiException, WeatherException } from '../weather.exceptions';

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

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

// The location detail page still opens this form in its own drawer only on large screens, and as a page below that,
// whatever the template 4 size classes say: leaving goes back the way the detail page came in, so Back still reaches the
// list. Part 2 of AR-21 moves the detail page onto the edit drawer and drops this
const { isLGDevice } = useBreakpoints();

const detailInDrawer = computed<boolean>((): boolean => isLGDevice.value);

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

// The editor asks before a changed form is left; a confirmed discard, a save or a deleted record lets it go
const releaseForm = (): void => {
	remoteFormChanged.value = false;

	emit('update:remote-form-changed', false);
};

const onDiscard = (): void => {
	ElMessageBox.confirm(t('weatherModule.messages.confirmDiscard'), t('weatherModule.headings.discard'), {
		confirmButtonText: t('weatherModule.buttons.discard.title'),
		cancelButtonText: t('weatherModule.buttons.keepEditing.title'),
		type: 'warning',
	})
		.then((): void => {
			releaseForm();

			if (isDetailRoute.value) {
				if (detailInDrawer.value) {
					router.replace({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				}
			} else {
				if (inDrawer.value) {
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
		if (detailInDrawer.value) {
			router.replace({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
		} else {
			router.push({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
		}
	} else {
		if (inDrawer.value) {
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
			releaseForm();

			if (isDetailRoute.value) {
				if (detailInDrawer.value) {
					router.replace({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.WEATHER_LOCATION, params: { id: props.id } });
				}
			} else {
				if (inDrawer.value) {
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
			releaseForm();

			flashMessage.warning(t('weatherModule.messages.locations.deletedWhileEditing'), { duration: 0 });
			// Redirect to locations list
			if (inDrawer.value) {
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
