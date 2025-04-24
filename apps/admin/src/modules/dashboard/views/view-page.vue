<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isPageRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:monitor-dashboard"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('dashboardModule.headings.pages.detail', { page: page?.title }) }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.pages.detail', { page: page?.title }) }}
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

	<app-bar-button
		v-if="!isMDDevice && isPageRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onDataSourceAdd"
	>
		<span class="uppercase">{{ t('dashboardModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('dashboardModule.headings.pages.detail', { page: page?.title })"
		:sub-heading="t('dashboardModule.subHeadings.pages.detail', { page: page?.title })"
		icon="mdi:monitor-dashboard"
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
					@click="onPageEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</div>
		</template>
	</view-header>

	<el-scrollbar
		v-if="isPageRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2"
		view-class="overflow-hidden"
	>
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
			class="mb-2"
			@edit="onDataSourceEdit"
			@remove="onDataSourceRemove"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
		/>
	</el-scrollbar>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			v-if="page"
			:page="page"
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
						<icon icon="mdi:monitor-dashboard" />
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
								v-if="page"
								v-model:remote-form-changed="remoteFormChanged"
								:page="page"
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

import { ElButton, ElDrawer, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

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
	useUuid,
} from '../../../common';
import ListDataSourcesAdjust from '../components/data-sources/list-data-sources-adjust.vue';
import ListDataSources from '../components/data-sources/list-data-sources.vue';
import { useDataSourcesActions } from '../composables/useDataSourcesActions';
import { useDataSourcesDataSource } from '../composables/useDataSourcesDataSource';
import { usePage } from '../composables/usePage';
import { RouteNames } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import type { IDataSource } from '../store/data-sources.store.types';
import type { IPage } from '../store/pages.store.types';

import type { IViewPageProps } from './view-page.types';

defineOptions({
	name: 'ViewPage',
});

const props = defineProps<IViewPageProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { page, fetchPage, isLoading } = usePage({ id: props.id });
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
} = useDataSourcesDataSource({ parent: 'page', parentId: props.id });
const dataSourcesActions = useDataSourcesActions({ parent: 'page', parentId: props.id });

if (!validateUuid(props.id)) {
	throw new Error('Page identifier is not valid');
}

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isPageRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.PAGE;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('dashboardModule.breadcrumbs.pages.list'),
				route: router.resolve({ name: RouteNames.PAGES }),
			},
			{
				label: t('dashboardModule.breadcrumbs.pages.detail', { page: page.value?.title }),
				route: router.resolve({ name: RouteNames.PAGE, params: { id: props.id } }),
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
							name: RouteNames.PAGE,
							params: {
								id: props.id,
							},
						});
					} else {
						router.push({
							name: RouteNames.PAGE,
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
					name: RouteNames.PAGE,
					params: {
						id: props.id,
					},
				});
			} else {
				router.push({
					name: RouteNames.PAGE,
					params: {
						id: props.id,
					},
				});
			}

			done?.();
		}
	}
};

const onPageEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGE_EDIT,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.PAGE_EDIT,
			params: {
				id: props.id,
			},
		});
	}
};

const onDataSourceAdd = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGE_ADD_DATA_SOURCE,
			params: {
				id: props.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.PAGE_ADD_DATA_SOURCE,
			params: {
				id: props.id,
			},
		});
	}
};

const onDataSourceEdit = (id: IDataSource['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGE_EDIT_DATA_SOURCE,
			params: {
				id: props.id,
				dataSourceId: id,
			},
		});
	} else {
		router.push({
			name: RouteNames.PAGE_EDIT_DATA_SOURCE,
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

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGES,
		});
	} else {
		router.push({
			name: RouteNames.PAGES,
		});
	}
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchPage()
		.then((): void => {
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
				matched.name === RouteNames.PAGE_EDIT || matched.name === RouteNames.PAGE_ADD_DATA_SOURCE || matched.name === RouteNames.PAGE_EDIT_DATA_SOURCE
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
					matched.name === RouteNames.PAGE_EDIT ||
					matched.name === RouteNames.PAGE_ADD_DATA_SOURCE ||
					matched.name === RouteNames.PAGE_EDIT_DATA_SOURCE
			) !== undefined;
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && page.value === null) {
			throw new DashboardException('Page not found');
		}
	}
);

watch(
	(): IPage | null => page.value,
	(val: IPage | null): void => {
		if (val !== null) {
			meta.title = t('dashboardModule.meta.pages.detail.title', { page: page.value?.title });
		}

		if (!isLoading.value && val === null) {
			throw new DashboardException('Page not found');
		}
	}
);
</script>
