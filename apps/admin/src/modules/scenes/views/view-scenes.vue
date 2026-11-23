<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isScenesListRoute || inDrawer"
		:title="t('scenes.headings.list')"
		:subtitle="t('scenes.subHeadings.list')"
		icon="mdi:play-box-multiple"
		:actions="[
			{ icon: 'mdi:magnify', label: t('scenes.fields.search.placeholder'), handler: onSearch },
			{ icon: 'mdi:plus', label: t('scenes.buttons.add.title'), handler: onSceneCreate },
		]"
	>
		<template #actions>
			<el-button
				type="primary"
				plain
				data-test-id="scenes-add"
				@click="onSceneCreate"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>

				{{ t('scenes.buttons.add.title') }}
			</el-button>
		</template>
	</view-header>

	<div
		v-if="isScenesListRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: add and edit open next to the list from tablet portrait up, as their own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<list-scenes
				ref="list"
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
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
			/>

			<template #form>
				<view-error>
					<template #icon>
						<icon icon="mdi:play-box-multiple" />
					</template>
					<template #message>
						{{ t('scenes.messages.requestError') }}
					</template>

					<!-- Keyed by the scene: switching to another scene remounts the editor, so its save goes to the scene
					     now shown and not to the one opened first -->
					<suspense>
						<router-view
							:key="formKey"
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
		</edit-drawer-layout>
	</div>

	<router-view
		v-else
		:key="formKey"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, ViewError, ViewHeader, provideEditDrawer, useFlashMessage } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import { ListScenes } from '../components/components';
import { useScenes, useScenesActions, useScenesDataSource } from '../composables/composables';
import { RouteNames } from '../scenes.constants';
import { ScenesException } from '../scenes.exceptions';
import type { IScene } from '../store/scenes.store.types';

import type { IViewScenesProps } from './view-scenes.types';

defineOptions({
	name: 'ViewScenes',
});

defineProps<IViewScenesProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const flashMessage = useFlashMessage();

useMeta({
	title: t('scenes.headings.list'),
});

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
	return spaces.value.map((space) => ({ id: space.id, name: space.name })).sort((a, b) => a.name.localeCompare(b.name));
});
provide('spaces', allSpaces);

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const list = ref<InstanceType<typeof ListScenes> | null>(null);
const triggering = ref<IScene['id'][]>([]);

const remoteFormChanged = ref<boolean>(false);

const isScenesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SCENES;
});

// Template 4: forms open next to this page from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isScenesListRoute.value);

// One editor per scene (and one for Add): a new key remounts the routed form
const formKey = computed<string>((): string => `${String(route.name)}:${typeof route.params?.id === 'string' ? route.params.id : ''}`);

// The changed flag belongs to the editor that is open. Any route change that replaces or closes it (Edit, Add, the
// drawer's close, the editor's own Close and Discard, the browser's back) clears the flag before the next editor
// mounts, so that one starts clean. A declined discard leaves the route, and with it the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
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

const leaveForm = (): void => {
	if (inDrawer.value) {
		router.replace({ name: RouteNames.SCENES });
	} else {
		router.push({ name: RouteNames.SCENES });
	}
};

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('scenes.texts.confirmDiscard'), t('scenes.headings.discard'), {
			confirmButtonText: t('scenes.buttons.yes.title'),
			cancelButtonText: t('scenes.buttons.no.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const onCloseDrawer = async (done?: () => void): Promise<void> => {
	if (remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	leaveForm();

	done?.();
};

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => !showDrawer.value || !remoteFormChanged.value || confirmDiscard();

const onSceneEdit = async (id: IScene['id']): Promise<void> => {
	if ((route.name === RouteNames.SCENES_EDIT && route.params.id === id) || !(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
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

const onSceneCreate = async (): Promise<void> => {
	if (route.name === RouteNames.SCENES_ADD || !(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.SCENES_ADD,
		});
	} else {
		router.push({
			name: RouteNames.SCENES_ADD,
		});
	}
};

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
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

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.SCENES_ADD || matched.name === RouteNames.SCENES_EDIT) !== undefined;
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
