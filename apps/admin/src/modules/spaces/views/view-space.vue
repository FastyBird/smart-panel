<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isSpaceRoute"
		teleport
	>
		<template #icon>
			<icon
				:icon="spaceIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('spacesModule.headings.detail', { space: space?.name }) }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.detail', { space: space?.name }) }}
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

	<view-header
		:heading="t('spacesModule.headings.detail', { space: space?.name })"
		:sub-heading="t('spacesModule.subHeadings.detail', { space: space?.name })"
		:icon="spaceIcon"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onAddDevice"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('spacesModule.detail.devices.add') }}
				</el-button>
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onAddScene"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('spacesModule.detail.scenes.add') }}
				</el-button>
				<el-button
					v-if="space?.type === SpaceType.ROOM"
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onAddDisplay"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('spacesModule.detail.displays.add') }}
				</el-button>
				<el-button
					plain
					class="px-4! ml-2!"
					@click="onSpaceEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</div>
		</template>
	</view-header>

	<el-scrollbar
		v-if="isSpaceRoute || isLGDevice"
		v-loading="isLoading || space === null"
		:element-loading-text="t('spacesModule.texts.loadingSpace')"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2"
	>
		<template v-if="space">
			<space-detail :space="space" />

			<!-- Tabs for Devices and Displays -->
			<el-card
				shadow="never"
				class="flex-1 min-h-0 flex flex-col mt-4"
				body-class="p-0! flex-1 min-h-0 flex flex-col"
			>
				<el-tabs
					v-model="activeTab"
					:class="['flex-1 min-h-0 flex flex-col', ns.e('tabs')]"
				>
					<el-tab-pane
						name="devices"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:devices" />
								{{ t('spacesModule.detail.devices.title') }}
							</div>
						</template>

						<el-scrollbar class="h-full">
							<space-devices-section
								ref="devicesSectionRef"
								:space-id="space.id"
								:space-type="space.type"
								@open-add-dialog="onAddDevice"
							/>
						</el-scrollbar>
					</el-tab-pane>

					<el-tab-pane
						name="scenes"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:play-box-multiple" />
								{{ t('spacesModule.detail.scenes.title') }}
							</div>
						</template>

						<el-scrollbar class="h-full">
							<space-scenes-section
								ref="scenesSectionRef"
								:space-id="space.id"
								@open-add-dialog="onAddScene"
							/>
						</el-scrollbar>
					</el-tab-pane>

					<el-tab-pane
						v-if="space?.type === SpaceType.ROOM"
						name="displays"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:monitor" />
								{{ t('spacesModule.detail.displays.title') }}
							</div>
						</template>

						<el-scrollbar class="h-full">
							<space-displays-section
								ref="displaysSectionRef"
								:space-id="space.id"
								@open-add-dialog="onAddDisplay"
							/>
						</el-scrollbar>
					</el-tab-pane>
					<el-tab-pane
						name="media-endpoints"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:cast-connected" />
								{{ t('spacesModule.detail.media.endpoints') }}
							</div>
						</template>

						<el-scrollbar class="h-full">
							<space-media-endpoints :space-id="space.id" />
						</el-scrollbar>
					</el-tab-pane>

					<el-tab-pane
						name="media-activities"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:play-box-multiple-outline" />
								{{ t('spacesModule.detail.media.activities') }}
							</div>
						</template>

						<el-scrollbar class="h-full">
							<space-media-activities :space-id="space.id" />
						</el-scrollbar>
					</el-tab-pane>
				</el-tabs>
			</el-card>
		</template>
	</el-scrollbar>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<!-- Add Device Dialog -->
	<space-add-device-dialog
		v-if="space"
		v-model:visible="showAddDeviceDialog"
		:space-id="space.id"
		:space-type="space.type"
		@device-added="onDeviceAdded"
	/>

	<!-- Add Scene Dialog -->
	<space-add-scene-dialog
		v-if="space"
		v-model:visible="showAddSceneDialog"
		:space-id="space.id"
		@scene-added="onSceneAdded"
	/>

	<!-- Add Display Dialog -->
	<space-add-display-dialog
		v-if="space && space.type === SpaceType.ROOM"
		v-model:visible="showAddDisplayDialog"
		:space-id="space.id"
		@display-added="onDisplayAdded"
	/>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="'40%'"
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
				<view-error>
					<template #icon>
						<icon icon="mdi:home-group" />
					</template>
					<template #message>
						{{ t('spacesModule.messages.loadError') }}
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

