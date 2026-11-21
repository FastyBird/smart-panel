<template>
	<app-breadcrumbs
		v-if="!isWizardRoute"
		:items="breadcrumbs"
	/>

	<view-header
		v-if="(isDevicesListRoute || isLGDevice) && !isWizardRoute"
		:title="t('devicesModule.headings.devices.list')"
		:subtitle="t('devicesModule.subHeadings.devices.list')"
		icon="mdi:devices"
		:actions="[
			{ icon: 'mdi:magnify', label: t('devicesModule.fields.devices.search.placeholder'), handler: onSearch },
			{ icon: 'mdi:plus', label: t('devicesModule.buttons.manual.title'), handler: onDeviceCreate },
		]"
	>
		<template #actions>
			<div class="flex items-center">
				<el-button
					v-if="enabledWizardOptions.length > 0"
					type="primary"
					@click="onWizard"
				>
					<el-icon class="mr-1"><icon icon="mdi:wizard-hat" /></el-icon>
					{{ t('devicesModule.buttons.wizard.title') }}
				</el-button>
				<el-button
					plain
					class="ml-2!"
					@click="onDeviceCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('devicesModule.buttons.manual.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<!--
		The wizards, for viewports below `md`. `ViewHeader` — which carries them on larger screens — is
		gated on `isMDDevice` and renders nothing here, and the app bar's single teleported right-hand
		slot is already the Add button: mounting a second button into it hides the first. Without this
		row there is no way to reach either kind of wizard on a small screen short of typing its URL.
	-->
	<div
		v-if="!isMDDevice && isDevicesListRoute && !isWizardRoute && enabledWizardOptions.length > 0"
		class="flex gap-2 lt-sm:mx-1 sm:mx-2 mt-2"
	>
		<el-button
			v-if="enabledWizardOptions.length > 0"
			class="flex-1"
			data-test-id="wizard-small"
			@click="onWizard"
		>
			<el-icon class="mr-1"><icon icon="mdi:wizard-hat" /></el-icon>
			{{ t('devicesModule.buttons.wizard.title') }}
		</el-button>
	</div>

	<div
		v-if="(isDevicesListRoute || isLGDevice) && !isWizardRoute"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<list-devices
			ref="list"
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			v-model:show-hidden="showHidden"
			:items="devicesPaginated"
			:all-items="devices"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			@detail="onDeviceDetail"
			@edit="onDeviceEdit"
			@remove="onDeviceRemove"
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
		v-if="isLGDevice && !isWizardRoute"
		v-model="showDrawer"
		:show-close="false"
		size="40%"
		:with-header="false"
		:before-close="onCloseDrawer"
	>
		<app-bar-scope @close="onCloseDrawer()">
			<template v-if="showDrawer">
				<view-error>
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
		</app-bar-scope>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarScope, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { ListDevices } from '../components/components';
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

const flashMessage = useFlashMessage();

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
	showHidden,
} = useDevicesDataSource();
const deviceActions = useDevicesActions();
const { fetchValidation } = useDevicesValidation();
const { wizardOptions } = useDevicesPlugins();
const enabledWizardOptions = computed(() => wizardOptions.value.filter((item) => !item.disabled));

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const list = ref<InstanceType<typeof ListDevices> | null>(null);

const remoteFormChanged = ref<boolean>(false);

const isDevicesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DEVICES;
});

const isWizardRoute = computed<boolean>((): boolean => {
	return route.meta.devicesWizard === true || route.name === RouteNames.DEVICES_WIZARD || route.name === RouteNames.DEVICES_WIZARD_SELECT;
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

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
};

const onWizard = (): void => {
	void router.push({ name: RouteNames.DEVICES_WIZARD_SELECT });
};

const refreshList = (): void => {
	fetchDevices().catch((error: unknown): void => {
		const err = error as Error;

		throw new DevicesException('Something went wrong', err);
	});

	fetchValidation().catch((error: unknown): void => {
		// Validation fetch errors are non-critical, just log them
		console.warn('Failed to fetch device validation data:', error);
	});
};

onBeforeMount((): void => {
	if (!isWizardRoute.value) refreshList();
	showDrawer.value =
		route.matched.find((matched) => matched.name === RouteNames.DEVICES_ADD || matched.name === RouteNames.DEVICES_EDIT) !== undefined;
});
watch(isWizardRoute, (wizard, wasWizard) => {
	if (wasWizard && !wizard) refreshList();
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

// Set while the toggle is being put back after a failed refresh, so the restoration does not read as
// a fresh request and send a second one.
let restoringShowHidden = false;

watch(
	(): boolean => showHidden.value,
	(value: boolean, previous: boolean): void => {
		if (restoringShowHidden) {
			restoringShowHidden = false;

			return;
		}

		fetchDevices().catch((): void => {
			// Only the request the toggle is still standing on gets to speak. A user who flips back before
			// this one fails has already had a newer request answer for the state on screen: restoring
			// `previous` here would be a no-op assignment Vue never notifies, leaving the guard below armed
			// for the next genuine flip — which would then skip its own fetch and show the visible-only
			// cache under an enabled toggle.
			if (showHidden.value !== value) {
				return;
			}

			// The store still holds whatever the previous filter fetched, so leaving the toggle where the
			// user put it would have the list claim to be showing hidden devices over a response that does
			// not contain them. Put it back and say so — throwing here only produced a rejected promise
			// nobody awaits, which reports the failure to no one.
			restoringShowHidden = true;
			showHidden.value = previous;

			flashMessage.error(t('devicesModule.messages.devices.hiddenNotLoaded'));
		});
	}
);
</script>
