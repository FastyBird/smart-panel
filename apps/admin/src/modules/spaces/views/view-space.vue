<template>
	<template v-if="!notFound">
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
					<!--
						Add-device / add-scene / add-display buttons gate on the
						plugin's contributed dialogs instead of a hardcoded type
						check. A plugin that registers `spaceAddDeviceDialog` (or
						the others) opts into the matching button; the current
						home-control plugin registers all three. Synthetic master
						/ entry and signage register none, so only the Edit
						button renders for those types.
					-->
					<el-button
						v-if="spaceAddDeviceDialog"
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
						v-if="spaceAddSceneDialog"
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
						v-if="spaceAddDisplayDialog"
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
	</template>

	<!-- Space not found -->
	<entity-not-found
		v-if="notFound"
		icon="mdi:home-group"
		:message="t('spacesModule.messages.notFound')"
		:button-label="t('spacesModule.buttons.back.title')"
		@back="onClose"
	/>

	<div
		v-else-if="isSpaceRoute || isLGDevice"
		v-loading="isLoading || space === null"
		:element-loading-text="t('spacesModule.texts.loadingSpace')"
		class="flex flex-col flex-1 min-h-0 lt-sm:mx-1 sm:mx-2 mb-2"
		:class="[ns.b()]"
	>
		<template v-if="space">
			<space-detail :space="space" />

			<!--
				The tabs below are plugin-dispatched: only types whose plugin
				contributes the matching `space*Section` / `space*Dialog`
				component see the corresponding tab/button. Home-control
				contributes all three tabs plus the add dialogs; synthetic
				master / entry / signage plugins contribute none, so for
				those the view renders only the generic `<space-detail>`
				block above.
			-->
			<el-tabs
				v-if="hasDomainsTab || spaceAddDeviceDialog || spaceAddSceneDialog || spaceAddDisplayDialog"
				v-model="activeTab"
				:class="['flex-1 min-h-0 flex flex-col mt-2', ns.e('tabs')]"
			>
				<el-tab-pane
					v-if="spaceDomainsSection"
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
						<component
							:is="spaceDomainsSection"
							:space="space"
						/>
					</el-scrollbar>
				</el-tab-pane>

				<el-tab-pane
					v-if="spaceAddDeviceDialog"
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
						<el-card shadow="never" body-class="p-0!">
							<space-devices-section
								:space-id="space.id"
								:space-type="space.type"
								@open-add-dialog="onAddDevice"
							/>
						</el-card>
					</el-scrollbar>
				</el-tab-pane>

				<el-tab-pane
					v-if="spaceScenesSection"
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
						<el-card shadow="never" body-class="p-0!">
							<component
								:is="spaceScenesSection"
								:space-id="space.id"
								@open-add-dialog="onAddScene"
							/>
						</el-card>
					</el-scrollbar>
				</el-tab-pane>

				<el-tab-pane
					v-if="spaceAddDisplayDialog"
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
						<el-card shadow="never" body-class="p-0!">
							<space-displays-section
								ref="displaysSectionRef"
								:space-id="space.id"
								@open-add-dialog="onAddDisplay"
							/>
						</el-card>
					</el-scrollbar>
				</el-tab-pane>
			</el-tabs>
		</template>
	</div>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<!--
		Dialogs are plugin-dispatched mirroring the tabs above. `v-model:visible`
		is preserved so each dialog handles its own open/close state.
	-->
	<component
		:is="spaceAddDeviceDialog"
		v-if="space && spaceAddDeviceDialog"
		v-model:visible="showAddDeviceDialog"
		:space-id="space.id"
		:space-type="space.type"
		@device-added="onDeviceAdded"
	/>

	<component
		:is="spaceAddSceneDialog"
		v-if="space && spaceAddSceneDialog"
		v-model:visible="showAddSceneDialog"
		:space-id="space.id"
		@scene-added="onSceneAdded"
	/>

	<component
		:is="spaceAddDisplayDialog"
		v-if="space && spaceAddDisplayDialog"
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
	EntityNotFound,
	useBreakpoints,
	useFlashMessage,
	ViewError,
	ViewHeader,
} from '../../../common';
import { useDevices } from '../../devices/composables/useDevices';
import { useDisplays } from '../../displays/composables/useDisplays';
import { useScenes } from '../../scenes/composables/useScenes';
import { SpaceDetail, SpaceDevicesSection, SpaceDisplaysSection } from '../components/components';
import { useSpace, useSpacesPlugins } from '../composables';
import { RouteNames, SpaceRoomCategory, SpaceZoneCategory, getSpaceIcon } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';
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

