<template>
	<teleport
		v-if="mounted"
		to="#space-manage-actions"
	>
		<el-button
			plain
			class="ml-2!"
			data-test-id="edit-space"
			@click="onSpaceEdit"
		>
			<template #icon>
				<icon icon="mdi:pencil" />
			</template>

			{{ t('spacesModule.buttons.edit.title') }}
		</el-button>
	</teleport>

	<div
		v-show="!isSpaceEditRoute || isLGDevice"
		class="flex flex-col flex-1 h-full min-h-0"
	>
		<!-- Template 5: the space summary on top, then one card per area with an anchor nav from desktop. Each area's
		     add action sits in its own card -->
		<settings-layout :sections="sections">
			<template #banner>
				<space-detail :space="props.space">
					<space-parent-zone-section
						v-if="props.space.type === SpaceType.ROOM"
						:space="props.space"
					/>
				</space-detail>
			</template>

			<settings-section
				id="domains"
				:title="t('spacesModule.detail.domains.title')"
				icon="mdi:view-dashboard"
			>
				<space-domains-section :space="props.space" />
			</settings-section>

			<settings-section
				v-if="occupancySupported"
				id="modes"
				:title="t('spacesHomeControlPlugin.activityModes.title')"
				icon="mdi:home-switch"
			>
				<div class="flex flex-col gap-4">
					<space-activity-modes-section :space-id="props.space.id" />

					<div class="grid gap-3 tp:grid-cols-2">
						<div class="flex flex-col gap-2 p-4 border border-solid border-light rounded-lg">
							<h3 class="m-0 text-card-title">{{ t('spacesHomeControlPlugin.schedules.title') }}</h3>
							<p class="m-0 text-help">{{ t('spacesHomeControlPlugin.modesLayout.scheduleDescription') }}</p>
							<p class="m-0 text-body">{{ activationSummary('schedule') }}</p>
							<div>
								<el-button
									data-test-id="configure-schedule"
									@click="showSchedule = true"
								>
									{{ t('spacesHomeControlPlugin.modesLayout.configure') }}
								</el-button>
							</div>
						</div>
						<div class="flex flex-col gap-2 p-4 border border-solid border-light rounded-lg">
							<h3 class="m-0 text-card-title">{{ t('spacesHomeControlPlugin.modesLayout.presenceTitle') }}</h3>
							<p class="m-0 text-help">{{ t('spacesHomeControlPlugin.modesLayout.presenceDescription') }}</p>
							<p class="m-0 text-body">{{ activationSummary('occupancy') }}</p>
							<div>
								<el-button
									data-test-id="configure-presence"
									@click="showOccupancy = true"
								>
									{{ t('spacesHomeControlPlugin.modesLayout.configure') }}
								</el-button>
							</div>
						</div>
					</div>
				</div>
			</settings-section>

			<settings-section
				id="devices"
				:title="t('spacesModule.detail.devices.title')"
				icon="mdi:devices"
			>
				<template #actions>
					<el-button
						plain
						size="small"
						data-test-id="add-space-device"
						@click="onAddDevice"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>

						{{ t('spacesModule.detail.devices.add') }}
					</el-button>
				</template>

				<space-devices-section
					:space-id="props.space.id"
					:space-type="props.space.type"
					@open-add-dialog="onAddDevice"
				/>
			</settings-section>

			<settings-section
				id="scenes"
				:title="t('spacesModule.detail.scenes.title')"
				icon="mdi:play-box-multiple"
			>
				<template #actions>
					<el-button
						plain
						size="small"
						data-test-id="add-space-scene"
						@click="onAddScene"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>

						{{ t('spacesModule.detail.scenes.add') }}
					</el-button>
				</template>

				<space-scenes-section
					:space-id="props.space.id"
					@open-add-dialog="onAddScene"
				/>
			</settings-section>

			<settings-section
				id="displays"
				:title="t('spacesModule.detail.displays.title')"
				icon="mdi:monitor"
			>
				<template #actions>
					<el-button
						plain
						size="small"
						data-test-id="add-space-display"
						@click="onAddDisplay"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>

						{{ t('spacesModule.detail.displays.add') }}
					</el-button>
				</template>

				<space-displays-section
					ref="displaysSectionRef"
					:space-id="props.space.id"
					@open-add-dialog="onAddDisplay"
				/>
			</settings-section>
		</settings-layout>
	</div>

	<el-dialog
		v-model="showSchedule"
		destroy-on-close
		:title="t('spacesHomeControlPlugin.schedules.title')"
		width="min(900px, 96vw)"
		:close-on-click-modal="false"
		:before-close="closeSchedule"
	>
		<space-mode-schedule-section
			v-if="occupancySupported"
			ref="scheduleSectionRef"
			:space-id="props.space.id"
		/>
	</el-dialog>
	<el-dialog
		v-model="showOccupancy"
		destroy-on-close
		:title="t('spacesHomeControlPlugin.modesLayout.presenceTitle')"
		width="min(720px, 96vw)"
		:close-on-click-modal="false"
		:before-close="closeOccupancy"
	>
		<space-occupancy-section
			v-if="occupancyEditorSpaceId === props.space.id"
			ref="occupancySectionRef"
			:space-id="props.space.id"
			:supported="occupancySupported"
		/>
	</el-dialog>

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
		<app-bar-scope @close="onCloseDrawer()">
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
		</app-bar-scope>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onScopeDispose, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDialog, ElDrawer, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarScope, SettingsLayout, type SettingsLayoutSection, SettingsSection, ViewError, useBreakpoints } from '../../../common';
