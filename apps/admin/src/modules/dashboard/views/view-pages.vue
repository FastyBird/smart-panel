<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isPagesListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:view-dashboard"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('dashboardModule.headings.pages.list') }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.pages.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isPagesListRoute"
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
		v-if="!isMDDevice && isPagesListRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onPageCreate"
	>
		<span class="uppercase">{{ t('dashboardModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('dashboardModule.headings.pages.list')"
		:sub-heading="t('dashboardModule.subHeadings.pages.list')"
		icon="mdi:view-dashboard"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onPageCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('dashboardModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isPagesListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<list-pages
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="pagesPaginated"
			:all-items="pages"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			@detail="onPageDetail"
			@edit="onPageEdit"
			@remove="onPageRemove"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
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
				<list-pages-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:view-dashboard" />
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

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { useDisplays } from '../../displays';
import { ListPages, ListPagesAdjust } from '../components/components';
import { usePagesActions, usePagesDataSource } from '../composables/composables';
import { RouteNames } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import type { IPage } from '../store/pages.store.types';

import type { IViewPagesProps } from './view-pages.types';

defineOptions({
	name: 'ViewPages',
});

const props = defineProps<IViewPagesProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('dashboardModule.meta.pages.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const { fetchPages, pages, pagesPaginated, totalRows, filters, filtersActive, sortBy, sortDir, paginateSize, paginatePage, areLoading, resetFilter } =
	usePagesDataSource();
const pageActions = usePagesActions();
const { fetchDisplays } = useDisplays();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isPagesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.PAGES;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('dashboardModule.breadcrumbs.pages.list'),
				route: router.resolve({ name: RouteNames.PAGES }),
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
			ElMessageBox.confirm(t('dashboardModule.texts.misc.confirmDiscard'), t('dashboardModule.headings.misc.discard'), {
				confirmButtonText: t('dashboardModule.buttons.yes.title'),
				cancelButtonText: t('dashboardModule.buttons.no.title'),
				type: 'warning',
			})
				.then((): void => {
					if (isLGDevice.value) {
						router.replace({
							name: RouteNames.PAGES,
						});
					} else {
						router.push({
							name: RouteNames.PAGES,
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
					name: RouteNames.PAGES,
				});
			} else {
				router.push({
					name: RouteNames.PAGES,
				});
			}

			done?.();
		}
	}
};

const onPageDetail = (id: IPage['id']): void => {
	router.push({
		name: RouteNames.PAGE,
		params: {
			id,
		},
	});
};

const onPageEdit = (id: IPage['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGES_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.PAGES_EDIT,
			params: {
				id,
			},
		});
	}
};

const onPageRemove = (id: IPage['id']): void => {
	pageActions.remove(id);
};

const onResetFilters = (): void => {
	resetFilter();
};

const onPageCreate = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGES_ADD,
		});
	} else {
		router.push({
			name: RouteNames.PAGES_ADD,
		});
	}
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchPages().catch((error: unknown): void => {
		const err = error as Error;

		throw new DashboardException('Something went wrong', err);
	});

	fetchDisplays().catch((error: unknown): void => {
		const err = error as Error;

		throw new DashboardException('Something went wrong', err);
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.PAGES_ADD || matched.name === RouteNames.PAGES_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.PAGES_ADD || matched.name === RouteNames.PAGES_EDIT) !== undefined;
	}
);
</script>