// Cross-module data needed by tab sections (devices, scenes, displays)
const { fetchDevices, loaded: devicesLoaded } = useDevices();
const { fetchScenes, loaded: scenesLoaded } = useScenes();
const { fetchDisplays, isLoaded: displaysLoaded } = useDisplays();

const { getElement } = useSpacesPlugins();

const isLoading = computed<boolean>(() => fetching.value);

// Plugin-contributed detail sections + add-dialogs. Each space type's
// plugin registers whichever of these it wants on its `element.components`:
// home-control contributes all five (domains tab, scenes tab, add-device /
// add-scene / add-display dialogs); synthetic master / entry and signage
// register none so the view falls back to its generic detail-only layout.
// Replaces the hardcoded `isHomeControlSpace` gate that previously decided
// who saw the tabs and dialogs.
const pluginComponents = computed(() => {
	if (!space.value) {
		return {};
	}
	return getElement(space.value.type)?.components ?? {};
});

const spaceDomainsSection = computed(() => pluginComponents.value.spaceDomainsSection);
const spaceScenesSection = computed(() => pluginComponents.value.spaceScenesSection);
const spaceAddDeviceDialog = computed(() => pluginComponents.value.spaceAddDeviceDialog);
const spaceAddSceneDialog = computed(() => pluginComponents.value.spaceAddSceneDialog);
const spaceAddDisplayDialog = computed(() => pluginComponents.value.spaceAddDisplayDialog);

// A space has a domains tab iff its plugin contributes one. This replaces
// the old hardcoded `type === ROOM || ZONE` check — adding a new
// interactive space type in the future only requires registering
// `spaceDomainsSection` on its plugin element.
const hasDomainsTab = computed<boolean>((): boolean => spaceDomainsSection.value !== undefined);

// Track if space was previously loaded to detect deletion
const wasSpaceLoaded = ref<boolean>(false);
const notFound = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

// Tabs
const activeTab = ref<string>('domains');

// Dialog visibility
const showAddDeviceDialog = ref<boolean>(false);
const showAddSceneDialog = ref<boolean>(false);
const showAddDisplayDialog = ref<boolean>(false);

// Only the displays section exposes an imperative `fetchDisplays()` that
// the add-display callback needs to invoke. The other section refs that
// lived here historically were never read, so they're dropped.
const displaysSectionRef = ref<InstanceType<typeof SpaceDisplaysSection> | null>(null);

const isSpaceRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACE;
});

// Defer to the shared `getSpaceIcon` helper so this view's iconography
// stays consistent with `view-space-edit.vue` and the scenes module, and
// so new plugin-contributed space types (MASTER / ENTRY / SIGNAGE) pick
// up their own icons instead of falling back to the old zone marker.
const spaceIcon = computed<string>((): string =>
	space.value
		? getSpaceIcon({
				icon: space.value.icon ?? null,
				category: (space.value.category ?? null) as SpaceRoomCategory | SpaceZoneCategory | null,
				type: space.value.type,
			})
		: 'mdi:shape-outline',
);

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
	// Eagerly fetch cross-module data so tab sections have it when they mount
	if (!devicesLoaded.value) {
		fetchDevices();
	}
	if (!scenesLoaded.value) {
		fetchScenes();
	}
	if (!displaysLoaded.value) {
		fetchDisplays();
	}

	try {
		await fetchSpace();
	} catch (error: unknown) {
		if (error instanceof SpacesApiException && error.code === 404) {
			notFound.value = true;
		} else {
			flashMessage.error(t('spacesModule.messages.notLoaded'));
			notFound.value = true;
		}

		return;
	}

	if (!isLoading.value && space.value === null && !wasSpaceLoaded.value) {
		notFound.value = true;
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
		if (!val && space.value === null && !wasSpaceLoaded.value) {
			notFound.value = true;
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
			notFound.value = true;
		}
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'view-space.scss';
</style>
