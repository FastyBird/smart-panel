<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				:icon="deviceIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesModule.headings.devices.control', { device: device?.name }) }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.devices.control', { device: device?.name }) }}
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

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || device === null"
		:element-loading-text="t('devicesModule.texts.devices.loadingDevice')"
		class="flex flex-col overflow-hidden h-full"
	>
		<device-control-form
			v-if="device !== null && areChannelsLoaded"
			:device-control="deviceControl"
		/>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('devicesModule.buttons.close.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints, useFlashMessage, useUuid } from '../../../common';
import { DeviceControlForm } from '../components/components';
import { useDeviceControl, useDeviceIcon } from '../composables/composables';
import { RouteNames } from '../devices.constants';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IDevice } from '../store/devices.store.types';

import type { IViewDeviceControlProps } from './view-device-control.types';

defineOptions({
	name: 'ViewDeviceControl',
	inheritAttrs: false,
});

const props = defineProps<IViewDeviceControlProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const deviceControl = useDeviceControl({ id: props.id });
const { device, isLoading, areChannelsLoaded, fetchDevice, fetchChannels, fetchProperties } = deviceControl;
const { icon: deviceIcon } = useDeviceIcon({ id: props.id });

// Track if device was previously loaded to detect deletion
const wasDeviceLoaded = ref<boolean>(false);

if (!validateUuid(props.id)) {
	throw new Error('Device identifier is not valid');
}

const isDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.DEVICE;
		}) !== undefined
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [
			{
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: RouteNames.DEVICES }),
			},
		];

		if (isDetailRoute.value) {
			items.push({
				label: t('devicesModule.breadcrumbs.devices.detail', { device: device.value?.name }),
				route: router.resolve({ name: RouteNames.DEVICE, params: { id: props.id } }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.devices.control', { device: device.value?.name }),
				route: router.resolve({ name: RouteNames.DEVICE_CONTROL, params: { id: props.id } }),
			});
		} else {
			items.push({
				label: t('devicesModule.breadcrumbs.devices.control', { device: device.value?.name }),
				route: router.resolve({ name: RouteNames.DEVICE_CONTROL, params: { id: props.id } }),
			});
		}

		return items;
	}
);

const onClose = (): void => {
	if (isDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.DEVICE, params: { id: props.id } });
		} else {
			router.push({ name: RouteNames.DEVICE, params: { id: props.id } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.DEVICES });
		} else {
			router.push({ name: RouteNames.DEVICES });
		}
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchDevice()
		.then(async (): Promise<void> => {
			if (!isLoading.value && device.value === null && !wasDeviceLoaded.value) {
				throw new DevicesException('Device not found');
			}
			// Mark as loaded if device was successfully fetched
			if (device.value !== null) {
				wasDeviceLoaded.value = true;
			}

			// Fetch channels and their properties
			await fetchChannels();
			await fetchProperties();
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			// Handle API 404 errors
			if (err instanceof DevicesApiException && err.code === 404) {
				throw new DevicesException('Device not found');
			}

			// Re-throw DevicesException as-is (e.g., thrown from .then() block)
			if (err instanceof DevicesException) {
				throw err;
			}

			// Wrap unknown errors
			throw new DevicesException('Something went wrong', err);
		});
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if device was never loaded (initial load failed)
		if (!val && device.value === null && !wasDeviceLoaded.value) {
			throw new DevicesException('Device not found');
		}
	}
);

watch(
	(): IDevice | null => device.value,
	(val: IDevice | null): void => {
		if (val !== null) {
			wasDeviceLoaded.value = true;
			meta.title = t('devicesModule.meta.devices.control.title', { device: device.value?.name });
		} else if (wasDeviceLoaded.value && !isLoading.value) {
			// Device was previously loaded but is now null - it was deleted
			flashMessage.warning(t('devicesModule.messages.devices.deletedWhileEditing'), { duration: 0 });
			// Redirect to devices list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.DEVICES });
			} else {
				router.push({ name: RouteNames.DEVICES });
			}
		} else if (!isLoading.value && val === null && !wasDeviceLoaded.value) {
			// Device was never loaded - initial load failed
			throw new DevicesException('Device not found');
		}
	}
);
</script>
