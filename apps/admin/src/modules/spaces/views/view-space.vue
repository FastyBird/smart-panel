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
	/>

	<el-scrollbar
		v-if="isSpaceRoute || isLGDevice"
		v-loading="isLoading || space === null"
		:element-loading-text="t('spacesModule.texts.loadingSpace')"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2"
	>
		<template v-if="space">
			<el-descriptions
				:column="1"
				border
				class="mt-2"
			>
				<el-descriptions-item :label="t('spacesModule.fields.spaces.name.title')">
					{{ space.name }}
				</el-descriptions-item>
				<el-descriptions-item :label="t('spacesModule.fields.spaces.type.title')">
					{{ t(`spacesModule.misc.types.${space.type}`) }}
				</el-descriptions-item>
				<el-descriptions-item
					v-if="space.description"
					:label="t('spacesModule.fields.spaces.description.title')"
				>
					{{ space.description }}
				</el-descriptions-item>
				<el-descriptions-item
					v-if="space.icon"
					:label="t('spacesModule.fields.spaces.icon.title')"
				>
					<el-icon>
						<icon :icon="space.icon" />
					</el-icon>
					{{ space.icon }}
				</el-descriptions-item>
				<!-- Inline Floor selector (Room only) -->
				<el-descriptions-item
					v-if="space.type === SpaceType.ROOM"
					:label="t('spacesModule.detail.parentZone.title')"
				>
					<div class="flex items-center gap-2">
						<el-select
							v-model="selectedFloorId"
							:placeholder="t('spacesModule.detail.parentZone.select')"
							clearable
							size="small"
							class="w-50"
							:loading="isSavingFloor"
							@change="onFloorChange"
						>
							<el-option
								v-for="zone in floorZones"
								:key="zone.id"
								:label="zone.name"
								:value="zone.id"
							>
								<div class="flex items-center gap-2">
									<icon :icon="zone.icon || 'mdi:home-floor-1'" />
									<span>{{ zone.name }}</span>
								</div>
							</el-option>
						</el-select>
						<el-tag v-if="currentFloor" type="success" size="small">
							<div class="flex items-center gap-1">
								<icon :icon="currentFloor.icon || 'mdi:home-floor-1'" />
								{{ currentFloor.name }}
							</div>
						</el-tag>
						<span v-else-if="!selectedFloorId" class="text-gray-400 text-sm">
							{{ t('spacesModule.detail.parentZone.none') }}
						</span>
					</div>
				</el-descriptions-item>
			</el-descriptions>

			<!-- Tabs for Devices and Displays -->
			<el-tabs v-model="activeTab" class="mt-4">
				<el-tab-pane :name="'devices'">
					<template #label>
						<div class="flex items-center gap-2">
							<icon icon="mdi:devices" />
							<span>{{ t('spacesModule.detail.devices.title') }}</span>
							<el-button
								type="primary"
								size="small"
								class="ml-2"
								@click.stop="onAddDevice"
							>
								<template #icon>
									<icon icon="mdi:plus" />
								</template>
								{{ t('spacesModule.detail.devices.add') }}
							</el-button>
						</div>
					</template>
					<space-devices-section
						ref="devicesSectionRef"
						:space-id="space.id"
						:space-type="space.type"
					/>
				</el-tab-pane>

				<el-tab-pane :name="'displays'">
					<template #label>
						<div class="flex items-center gap-2">
							<icon icon="mdi:monitor" />
							<span>{{ t('spacesModule.detail.displays.title') }}</span>
							<el-button
								type="primary"
								size="small"
								class="ml-2"
								@click.stop="onAddDisplay"
							>
								<template #icon>
									<icon icon="mdi:plus" />
								</template>
								{{ t('spacesModule.detail.displays.add') }}
							</el-button>
						</div>
					</template>
					<space-displays-section
						ref="displaysSectionRef"
						:space-id="space.id"
					/>
				</el-tab-pane>
			</el-tabs>
		</template>
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
	ElDescriptions,
	ElDescriptionsItem,
	ElDrawer,
	ElIcon,
	ElMessageBox,
	ElOption,
	ElScrollbar,
	ElSelect,
	ElTabPane,
	ElTabs,
	ElTag,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBar,
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	injectStoresManager,
	useBreakpoints,
	useFlashMessage,
	ViewError,
	ViewHeader,
} from '../../../common';
import {
	SpaceDevicesSection,
	SpaceDisplaysSection,
} from '../components/components';
import { useSpace } from '../composables';
import { RouteNames, SpaceType } from '../spaces.constants';
import { spacesStoreKey, type ISpace } from '../store';

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

const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);

const spaceId = computed(() => (props.id || route.params.id) as string | undefined);

const { space, fetching, fetchSpace } = useSpace(spaceId);

const isLoading = computed<boolean>(() => fetching.value);

// Track if space was previously loaded to detect deletion
const wasSpaceLoaded = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

// Tabs
const activeTab = ref<string>('devices');

// Floor selector
const selectedFloorId = ref<string | null>(null);
const isSavingFloor = ref<boolean>(false);

// Component refs
const devicesSectionRef = ref<InstanceType<typeof SpaceDevicesSection> | null>(null);
const displaysSectionRef = ref<InstanceType<typeof SpaceDisplaysSection> | null>(null);

const isSpaceRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACE;
});

const spaceIcon = computed<string>((): string => {
	if (space.value?.icon) {
		return space.value.icon;
	}
	return space.value?.type === 'room' ? 'mdi:door' : 'mdi:home-floor-1';
});

// Get floor-type zones for selector
const floorZones = computed(() => {
	return spacesStore.findAll().filter((s) => {
		if (s.type !== SpaceType.ZONE) return false;
		if (!s.category?.startsWith('floor_')) return false;
		return true;
	});
});

// Get current parent floor
const currentFloor = computed<ISpace | null>(() => {
	if (!space.value?.parentId) return null;
	return spacesStore.findById(space.value.parentId);
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
						params: {
							id: spaceId.value,
						},
					});
				} else {
					router.push({
						name: RouteNames.SPACE,
						params: {
							id: spaceId.value,
						},
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
				params: {
					id: spaceId.value,
				},
			});
		} else {
			router.push({
				name: RouteNames.SPACE,
				params: {
					id: spaceId.value,
				},
			});
		}

		done?.();
	}
};

const onFloorChange = async (newFloorId: string | null): Promise<void> => {
	if (!space.value || newFloorId === space.value.parentId) return;

	isSavingFloor.value = true;

	try {
		await spacesStore.edit({
			id: space.value.id,
			data: {
				name: space.value.name,
				parentId: newFloorId,
			},
		});

		flashMessage.success(t('spacesModule.messages.edited', { space: space.value.name }));
	} catch {
		// Revert selection on error
		selectedFloorId.value = space.value.parentId;
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		isSavingFloor.value = false;
	}
};

const onAddDevice = (): void => {
	devicesSectionRef.value?.openAddDialog();
};

const onAddDisplay = (): void => {
	displaysSectionRef.value?.openAddDialog();
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
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
		selectedFloorId.value = space.value.parentId;
	}

	showDrawer.value =
		route.matched.find((matched) => matched.name === RouteNames.SPACE_EDIT) !== undefined;
});

onMounted((): void => {
	// Component mounted
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.SPACE_EDIT) !== undefined;
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
			selectedFloorId.value = val.parentId;
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
