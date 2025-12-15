<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isTileRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:widget-tree"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('dashboardModule.headings.tiles.detail') }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.tiles.detail') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isTileRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onDataSourceAdd"
	>
		<span class="uppercase">{{ t('dashboardModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('dashboardModule.headings.tiles.detail')"
		:sub-heading="t('dashboardModule.subHeadings.tiles.detail')"
		icon="mdi:widget-tree"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onDataSourceAdd"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('dashboardModule.buttons.addDataSource.title') }}
				</el-button>
				<el-button
					plain
					class="px-4! ml-2!"
					@click="onTileEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isTileRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<el-card
			v-if="tile"
			class="mt-2"
			body-class="p-0!"
		>
			<tile-detail :tile="tile" />
		</el-card>

		<list-data-sources
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="dataSourcesPaginated"
			:all-items="dataSources"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			@edit="onDataSourceEdit"
			@remove="onDataSourceRemove"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
		/>
	</div>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			v-if="tile"
			:tile="tile"
		/>
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
				<list-data-sources-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:widget-tree" />
					</template>
					<template #message>
						{{ t('dashboardModule.messages.misc.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="props.id"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-if="tile"
								v-model:remote-form-changed="remoteFormChanged"
								:tile="tile"
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

import { ElButton, ElCard, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

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
	useUuid,
} from '../../../common';
import ListDataSourcesAdjust from '../components/data-sources/list-data-sources-adjust.vue';
import ListDataSources from '../components/data-sources/list-data-sources.vue';
import TileDetail from '../components/tiles/tile-detail.vue';
import { useDataSourcesActions } from '../composables/useDataSourcesActions';
import { useDataSourcesDataSource } from '../composables/useDataSourcesDataSource';
import { useTile } from '../composables/useTile';
import { RouteNames } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import type { IDataSource } from '../store/data-sources.store.types';
import type { ITile } from '../store/tiles.store.types';

import type { IViewTileProps } from './view-tile.types';

defineOptions({
	name: 'ViewTile',
});

const props = defineProps<IViewTileProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();
const { meta } = useMeta({});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { tile, fetchTile, isLoading } = useTile({ id: props.id });

// Track if tile was previously loaded to detect deletion
const wasTileLoaded = ref<boolean>(false);
// Track parent page ID before deletion for redirect
const parentPageId = ref<string | null>(null);
const {
	dataSources,
	dataSourcesPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	fetchDataSources,
	resetFilter,
} = useDataSourcesDataSource({ parent: 'tile', parentId: props.id });
const dataSourcesActions = useDataSourcesActions({ parent: 'tile', parentId: props.id });

if (!validateUuid(props.id)) {
	throw new Error('Tile identifier is not valid');
}

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isTileRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.TILE;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('dashboardModule.breadcrumbs.tiles.detail'),
				route: router.resolve({ name: RouteNames.TILE, params: { id: props.id } }),
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
			ElMessageBox.confirm(t('dashboardModule.messages.tests.confirmDiscard'), t('dashboardModule.headings.misc.discard'), {
				confirmButtonText: t('dashboardModule.buttons.yes.title'),
				cancelButtonText: t('dashboardModule.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.TILE,
							params: {
								id: props.id,
							},
						});
					} else {
						router.push({
							name: RouteNames.TILE,
							params: {
								id: props.id,
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
					name: RouteNames.TILE,
					params: {
						id: props.id,
					},
				});
			} else {
				router.push({
					name: RouteNames.TILE,
					params: {
						id: props.id,
					},
				});
			}

			done?.();
		}
	}
};

const onTileEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.TILE_EDIT,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.TILE_EDIT,
			params: {
				id: props.id,
			},
		});
	}
};

const onDataSourceAdd = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.TILE_ADD_DATA_SOURCE,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.TILE_ADD_DATA_SOURCE,
			params: {
				id: props.id,
			},
		});
	}
};

const onDataSourceEdit = (id: IDataSource['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.TILE_EDIT_DATA_SOURCE,
			params: {
				id: props.id,
				dataSourceId: id,
			},
		});
	} else {
		router.push({
			name: RouteNames.TILE_EDIT_DATA_SOURCE,
			params: {
				id: props.id,
				dataSourceId: id,
			},
		});
	}
};

const onDataSourceRemove = (id: IDataSource['id']): void => {
	dataSourcesActions.remove(id);
};

const onResetFilters = (): void => {
	resetFilter();
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchTile()
		.then((): void => {
			// Mark as loaded if tile was successfully fetched
			if (tile.value !== null) {
				wasTileLoaded.value = true;
			}

			fetchDataSources().catch((error: unknown): void => {
				const err = error as Error;

				throw new DashboardException('Something went wrong', err);
			});
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			throw new DashboardException('Something went wrong', err);
		});

	showDrawer.value =
		route.matched.find(
			(matched) =>
				matched.name === RouteNames.TILE_EDIT || matched.name === RouteNames.TILE_ADD_DATA_SOURCE || matched.name === RouteNames.TILE_EDIT_DATA_SOURCE
		) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find(
				(matched) =>
					matched.name === RouteNames.TILE_EDIT ||
					matched.name === RouteNames.TILE_ADD_DATA_SOURCE ||
					matched.name === RouteNames.TILE_EDIT_DATA_SOURCE
			) !== undefined;
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if tile was never loaded (initial load failed)
		if (!val && tile.value === null && !wasTileLoaded.value) {
			throw new DashboardException('Tile not found');
		}
	}
);

watch(
	(): ITile | null => tile.value,
	(val: ITile | null): void => {
		if (val !== null) {
			wasTileLoaded.value = true;
			// Capture parent page ID before deletion
			if (val.parent?.type === 'page' && val.parent?.id) {
				parentPageId.value = val.parent.id;
			}
			meta.title = t('dashboardModule.meta.tiles.detail.title');
		} else if (wasTileLoaded.value && !isLoading.value) {
			// Tile was previously loaded but is now null - it was deleted
			flashMessage.warning(t('dashboardModule.messages.tiles.deletedWhileEditing'), { duration: 0 });
			// Redirect to parent page if available, otherwise to pages list
			if (parentPageId.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: parentPageId.value } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: parentPageId.value } });
				}
			} else {
				// Fallback to pages list if parent not available
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.PAGES });
				} else {
					router.push({ name: RouteNames.PAGES });
				}
			}
		} else if (!isLoading.value && val === null && !wasTileLoaded.value) {
			// Tile was never loaded - initial load failed
			throw new DashboardException('Tile not found');
		}
	}
);
</script>
