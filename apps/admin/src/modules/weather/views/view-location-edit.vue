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

			<el-empty
				v-else
				:description="t('weatherModule.messages.locations.notFound')"
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
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElEmpty, ElIcon, ElMessageBox, ElScrollbar, ElSkeleton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints } from '../../../common';
import { useLocation } from '../composables';
import { useWeatherLocationsPlugins } from '../composables/useWeatherLocationsPlugins';
import { FormResult, type FormResultType, RouteNames } from '../weather.constants';

import type { IViewLocationEditProps } from './view-location-edit.types';

defineOptions({
	name: 'ViewLocationEdit',
});

const props = defineProps<IViewLocationEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('weatherModule.meta.locations.edit.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const locationId = computed(() => props.id);
const { location, isLoading } = useLocation({ id: locationId });

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
		return [
			{
				label: t('weatherModule.breadcrumbs.locations'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
			},
			{
				label: location.value?.name ?? t('weatherModule.breadcrumbs.editLocation'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATION_EDIT, params: { id: props.id } }),
			},
		];
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('weatherModule.messages.confirmDiscard'), t('weatherModule.headings.discard'), {
		confirmButtonText: t('weatherModule.buttons.yes.title'),
		cancelButtonText: t('weatherModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.WEATHER_LOCATIONS });
			} else {
				router.push({ name: RouteNames.WEATHER_LOCATIONS });
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
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.WEATHER_LOCATIONS });
	} else {
		router.push({ name: RouteNames.WEATHER_LOCATIONS });
	}
};

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.WEATHER_LOCATIONS });
			} else {
				router.push({ name: RouteNames.WEATHER_LOCATIONS });
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
</script>