import { useDevices } from '../../../modules/devices/composables/useDevices';
import { useDisplays } from '../../../modules/displays/composables/useDisplays';
import { useScenes } from '../../../modules/scenes/composables/useScenes';
import { SpaceType, useSpaces } from '../../../modules/spaces';
import {
	SpaceActivityModesSection,
	SpaceAddDeviceDialog,
	SpaceAddDisplayDialog,
	SpaceAddSceneDialog,
	SpaceDetail,
	SpaceDevicesSection,
	SpaceDisplaysSection,
	SpaceDomainsSection,
	SpaceModeScheduleSection,
	SpaceOccupancySection,
	SpaceParentZoneSection,
	SpaceScenesSection,
} from '../components/components';
import { provideSpaceSchedule } from '../composables/useSpaceModeSchedule';
import { provideSpaceOccupancy } from '../composables/useSpaceOccupancy';
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

const { fetchDevices, loaded: devicesLoaded } = useDevices();
const { fetchScenes, loaded: scenesLoaded } = useScenes();
const { fetchDisplays, isLoaded: displaysLoaded } = useDisplays();
const { fetchSpaces, firstLoadFinished: spacesFirstLoadFinished } = useSpaces();

const mounted = ref<boolean>(false);
const showDrawer = ref<boolean>(false);

const showSchedule = ref(false);
const showOccupancy = ref(false);
const showAddDeviceDialog = ref<boolean>(false);
const showAddSceneDialog = ref<boolean>(false);
const showAddDisplayDialog = ref<boolean>(false);
const displaysSectionRef = ref<InstanceType<typeof SpaceDisplaysSection> | null>(null);
const remoteFormChanged = ref<boolean>(false);
const scheduleSectionRef = ref<InstanceType<typeof SpaceModeScheduleSection> | null>(null);
const occupancySupported = computed(() => [SpaceType.ROOM, SpaceType.ZONE].includes(props.space.type));

// The anchor nav of template 5, in the order of the cards
const sections = computed<SettingsLayoutSection[]>((): SettingsLayoutSection[] => [
	{ id: 'domains', label: t('spacesModule.detail.domains.title'), icon: 'mdi:view-dashboard' },
	...(occupancySupported.value ? [{ id: 'modes', label: t('spacesHomeControlPlugin.activityModes.title'), icon: 'mdi:home-switch' }] : []),
	{ id: 'devices', label: t('spacesModule.detail.devices.title'), icon: 'mdi:devices' },
	{ id: 'scenes', label: t('spacesModule.detail.scenes.title'), icon: 'mdi:play-box-multiple' },
	{ id: 'displays', label: t('spacesModule.detail.displays.title'), icon: 'mdi:monitor' },
]);
const occupancyEditorSpaceId = ref<string | null>(null);
let occupancyTypeGeneration = 0;
const occupancySectionRef = ref<InstanceType<typeof SpaceOccupancySection> | null>(null);
// This route survives the keyed child replacement on a space-id change: ask before it commits.
const confirmScheduleDiscard = async (sections = [scheduleSectionRef.value, occupancySectionRef.value]): Promise<boolean> => {
	await Promise.all(sections.map((section) => section?.waitForSave()));
	if (!sections.some((section) => section?.hasUnsavedChanges)) return true;
	try {
		await ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
			confirmButtonText: t('spacesModule.buttons.yes.title'),
			cancelButtonText: t('spacesModule.buttons.no.title'),
			type: 'warning',
		});
		return true;
	} catch {
		return false;
	}
};
const closeSchedule = async (done: () => void): Promise<void> => {
	if (await confirmScheduleDiscard([scheduleSectionRef.value])) {
		scheduleSectionRef.value?.discard();
		done();
	}
};
const closeOccupancy = async (done: () => void): Promise<void> => {
	if (await confirmScheduleDiscard([occupancySectionRef.value])) {
		occupancySectionRef.value?.discard();
		done();
	}
};
onBeforeRouteLeave(() => confirmScheduleDiscard());
onBeforeRouteUpdate((to, from) => to.params.id === from.params.id || confirmScheduleDiscard());
// A server-side type change is authoritative. Retain the draft read-only until the user agrees to discard it.
watch(
	() => [props.space.id, props.space.type] as const,
	([id]) => {
		const generation = ++occupancyTypeGeneration;
		if (occupancySupported.value) occupancyEditorSpaceId.value = id;
		else if (occupancyEditorSpaceId.value === id) {
			void confirmScheduleDiscard([occupancySectionRef.value]).then((discard) => {
				if (discard && generation === occupancyTypeGeneration) occupancyEditorSpaceId.value = null;
			});
		} else occupancyEditorSpaceId.value = null;
	},
	{ immediate: true, flush: 'sync' }
);
onScopeDispose(() => occupancyTypeGeneration++);

const scheduleSource = provideSpaceSchedule(computed(() => (occupancySupported.value ? props.space.id : undefined)));
const occupancySource = provideSpaceOccupancy(computed(() => occupancyEditorSpaceId.value ?? undefined));
const activationSummary = (kind: 'schedule' | 'occupancy'): string => {
	const source = kind === 'schedule' ? scheduleSource : occupancySource;
	if (source.error.value) return t('spacesHomeControlPlugin.activityModes.loadFailed');
	if (source.loading.value || !source.configuration.value) return t('spacesHomeControlPlugin.activityModes.loading');
	return t(`spacesHomeControlPlugin.activityModes.${source.configuration.value.enabled ? 'enabled' : 'disabled'}`);
};

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
