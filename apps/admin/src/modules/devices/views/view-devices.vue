<template>
	<app-breadcrumbs
		v-if="!isWizardRoute"
		:items="breadcrumbs"
	/>

	<app-bar-heading
		v-if="!isMDDevice && isDevicesListRoute && !isWizardRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:devices"
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
		v-if="!isMDDevice && isDevicesListRoute && !isWizardRoute"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('application.buttons.home.title') }}</span>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice && isDevicesListRoute && !isWizardRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onDeviceCreate"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		v-if="!isWizardRoute"
		:heading="t('devicesModule.headings.devices.list')"
		:sub-heading="t('devicesModule.subHeadings.devices.list')"
		icon="mdi:devices"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					v-if="enabledWizardOptions.length > 0"
					class="px-4!"
					@click="onWizard"
				>
					<el-icon class="mr-1"><icon icon="mdi:wizard-hat" /></el-icon>
					{{ t('devicesModule.buttons.wizard.title') }}
				</el-button>
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
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

	<div
		v-if="(isDevicesListRoute || isLGDevice) && !isWizardRoute"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
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
			@detail="onDeviceDetail"
			@edit="onDeviceEdit"
			@remove="onDeviceRemove"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
			@bulk-action="onBulkAction"
		/>
	</div>

	<router-view
		v-if="isWizardRoute || (!isDevicesListRoute && !isLGDevice)"
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
				<list-devices-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:devices" />
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

	<el-dialog
		v-model="wizardPluginDialogVisible"
		:title="t('devicesModule.headings.devices.selectWizardPlugin')"
		width="520px"
	>
		<div class="flex flex-col gap-2">
			<el-card
				v-for="item in wizardOptions"
				:key="item.value"
				shadow="hover"
				class="devices-wizard-plugin-card"
				:class="{ 'devices-wizard-plugin-card--disabled': item.disabled }"
				body-class="p-4!"
				@click="!item.disabled && onStartWizard(item.value)"
			>
				<div class="flex items-start gap-3">
					<div class="devices-wizard-plugin-card__icon">
						<icon icon="mdi:puzzle-outline" />
					</div>
					<div class="flex-1 min-w-0 devices-wizard-plugin-card__content">
						<h3 class="devices-wizard-plugin-card__title">
							{{ item.label }}
						</h3>
						<p class="devices-wizard-plugin-card__description">
							{{ item.description || '&nbsp;' }}
						</p>
					</div>
					<div class="devices-wizard-plugin-card__chevron">
						<icon icon="mdi:chevron-right" />
					</div>
				</div>
			</el-card>
		</div>

		<template #footer>
			<el-button @click="wizardPluginDialogVisible = false">
				{{ t('devicesModule.buttons.cancel.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElDialog, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { ListDevices, ListDevicesAdjust } from '../components/components';
import { useDevicesActions, useDevicesDataSource, useDevicesPlugins, useDevicesValidation } from '../composables/composables';
import { RouteNames } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import type { IDevice } from '../store/devices.store.types';

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
const { fetchValidation } = useDevicesValidation();
const { wizardOptions } = useDevicesPlugins();
const enabledWizardOptions = computed(() => wizardOptions.value.filter((item) => !item.disabled));

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);
const wizardPluginDialogVisible = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isDevicesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DEVICES;
});

const isWizardRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DEVICES_WIZARD;
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
			ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
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

const onBulkAction = (action: string, items: IDevice[]): void => {
	switch (action) {
		case 'delete':
			deviceActions.bulkRemove(items);
			break;
		case 'enable':
			deviceActions.bulkEnable(items);
			break;
		case 'disable':
			deviceActions.bulkDisable(items);
			break;
	}
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

const onWizard = (): void => {
	if (enabledWizardOptions.value.length === 1 && enabledWizardOptions.value[0]) {
		onStartWizard(enabledWizardOptions.value[0].value);
		return;
	}

	wizardPluginDialogVisible.value = true;
};

const onStartWizard = (type: string): void => {
	wizardPluginDialogVisible.value = false;

	router.push({
		name: RouteNames.DEVICES_WIZARD,
		params: {
			type,
		},
	});
};

onBeforeMount((): void => {
	fetchDevices().catch((error: unknown): void => {
		const err = error as Error;

		throw new DevicesException('Something went wrong', err);
	});

	fetchValidation().catch((error: unknown): void => {
		// Validation fetch errors are non-critical, just log them
		console.warn('Failed to fetch device validation data:', error);
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

<style scoped lang="scss">
.devices-wizard-plugin-card {
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		.devices-wizard-plugin-card__chevron {
			opacity: 1;
			transform: translateX(2px);
		}
	}
}

.devices-wizard-plugin-card--disabled {
	cursor: not-allowed;
	opacity: 0.6;
}

.devices-wizard-plugin-card__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2.5rem;
	height: 2.5rem;
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-color-primary-light-9);
	color: var(--el-color-primary);
	font-size: 1.25rem;
	flex-shrink: 0;
}

.devices-wizard-plugin-card__content {
	display: flex;
	flex-direction: column;
	min-height: 4.5rem;
}

.devices-wizard-plugin-card__title {
	margin: 0 0 0.25rem 0;
	font-size: 0.9375rem;
	font-weight: 600;
	line-height: 1.3;
	color: var(--el-text-color-primary);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.devices-wizard-plugin-card__description {
	margin: 0;
	font-size: 0.8125rem;
	line-height: 1.4;
	color: var(--el-text-color-secondary);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.devices-wizard-plugin-card__chevron {
	display: flex;
	align-items: center;
	color: var(--el-text-color-placeholder);
	font-size: 1.25rem;
	opacity: 0.5;
	transition: all 0.2s ease;
	flex-shrink: 0;
	align-self: center;
}
</style>
