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
					@click="onDelete"
				>
					<template #icon>
						<icon icon="mdi:trash" />
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
			</el-descriptions>

			<!-- Devices Section -->
			<space-devices-section
				:space-id="space.id"
				:space-type="space.type"
			/>

			<!-- Parent Zone Section (Room only) -->
			<space-parent-zone-section
				v-if="space.type === SpaceType.ROOM"
				:space="space"
			/>

			<!-- Displays Section -->
			<space-displays-section
				:space-id="space.id"
			/>
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
	ElScrollbar,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBar,
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	ViewError,
	ViewHeader,
	useBreakpoints,
	useFlashMessage,
} from '../../../common';
import {
	SpaceDevicesSection,
	SpaceDisplaysSection,
	SpaceParentZoneSection,
} from '../components/components';
import { useSpace } from '../composables';
import { RouteNames, SpaceType } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';
import type { ISpace } from '../store';

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

const spaceId = computed(() => (props.id || route.params.id) as string | undefined);

const { space, fetching, fetchSpace, removeSpace } = useSpace(spaceId);

const isLoading = computed<boolean>(() => fetching.value);

// Track if space was previously loaded to detect deletion
const wasSpaceLoaded = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const isSpaceRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACE;
});

const spaceIcon = computed<string>((): string => {
	if (space.value?.icon) {
		return space.value.icon;
	}
	return space.value?.type === 'room' ? 'mdi:door' : 'mdi:home-floor-1';
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

const onEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SPACE_EDIT,
			params: {
				id: spaceId.value,
			},
			state: {
				fromDetail: true,
			},
		});
	} else {
		router.push({
			name: RouteNames.SPACE_EDIT,
			params: {
				id: spaceId.value,
			},
			state: {
				fromDetail: true,
			},
		});
	}
};

const onDelete = async (): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('spacesModule.messages.confirmDelete'), {
			type: 'warning',
		});

		await removeSpace();
		flashMessage.success(t('spacesModule.messages.removed', { space: space.value?.name }));

		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACES });
		} else {
			router.push({ name: RouteNames.SPACES });
		}
	} catch (error: unknown) {
		if (error instanceof SpacesApiException) {
			flashMessage.error(error.message);
		}
		// Otherwise user cancelled - ignore
	}
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
