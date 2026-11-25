<template>
	<view-header
		:title="t('weatherModule.headings.addLocation')"
		:subtitle="t('weatherModule.subHeadings.addLocation')"
		icon="mdi:map-marker-plus"
		left="close"
		:primary="selectedProvider ? { label: t('weatherModule.buttons.save.title'), handler: onSubmit } : undefined"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
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

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="selectedProvider !== undefined && remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, ViewHeader, useEditDrawer, useSizeClass, useUuid } from '../../../common';
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

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

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

			if (inDrawer.value) {
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
	if (inDrawer.value) {
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
			releaseForm();

			if (inDrawer.value) {
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
