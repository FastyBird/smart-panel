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
			@click="onSpaceEdit"
		>
			<template #icon>
				<icon icon="mdi:pencil" />
			</template>
		</el-button>
	</teleport>

	<div class="flex flex-col h-full min-h-0">
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
</template>

<script setup lang="ts">
import { onBeforeMount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElCard, ElScrollbar, ElTabPane, ElTabs, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useBreakpoints } from '../../../common';
import { useDevices } from '../../../modules/devices/composables/useDevices';
import { useDisplays } from '../../../modules/displays/composables/useDisplays';
import { useScenes } from '../../../modules/scenes/composables/useScenes';
import { SpaceType, RouteNames as SpacesRouteNames } from '../../../modules/spaces';
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

import type { IViewSpaceConfigureProps } from './view-space-configure.types';

defineOptions({
	name: 'ViewSpaceConfigure',
});

const props = defineProps<IViewSpaceConfigureProps>();

const router = useRouter();
const { t } = useI18n();
const { isLGDevice } = useBreakpoints();

const ns = useNamespace('view-space');

const { fetchDevices, loaded: devicesLoaded } = useDevices();
const { fetchScenes, loaded: scenesLoaded } = useScenes();
const { fetchDisplays, isLoaded: displaysLoaded } = useDisplays();

const mounted = ref<boolean>(false);

const activeTab = ref<string>('domains');
const showAddDeviceDialog = ref<boolean>(false);
const showAddSceneDialog = ref<boolean>(false);
const showAddDisplayDialog = ref<boolean>(false);
const displaysSectionRef = ref<InstanceType<typeof SpaceDisplaysSection> | null>(null);

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
		router.replace({ name: SpacesRouteNames.SPACE_EDIT, params: { id: props.space.id } });
	} else {
		router.push({ name: SpacesRouteNames.SPACE_EDIT, params: { id: props.space.id } });
	}
};

onBeforeMount((): void => {
	if (!devicesLoaded.value) {
		fetchDevices();
	}

	if (!scenesLoaded.value) {
		fetchScenes();
	}

	if (!displaysLoaded.value) {
		fetchDisplays();
	}
});

onMounted((): void => {
	mounted.value = true;
});
</script>