import {
	ElButton,
	ElCard,
	ElDrawer,
	ElIcon,
	ElMessageBox,
	ElScrollbar,
	ElTabPane,
	ElTabs,
	useNamespace,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBar,
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	useBreakpoints,
	useFlashMessage,
	ViewError,
	ViewHeader,
} from '../../../common';
import {
	SpaceAddDeviceDialog,
	SpaceAddDisplayDialog,
	SpaceAddSceneDialog,
	SpaceDetail,
	SpaceDevicesSection,
	SpaceDisplaysSection,
	SpaceMediaActivities,
	SpaceMediaEndpoints,
	SpaceScenesSection,
} from '../components/components';
import { useSpace } from '../composables';
import { RouteNames, SpaceType } from '../spaces.constants';
import { type ISpace } from '../store';

import type { IViewSpaceProps } from './view-space.types';

defineOptions({
	name: 'ViewSpace',
});

const props = withDefaults(defineProps<IViewSpaceProps>(), {
	id: undefined,
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { isMDDevice, isLGDevice } = useBreakpoints();

const ns = useNamespace('view-space');

const spaceId = computed(() => (props.id || route.params.id) as string | undefined);

const { space, fetching, fetchSpace } = useSpace(spaceId);

const isLoading = computed<boolean>(() => fetching.value);

// Track if space was previously loaded to detect deletion
const wasSpaceLoaded = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

// Tabs
const activeTab = ref<string>('devices');

// Dialog visibility
const showAddDeviceDialog = ref<boolean>(false);
const showAddSceneDialog = ref<boolean>(false);
const showAddDisplayDialog = ref<boolean>(false);

// Component refs
const devicesSectionRef = ref<InstanceType<typeof SpaceDevicesSection> | null>(null);
const scenesSectionRef = ref<InstanceType<typeof SpaceScenesSection> | null>(null);
const displaysSectionRef = ref<InstanceType<typeof SpaceDisplaysSection> | null>(null);

const isSpaceRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACE;
});

const spaceIcon = computed<string>((): string => {
	if (space.value?.icon) {
		return space.value.icon;
	}
	return space.value?.type === SpaceType.ROOM ? 'mdi:door' : 'mdi:home-floor-1';
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
			{
				label: t('spacesModule.breadcrumbs.spaces.detail', { space: space.value?.name }),
				route: router.resolve({ name: RouteNames.SPACE, params: { id: spaceId.value } }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
			confirmButtonText: t('spacesModule.buttons.yes.title'),
			cancelButtonText: t('spacesModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.SPACE,
						params: { id: spaceId.value },
					});
				} else {
					router.push({
						name: RouteNames.SPACE,
						params: { id: spaceId.value },
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
				name: RouteNames.SPACE,
				params: { id: spaceId.value },
			});
		} else {
			router.push({
				name: RouteNames.SPACE,
				params: { id: spaceId.value },
			});
		}

		done?.();
	}
};

const onAddDevice = (): void => {
	showAddDeviceDialog.value = true;
};

const onAddScene = (): void => {
	showAddSceneDialog.value = true;
};

const onAddDisplay = (): void => {
	showAddDisplayDialog.value = true;
};

const onDeviceAdded = (): void => {
	// Store is already updated by addDevice() which re-fetches the single device
	// The computed devices list will automatically update from the store
};

const onSceneAdded = (): void => {
	// Store is already updated by edit() - computed scenes list will update from the store
};

const onDisplayAdded = (): void => {
	// Refresh displays list
	displaysSectionRef.value?.fetchDisplays();
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

const onSpaceEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACE_EDIT, params: { id: spaceId.value } });
	} else {
		router.push({ name: RouteNames.SPACE_EDIT, params: { id: spaceId.value } });
	}
};

onBeforeMount(async (): Promise<void> => {
	await fetchSpace();
	if (!isLoading.value && space.value === null && !wasSpaceLoaded.value) {
		// Space not found
	}
	// Mark as loaded if space was successfully fetched
	if (space.value !== null) {
		wasSpaceLoaded.value = true;
	}

	showDrawer.value =
		route.matched.find(
			(matched) => matched.name === RouteNames.SPACE_EDIT
		) !== undefined;
});

onMounted((): void => {
	// Component mounted
});


watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find(
				(matched) => matched.name === RouteNames.SPACE_EDIT
			) !== undefined;
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if space was never loaded (initial load failed)
		if (!val && space.value === null && !wasSpaceLoaded.value) {
			// Space not found
		}
	}
);

watch(
	(): ISpace | null => space.value,
	(val: ISpace | null): void => {
		if (val !== null) {
			wasSpaceLoaded.value = true;
			meta.title = t('spacesModule.meta.spaces.detail.title', { space: space.value?.name });
		} else if (wasSpaceLoaded.value && !isLoading.value) {
			// Space was previously loaded but is now null - it was deleted
			flashMessage.warning(t('spacesModule.messages.deletedWhileEditing'), { duration: 0 });
			// Redirect to spaces list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.SPACES });
			} else {
				router.push({ name: RouteNames.SPACES });
			}
		} else if (!isLoading.value && val === null && !wasSpaceLoaded.value) {
			// Space was never loaded - initial load failed
			// Space not found
		}
	}
);
</script>
