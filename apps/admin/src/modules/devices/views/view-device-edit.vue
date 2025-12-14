<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				:icon="deviceIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ device?.name }}
		</template>

		<template
			v-if="device?.description !== null"
			#subtitle
		>
			{{ device?.description }}
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
		<span class="uppercase">{{ t('devicesModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || device === null"
		:element-loading-text="t('devicesModule.texts.devices.loadingDevice')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="device !== null"
			class="grow-1 p-2 md:px-4"
		>
			<component
				:is="element?.components?.deviceEditForm"
				v-if="typeof element?.components?.deviceEditForm !== 'undefined'"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:device="device"
			/>

			<device-edit-form
				v-else
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:device="device"
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
					{{ t('devicesModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('devicesModule.buttons.close.title') }}
				</el-button>

				<div
					:id="SUBMIT_FORM_SM"
					class="order-2 inline-block [&>*:first-child:not(:only-child)]:hidden"
				>
					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="isLoading || remoteFormResult !== FormResult.NONE"
						type="primary"
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
						{{ t('devicesModule.buttons.save.title') }}
					</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	type IPlugin,
	type IPluginElement,
	SUBMIT_FORM_SM,
	useBreakpoints,
	useUuid,
} from '../../../common';
import { DeviceEditForm } from '../components/components';
import { useDevice, useDeviceIcon, useDevicesPlugins } from '../composables/composables';
import { FormResult, type FormResultType, RouteNames } from '../devices.constants';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IDevicePluginsComponents, IDevicePluginsSchemas } from '../devices.types';
import type { IDevice } from '../store/devices.store.types';

import type { IViewDeviceEditProps } from './view-device-edit.types';

defineOptions({
	name: 'ViewDeviceEdit',
});

const props = defineProps<IViewDeviceEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { device, isLoading, fetchDevice } = useDevice({ id: props.id });
const { icon: deviceIcon } = useDeviceIcon({ id: props.id });

if (!validateUuid(props.id)) {
	throw new Error('Device identifier is not valid');
}

const { plugins } = useDevicesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const isDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.DEVICE;
		}) !== undefined
);

const plugin = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === device.value?.type));
});

const element = computed<IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === device.value?.type);
});

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
				label: t('devicesModule.breadcrumbs.devices.edit', { device: device.value?.name }),
				route: router.resolve({ name: RouteNames.DEVICE_EDIT, params: { id: props.id } }),
			});
		} else {
			items.push({
				label: t('devicesModule.breadcrumbs.devices.edit', { device: device.value?.name }),
				route: router.resolve({ name: RouteNames.DEVICES_EDIT, params: { id: props.id } }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
		confirmButtonText: t('devicesModule.buttons.yes.title'),
		cancelButtonText: t('devicesModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
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
		.then((): void => {
			if (!isLoading.value && device.value === null) {
				throw new DevicesException('Device not found');
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof DevicesApiException && err.code === 404) {
				throw new DevicesException('Device not found');
			} else {
				throw new DevicesException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && device.value === null) {
			throw new DevicesException('Device not found');
		}
	}
);

watch(
	(): IDevice | null => device.value,
	(val: IDevice | null): void => {
		if (val !== null) {
			meta.title = t('devicesModule.meta.devices.edit.title', { device: device.value?.name });
		}

		if (!isLoading.value && val === null) {
			throw new DevicesException('Device not found');
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
