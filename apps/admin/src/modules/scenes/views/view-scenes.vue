<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isScenesListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:play-box-multiple"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('scenes.headings.list') }}
		</template>

		<template #subtitle>
			{{ t('scenes.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isScenesListRoute"
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
		v-if="!isMDDevice && isScenesListRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSceneCreate"
	>
		<span class="uppercase">{{ t('scenes.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('scenes.headings.list')"
		:sub-heading="t('scenes.subHeadings.list')"
		icon="mdi:play-box-multiple"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onSceneCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('scenes.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isScenesListRoute || isLGDevice"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<list-scenes
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="scenesPaginated"
			:all-items="scenes"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			:triggering="triggering"
			@edit="onSceneEdit"
			@remove="onSceneRemove"
			@trigger="onSceneTrigger"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
			@bulk-action="onBulkAction"
		/>
	</div>

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
				<list-scenes-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:play-box-multiple" />
					</template>
					<template #message>
						{{ t('scenes.messages.requestError') }}
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
import { computed, onBeforeMount, onMounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useFlashMessage, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import { ListScenes, ListScenesAdjust } from '../components/components';
import { useScenesActions, useScenesDataSource, useScenes } from '../composables/composables';
import { RouteNames } from '../scenes.constants';
import { ScenesException } from '../scenes.exceptions';
import type { IScene } from '../store/scenes.store.types';

import type { IViewScenesProps } from './view-scenes.types';

defineOptions({
	name: 'ViewScenes',
});

const props = defineProps<IViewScenesProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const flashMessage = useFlashMessage();

useMeta({
	title: t('scenes.headings.list'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	fetchScenes,
	scenes,
	scenesPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
} = useScenesDataSource();

const { triggerScene, removeScene } = useScenes();
const { spaces, fetchSpaces } = useSpaces();

const sceneActions = useScenesActions();

// Provide spaces to child components (for table space display)
const allSpaces = computed(() => {
	return spaces.value
		.map((space) => ({ id: space.id, name: space.name }))
		.sort((a, b) => a.name.localeCompare(b.name));
});
provide('spaces', allSpaces);

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);
const triggering = ref<IScene['id'][]>([]);

const remoteFormChanged = ref<boolean>(false);

const isScenesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SCENES;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('scenes.breadcrumbs.scenes'),
				route: router.resolve({ name: RouteNames.SCENES }),
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
			ElMessageBox.confirm(t('scenes.texts.confirmDiscard'), t('scenes.headings.discard'), {
			confirmButtonText: t('scenes.buttons.yes.title'),
			cancelButtonText: t('scenes.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.SCENES,
						});
					} else {
						router.push({
							name: RouteNames.SCENES,
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
					name: RouteNames.SCENES,
				});
			} else {
				router.push({
					name: RouteNames.SCENES,
				});
			}

			done?.();
		}
	}
};

const onSceneEdit = (id: IScene['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SCENES_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.SCENES_EDIT,
			params: {
				id,
			},
		});
	}
};

const onSceneRemove = async (id: IScene['id']): Promise<void> => {
	const scene = scenes.value.find((s) => s.id === id);

	if (!scene) {
		return;
	}

	try {
		await ElMessageBox.confirm(t('scenes.messages.confirmDelete', { name: scene.name }), t('scenes.headings.delete'), {
		confirmButtonText: t('scenes.buttons.delete.title'),
		cancelButtonText: t('scenes.buttons.cancel.title'),
			type: 'warning',
		});

		await removeScene(id);
		flashMessage.success(t('scenes.messages.deleted'));
	} catch (error) {
		// ElMessageBox.confirm rejects with 'cancel' when user cancels
		if (error !== 'cancel') {
			flashMessage.error(t('scenes.messages.deleteFailed'));
		}
	}
};

const onSceneTrigger = async (id: IScene['id']): Promise<void> => {
	const scene = scenes.value.find((s) => s.id === id);

	if (!scene) {
		return;
	}

	triggering.value.push(id);

	try {
		await triggerScene(id, 'admin');
		flashMessage.success(t('scenes.messages.triggered', { name: scene.name }));
	} catch {
		flashMessage.error(t('scenes.messages.triggerFailed'));
	} finally {
		triggering.value = triggering.value.filter((triggerId) => triggerId !== id);
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

const onSceneCreate = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SCENES_ADD,
		});
	} else {
		router.push({
			name: RouteNames.SCENES_ADD,
		});
	}
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

const onBulkAction = (action: string, items: IScene[]): void => {
	switch (action) {
		case 'delete':
			sceneActions.bulkRemove(items);
			break;
		case 'enable':
			sceneActions.bulkEnable(items);
			break;
		case 'disable':
			sceneActions.bulkDisable(items);
			break;
	}
};

onBeforeMount((): void => {
	Promise.all([fetchScenes(), fetchSpaces()]).catch((error: unknown): void => {
		const err = error as Error;

		throw new ScenesException('Something went wrong', err);
	});

	showDrawer.value =
		route.matched.find((matched) => matched.name === RouteNames.SCENES_ADD || matched.name === RouteNames.SCENES_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.SCENES_ADD || matched.name === RouteNames.SCENES_EDIT) !== undefined;
	}
);
</script>
