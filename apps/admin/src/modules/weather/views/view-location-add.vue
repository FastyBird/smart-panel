<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:map-marker-plus"
				class="w[32px] h[32px]"
			/>
		</template>

		<template #title>
			{{ t('weatherModule.headings.addLocation') }}
		</template>

		<template #subtitle>
			{{ t('weatherModule.subHeadings.addLocation') }}
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
		v-if="!isMDDevice && selectedProvider"
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
			<select-location-provider v-model="selectedProvider" />

			<el-divider v-if="selectedProvider" />

			<template v-if="selectedProvider">
				<!-- Plugin-provided form component -->
				<component
					:is="locationAddFormComponent"
					v-if="hasPluginForm"
					:id="newLocationId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedProvider"
				/>

				<!-- Fallback for unknown providers -->
				<el-alert
					v-else
					:title="t('weatherModule.headings.unsupportedProvider')"
					:description="t('weatherModule.texts.unsupportedProvider', { provider: selectedProvider })"
					:closable="false"
					show-icon
					type="warning"
				/>
			</template>

			<el-alert
				v-else
				:title="t('weatherModule.headings.selectProvider')"
				:description="t('weatherModule.texts.selectProvider')"
				:closable="false"
				show-icon
				type="info"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
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
					:disabled="remoteFormResult !== FormResult.NONE || !selectedProvider"
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

import { ElAlert, ElButton, ElDivider, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints, useUuid } from '../../../common';
import SelectLocationProvider from '../components/select-location-provider.vue';
import { useWeatherLocationsPlugins } from '../composables/useWeatherLocationsPlugins';
import { FormResult, type FormResultType, RouteNames } from '../weather.constants';

import type { IViewLocationAddProps } from './view-location-add.types';

defineOptions({
	name: 'ViewLocationAdd',
});

defineProps<IViewLocationAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('weatherModule.meta.locations.add.title'),
});

const { generate: uuidGenerate } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const newLocationId = uuidGenerate();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const selectedProvider = ref<string | undefined>(undefined);

const { getElement } = useWeatherLocationsPlugins();

const locationAddFormComponent = computed(() => {
	if (!selectedProvider.value) return undefined;
	const element = getElement(selectedProvider.value);
	return element?.components?.locationAddForm;
});

const hasPluginForm = computed(() => !!locationAddFormComponent.value);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('weatherModule.breadcrumbs.locations'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
			},
			{
				label: t('weatherModule.breadcrumbs.addLocation'),
				route: router.resolve({ name: RouteNames.WEATHER_LOCATION_ADD }),
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
