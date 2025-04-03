<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isDevicesListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:power-plug"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesModule.headings.devices.list') }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.devices.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isDevicesListRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onDeviceCreate"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('devicesModule.headings.devices.list')"
		:sub-heading="t('devicesModule.subHeadings.devices.list')"
		icon="mdi:power-plug"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					@click="onDeviceCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('devicesModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<el-scrollbar
		v-if="isDevicesListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2"
	>
		<list-devices
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="devicesPaginated"
			:all-items="devices"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			class="mb-2"
			@detail="onDeviceDetail"
			@edit="onDeviceEdit"
			@remove="onDeviceRemove"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
		/>
	</el-scrollbar>

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
				<list-devices-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:power-plug" />
					</template>
					<template #message>
						{{ t('devicesModule.messages.misc.requestError') }}
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

import { ElButton, ElDrawer, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { ListDevices, ListDevicesAdjust } from '../components';
import { useDevicesActions, useDevicesDataSource } from '../composables';
import { RouteNames } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import type { IDevice } from '../store';

import type { IViewDevicesProps } from './view-devices.types';

defineOptions({
	name: 'ViewDevices',
});

const props = defineProps<IViewDevicesProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('devicesModule.meta.devices.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	fetchDevices,
	devices,
	devicesPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
} = useDevicesDataSource();
const deviceActions = useDevicesActions();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isDevicesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DEVICES;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: RouteNames.DEVICES }),
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
			ElMessageBox.confirm(t('devicesModule.messages.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
				confirmButtonText: t('devicesModule.buttons.yes.title'),
				cancelButtonText: t('devicesModule.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.DEVICES,
						});
					} else {
						router.push({
							name: RouteNames.DEVICES,
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
					name: RouteNames.DEVICES,
				});
			} else {
				router.push({
					name: RouteNames.DEVICES,
				});
			}

			done?.();
		}
	}
};

const onDeviceDetail = (id: IDevice['id']): void => {
	router.push({
		name: RouteNames.DEVICE,
		params: {
			id,
		},
	});
};

const onDeviceEdit = (id: IDevice['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICES_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DEVICES_EDIT,
			params: {
				id,
			},
		});
	}
};

const onDeviceRemove = (id: IDevice['id']): void => {
	deviceActions.remove(id);
};

const onResetFilters = (): void => {
	resetFilter();
};

const onDeviceCreate = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DEVICES_ADD,
		});
	} else {
		router.push({
			name: RouteNames.DEVICES_ADD,
		});
	}
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchDevices().catch((error: unknown): void => {
		const err = error as Error;

		throw new DevicesException('Something went wrong', err);
	});

	showDrawer.value =
		route.matched.find((matched) => matched.name === RouteNames.DEVICES_ADD || matched.name === RouteNames.DEVICES_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.DEVICES_ADD || matched.name === RouteNames.DEVICES_EDIT) !== undefined;
	}
);
</script>
