<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:monitor"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ display?.name || display?.macAddress || t('displaysModule.detail.title') }}
		</template>

		<template #subtitle>
			{{ t('displaysModule.detail.title') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push({ name: RouteNames.DISPLAYS })"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('displaysModule.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="display?.name || display?.macAddress || t('displaysModule.detail.title')"
		:sub-heading="t('displaysModule.detail.title')"
		icon="mdi:monitor"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					plain
					class="px-4! ml-2!"
					@click="onEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
				<el-button
					type="warning"
					plain
					class="px-4! ml-2!"
					@click="onManageTokens"
				>
					<template #icon>
						<icon icon="mdi:key" />
					</template>
					{{ t('displaysModule.actions.manageTokens') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isDisplayRoute || isLGDevice"
		v-loading="isLoading"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-auto"
	>
		<el-row v-if="display">
			<!-- Display Information -->
			<el-col
				:xs="24"
				:sm="12"
				:md="8"
			>
				<el-card
					class="md:m-2 xs:my-1"
					body-class="p-0!"
				>
					<el-descriptions
						:label-width="170"
						:column="1"
						border
					>
						<template #title>
							<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
								<el-icon
									class="mr-2"
									size="28"
								>
									<icon icon="mdi:information" />
								</el-icon>
								{{ t('displaysModule.detail.info.title') }}
							</div>
						</template>

						<el-descriptions-item :label="t('displaysModule.detail.info.macAddress')">
							<code>{{ display.macAddress }}</code>
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.version')">
							{{ display.version }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.build')">
							{{ display.build || '-' }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.resolution')">
							{{ display.screenWidth }}x{{ display.screenHeight }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.pixelRatio')">
							{{ display.pixelRatio }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.registeredFromIp')">
							{{ formatIpAddress(display.registeredFromIp) }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.currentIpAddress')">
							{{ formatIpAddress(display.currentIpAddress) }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.status')">
							<el-tag :type="display.status === 'connected' ? 'success' : display.status === 'disconnected' ? 'warning' : display.status === 'lost' ? 'danger' : 'info'">
								{{ t(`displaysModule.states.${display.status ?? 'unknown'}`) }}
							</el-tag>
						</el-descriptions-item>
					</el-descriptions>
				</el-card>
			</el-col>

			<!-- Display Settings -->
			<el-col
				:xs="24"
				:sm="12"
				:md="8"
			>
				<el-card
					class="md:m-2 xs:my-1"
					body-class="p-0!"
				>
					<el-descriptions
						:label-width="170"
						:column="1"
						border
					>
						<template #title>
							<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
								<el-icon
									class="mr-2"
									size="28"
								>
									<icon icon="mdi:cog" />
								</el-icon>
								{{ t('displaysModule.detail.settings.title') }}
							</div>
						</template>

						<el-descriptions-item :label="t('displaysModule.detail.settings.gridSize')">
							{{ display.cols }}x{{ display.rows }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.darkMode')">
							<el-tag :type="display.darkMode ? 'success' : 'info'">
								{{ display.darkMode ? 'Enabled' : 'Disabled' }}
							</el-tag>
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.brightness')">
							{{ display.brightness }}%
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.screenLockDuration')">
							{{ display.screenLockDuration }}s
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.screenSaver')">
							<el-tag :type="display.screenSaver ? 'success' : 'info'">
								{{ display.screenSaver ? 'Enabled' : 'Disabled' }}
							</el-tag>
						</el-descriptions-item>
					</el-descriptions>
				</el-card>
			</el-col>

			<!-- Peripherals - Only shown if any peripheral is supported -->
			<el-col
				v-if="display.audioOutputSupported || display.audioInputSupported"
				:xs="24"
				:sm="12"
				:md="8"
			>
				<el-card
					class="md:m-2 xs:my-1"
					body-class="p-0!"
				>
					<el-descriptions
						:label-width="170"
						:column="1"
						border
					>
						<template #title>
							<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
								<el-icon
									class="mr-2"
									size="28"
								>
									<icon icon="mdi:usb" />
								</el-icon>
								{{ t('displaysModule.detail.peripherals.title') }}
							</div>
						</template>

						<!-- Audio Output -->
						<template v-if="display.audioOutputSupported">
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioOutput')">
								<el-tag :type="display.speaker ? 'success' : 'info'">
									{{ display.speaker ? 'Enabled' : 'Disabled' }}
								</el-tag>
							</el-descriptions-item>
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioOutputVolume')">
								{{ display.speakerVolume }}%
							</el-descriptions-item>
						</template>

						<!-- Audio Input -->
						<template v-if="display.audioInputSupported">
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioInput')">
								<el-tag :type="display.microphone ? 'success' : 'info'">
									{{ display.microphone ? 'Enabled' : 'Disabled' }}
								</el-tag>
							</el-descriptions-item>
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioInputVolume')">
								{{ display.microphoneVolume }}%
							</el-descriptions-item>
						</template>
					</el-descriptions>
				</el-card>
			</el-col>

			<!-- Space Context -->
			<el-col
				:xs="24"
				:sm="12"
				:md="8"
			>
				<el-card
					class="md:m-2 xs:my-1"
					body-class="p-0!"
				>
					<el-descriptions
						:label-width="170"
						:column="1"
						border
					>
						<template #title>
							<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
								<el-icon
									class="mr-2"
									size="28"
								>
									<icon icon="mdi:home-map-marker" />
								</el-icon>
								{{ t('displaysModule.detail.spaceContext.title') }}
							</div>
						</template>

						<!-- Display Role -->
						<el-descriptions-item :label="t('displaysModule.detail.spaceContext.role')">
							{{ t(`displaysModule.roles.${display.role}`) }}
						</el-descriptions-item>

						<!-- Home Page Mode -->
						<el-descriptions-item :label="t('displaysModule.detail.spaceContext.homeMode')">
							{{ t(`displaysModule.detail.spaceContext.homeModes.${display.homeMode}`) }}
						</el-descriptions-item>

						<!-- Assigned Room (only for room role) -->
						<el-descriptions-item
							v-if="display.role === 'room'"
							:label="t('displaysModule.detail.spaceContext.assignedRoom')"
						>
							{{ assignedRoomName || t('displaysModule.detail.spaceContext.notAssigned') }}
						</el-descriptions-item>

						<!-- Initial View -->
						<el-descriptions-item :label="t('displaysModule.detail.spaceContext.initialView')">
							{{ initialViewLabel }}
						</el-descriptions-item>

						<!-- System Views (only for room role) -->
						<el-descriptions-item
							v-if="display.role === 'room'"
							:label="t('displaysModule.detail.spaceContext.systemViews')"
						>
							<div class="flex flex-wrap gap-1">
								<el-tag
									v-for="view in systemViews"
									:key="view"
									size="small"
									type="info"
								>
									{{ view }}
								</el-tag>
							</div>
						</el-descriptions-item>
					</el-descriptions>

					<!-- Informational Hint -->
					<div class="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
						{{ t('displaysModule.detail.spaceContext.hint') }}
					</div>
				</el-card>
			</el-col>
		</el-row>

		<div
			v-else-if="!isLoading"
			class="text-center py-8 text-gray-500"
		>
			{{ t('displaysModule.messages.notFound') }}
		</div>
	</div>

	<router-view
		v-else
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		size="40%"
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
				<suspense>
					<router-view v-slot="{ Component }">
						<component :is="Component" />
					</router-view>
				</suspense>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElCol, ElDescriptions, ElDescriptionsItem, ElDrawer, ElIcon, ElRow, ElTag, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { usePages } from '../../dashboard/composables/composables';
import { useDevices } from '../../devices/composables/useDevices';
import { useSpaces } from '../../spaces/composables';
import { useDisplay } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplayProps } from './view-display.types';

defineOptions({
	name: 'ViewDisplay',
});

const props = defineProps<IViewDisplayProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

const { isMDDevice, isLGDevice } = useBreakpoints();

const displayId = computed(() => props.id);
const { display, isLoading } = useDisplay(displayId);

// Space context data
const { findById: findSpaceById, fetchSpaces, firstLoadFinished: spacesLoaded } = useSpaces();
const { pages, fetchPages, loaded: pagesLoaded } = usePages();
const { devices, fetchDevices, loaded: devicesLoaded } = useDevices();

// Climate device categories
const climateCategories = [
	DevicesModuleDeviceCategory.thermostat,
	DevicesModuleDeviceCategory.air_conditioner,
	DevicesModuleDeviceCategory.heating_unit,
	DevicesModuleDeviceCategory.air_humidifier,
	DevicesModuleDeviceCategory.air_dehumidifier,
	DevicesModuleDeviceCategory.air_purifier,
];

const assignedRoomName = computed<string | null>(() => {
	if (!display.value?.roomId) return null;
	const room = findSpaceById(display.value.roomId);
	return room?.name ?? null;
});

// Get devices in the assigned room
const roomDevices = computed(() => {
	if (!display.value?.roomId) return [];
	return devices.value.filter((device) => device.roomId === display.value?.roomId);
});

// Check if the room has lighting devices
const hasLightingDevices = computed(() => {
	return roomDevices.value.some((device) => device.category === DevicesModuleDeviceCategory.lighting);
});

// Check if the room has climate devices
const hasClimateDevices = computed(() => {
	return roomDevices.value.some((device) => climateCategories.includes(device.category));
});

const initialViewLabel = computed<string>(() => {
	if (!display.value) return '-';

	// If explicit mode with a page selected
	if (display.value.homeMode === 'explicit' && display.value.homePageId) {
		const page = pages.value.find((p) => p.id === display.value?.homePageId);
		return page?.title ?? t('displaysModule.detail.spaceContext.selectedPage');
	}

	// Auto mode - depends on role
	switch (display.value.role) {
		case 'room':
			return t('displaysModule.detail.spaceContext.initialViews.roomOverview');
		case 'master':
			return t('displaysModule.detail.spaceContext.initialViews.houseOverview');
		case 'entry':
			return t('displaysModule.detail.spaceContext.initialViews.entryOverview');
		default:
			return '-';
	}
});

// System views - only for room role, with conditional lights/climate
const systemViews = computed<string[]>(() => {
	if (!display.value || display.value.role !== 'room') return [];

	const views = [t('displaysModule.detail.spaceContext.views.overview')];

	if (hasLightingDevices.value) {
		views.push(t('displaysModule.detail.spaceContext.views.lights'));
	}

	if (hasClimateDevices.value) {
		views.push(t('displaysModule.detail.spaceContext.views.climate'));
	}

	return views;
});

// Track if display was previously loaded to detect deletion
const wasDisplayLoaded = ref<boolean>(false);

const formatIpAddress = (ipAddress: string | null | undefined): string => {
	if (!ipAddress) {
		return '-';
	}
	const normalized = ipAddress.toLowerCase().trim();
	if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
		return t('displaysModule.table.columns.local');
	}
	return ipAddress;
};

const { meta } = useMeta({});

const showDrawer = ref<boolean>(false);

const isDisplayRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DISPLAY;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('displaysModule.breadcrumbs.displays.list'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
			{
				label: t('displaysModule.breadcrumbs.displays.detail', { display: display.value?.name || display.value?.macAddress }),
				route: router.resolve({ name: RouteNames.DISPLAY, params: { id: props.id } }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	router.replace({
		name: RouteNames.DISPLAY,
		params: { id: props.id },
	});

	done?.();
};

const onEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DISPLAY_EDIT,
			params: { id: props.id },
		});
	} else {
		router.push({
			name: RouteNames.DISPLAY_EDIT,
			params: { id: props.id },
		});
	}
};

const onManageTokens = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DISPLAY_TOKENS,
			params: { id: props.id },
		});
	} else {
		router.push({
			name: RouteNames.DISPLAY_TOKENS,
			params: { id: props.id },
		});
	}
};

onBeforeMount(async (): Promise<void> => {
	// Mark as loaded if display was successfully fetched
	if (display.value !== null) {
		wasDisplayLoaded.value = true;
	}

	showDrawer.value =
		route.matched.find((matched) => matched.name === RouteNames.DISPLAY_EDIT || matched.name === RouteNames.DISPLAY_TOKENS) !== undefined;

	// Fetch data for space context if not already loaded
	if (!spacesLoaded.value) {
		fetchSpaces();
	}
	if (!pagesLoaded.value) {
		fetchPages();
	}
	if (!devicesLoaded.value) {
		fetchDevices();
	}
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.DISPLAY_EDIT || matched.name === RouteNames.DISPLAY_TOKENS) !== undefined;
	}
);

watch(
	(): IDisplay | null => display.value,
	(val: IDisplay | null): void => {
		if (val !== null) {
			wasDisplayLoaded.value = true;
			meta.title = t('displaysModule.meta.displays.detail.title', { display: val.name || val.macAddress });
		} else if (wasDisplayLoaded.value && !isLoading.value) {
			// Display was previously loaded but is now null - it was deleted
			flashMessage.warning(t('displaysModule.messages.deletedWhileEditing'), { duration: 0 });
			// Redirect to displays list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.DISPLAYS });
			} else {
				router.push({ name: RouteNames.DISPLAYS });
			}
		} else if (!isLoading.value && val === null && !wasDisplayLoaded.value) {
			// Display was never loaded - initial load failed (but don't throw, just show error state)
			// The template already handles this with v-else-if="!isLoading"
		}
	},
	{ immediate: true },
);
</script>
