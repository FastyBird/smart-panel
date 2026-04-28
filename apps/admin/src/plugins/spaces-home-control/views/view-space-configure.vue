<template>
	<teleport
		v-if="mounted"
		to="#space-manage-actions"
	>
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
			data-test-id="edit-space"
			@click="onSpaceEdit"
		>
			<template #icon>
				<icon icon="mdi:pencil" />
			</template>
		</el-button>
	</teleport>

	<div
		v-if="!isSpaceEditRoute || isLGDevice"
		class="flex flex-col h-full min-h-0"
	>
		<space-detail :space="props.space" />

		<space-parent-zone-section
			v-if="props.space.type === SpaceType.ROOM"
			:space="props.space"
		/>

		<el-tabs
			v-model="activeTab"
			:class="['flex-1 min-h-0 flex flex-col mt-2', ns.e('tabs')]"
		>
			<el-tab-pane
				name="domains"
				class="h-full overflow-hidden"
			>
				<template #label>
					<div class="flex items-center gap-2 px-4">
						<icon icon="mdi:view-dashboard" />
						{{ t('spacesModule.detail.domains.title') }}
					</div>
				</template>

				<el-scrollbar class="h-full">
					<space-domains-section :space="props.space" />
				</el-scrollbar>
			</el-tab-pane>

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
					<el-card
						shadow="never"
						body-class="p-0!"
					>
						<space-devices-section
							:space-id="props.space.id"
							:space-type="props.space.type"
							@open-add-dialog="onAddDevice"
						/>
					</el-card>
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
					<el-card
						shadow="never"
						body-class="p-0!"
					>
						<space-scenes-section
							:space-id="props.space.id"
							@open-add-dialog="onAddScene"
						/>
					</el-card>
				</el-scrollbar>
			</el-tab-pane>

			<el-tab-pane
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
					<el-card
						shadow="never"
						body-class="p-0!"
					>
						<space-displays-section
							ref="displaysSectionRef"
							:space-id="props.space.id"
							@open-add-dialog="onAddDisplay"
						/>
					</el-card>
				</el-scrollbar>
			</el-tab-pane>
		</el-tabs>
	</div>

	<space-add-device-dialog
		v-model:visible="showAddDeviceDialog"
		:space-id="props.space.id"
		:space-type="props.space.type"
		@device-added="onDeviceAdded"
	/>

	<space-add-scene-dialog
		v-model:visible="showAddSceneDialog"
		:space-id="props.space.id"
		@scene-added="onSceneAdded"
	/>

	<space-add-display-dialog
		v-model:visible="showAddDisplayDialog"
		:space-id="props.space.id"
		@display-added="onDisplayAdded"
	/>

	<div
		v-if="isSpaceEditRoute && !isLGDevice"
		data-test-id="space-configure-edit-route"
		class="h-full overflow-hidden"
	>
		<suspense>
			<router-view
				:key="props.space.id"
				v-slot="{ Component }"
			>
				<component
					:is="Component"
					v-model:remote-form-changed="remoteFormChanged"
					:return-route="{ name: PluginRouteNames.SPACE, params: { id: props.space.id } }"
				/>
			</router-view>
		</suspense>
	</div>

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
							:key="props.space.id"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
								:return-route="{ name: PluginRouteNames.SPACE, params: { id: props.space.id } }"
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
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElDrawer, ElIcon, ElMessageBox, ElScrollbar, ElTabPane, ElTabs, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, ViewError, useBreakpoints } from '../../../common';
import { useDevices } from '../../../modules/devices/composables/useDevices';
import { useDisplays } from '../../../modules/displays/composables/useDisplays';
import { useScenes } from '../../../modules/scenes/composables/useScenes';
import { SpaceType, useSpaces } from '../../../modules/spaces';
import {
	SpaceAddDeviceDialog,
	SpaceAddDisplayDialog,
	SpaceAddSceneDialog,
	SpaceDetail,
	SpaceDevicesSection,
	SpaceDisplaysSection,
	SpaceDomainsSection,
	SpaceParentZoneSection,
	SpaceScenesSection,
} from '../components/components';
import { RouteNames as PluginRouteNames } from '../spaces-home-control.constants';

import type { IViewSpaceConfigureProps } from './view-space-configure.types';

defineOptions({
	name: 'ViewSpaceConfigure',
});

const props = defineProps<IViewSpaceConfigureProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { isLGDevice } = useBreakpoints();

const ns = useNamespace('view-space');

const { fetchDevices, loaded: devicesLoaded } = useDevices();
const { fetchScenes, loaded: scenesLoaded } = useScenes();
const { fetchDisplays, isLoaded: displaysLoaded } = useDisplays();
const { fetchSpaces, firstLoadFinished: spacesFirstLoadFinished } = useSpaces();

const mounted = ref<boolean>(false);
const showDrawer = ref<boolean>(false);

const activeTab = ref<string>('domains');
const showAddDeviceDialog = ref<boolean>(false);
const showAddSceneDialog = ref<boolean>(false);
const showAddDisplayDialog = ref<boolean>(false);
const displaysSectionRef = ref<InstanceType<typeof SpaceDisplaysSection> | null>(null);
const remoteFormChanged = ref<boolean>(false);

const isSpaceEditRoute = computed<boolean>(
	(): boolean => route.matched.find((matched) => matched.name === PluginRouteNames.SPACE_EDIT) !== undefined
);

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
	// Store is already updated by addDevice() which re-fetches the single device.
};

const onSceneAdded = (): void => {
	// Store is already updated by edit() - computed scenes list will update from the store.
};

const onDisplayAdded = (): void => {
	displaysSectionRef.value?.fetchDisplays();
};

const onSpaceEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: PluginRouteNames.SPACE_EDIT, params: { id: props.space.id } });
	} else {
		router.push({ name: PluginRouteNames.SPACE_EDIT, params: { id: props.space.id } });
	}
};

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
						name: PluginRouteNames.SPACE,
						params: { id: props.space.id },
					});
				} else {
					router.push({
						name: PluginRouteNames.SPACE,
						params: { id: props.space.id },
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
				name: PluginRouteNames.SPACE,
				params: { id: props.space.id },
			});
		} else {
			router.push({
				name: PluginRouteNames.SPACE,
				params: { id: props.space.id },
			});
		}

		done?.();
	}
};

onBeforeMount((): void => {
	showDrawer.value = isSpaceEditRoute.value;

	if (!devicesLoaded.value) {
		fetchDevices();
	}

	if (!scenesLoaded.value) {
		fetchScenes();
	}

	if (!displaysLoaded.value) {
		fetchDisplays();
	}

	if (!spacesFirstLoadFinished.value) {
		fetchSpaces();
	}
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = isSpaceEditRoute.value;
	}
);
</script>
