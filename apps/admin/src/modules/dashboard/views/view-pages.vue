<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isPagesListRoute || inDrawer"
		:title="t('dashboardModule.headings.pages.list')"
		:subtitle="t('dashboardModule.subHeadings.pages.list')"
		icon="mdi:view-dashboard"
		:actions="[
			{ icon: 'mdi:magnify', label: t('dashboardModule.fields.pages.search.placeholder'), handler: onSearch },
			{ icon: 'mdi:plus', label: t('dashboardModule.buttons.add.title'), handler: onPageCreate },
		]"
	>
		<template #actions>
			<el-button
				type="primary"
				plain
				data-test-id="pages-add"
				@click="onPageCreate"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>

				{{ t('dashboardModule.buttons.add.title') }}
			</el-button>
		</template>
	</view-header>

	<div
		v-if="isPagesListRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: add and edit open next to the list from tablet portrait up, as their own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<list-pages
				ref="list"
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
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
			/>

			<template #form>
				<view-error>
					<template #icon>
						<icon icon="mdi:view-dashboard" />
					</template>
					<template #message>
						{{ t('dashboardModule.messages.misc.requestError') }}
					</template>

					<!-- Keyed by the page: switching to another page remounts the editor, so its save goes to the page now
					     shown and not to the one opened first -->
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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, ViewError, ViewHeader, provideEditDrawer } from '../../../common';
import { useDisplays } from '../../displays';
import { ListPages } from '../components/components';
import { usePagesActions, usePagesDataSource } from '../composables/composables';
import { RouteNames } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import type { IPage } from '../store/pages.store.types';

import type { IViewPagesProps } from './view-pages.types';

defineOptions({
	name: 'ViewPages',
});

defineProps<IViewPagesProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('dashboardModule.meta.pages.list.title'),
});

const { fetchPages, pages, pagesPaginated, totalRows, filters, filtersActive, sortBy, sortDir, paginateSize, paginatePage, areLoading, resetFilter } =
	usePagesDataSource();
const pageActions = usePagesActions();
const { fetchDisplays } = useDisplays();

const list = ref<InstanceType<typeof ListPages> | null>(null);

const remoteFormChanged = ref<boolean>(false);

const isPagesListRoute = computed<boolean>((): boolean => route.name === RouteNames.PAGES);

const isFormRoute = (): boolean =>
	route.matched.find((matched) => matched.name === RouteNames.PAGES_ADD || matched.name === RouteNames.PAGES_EDIT) !== undefined;

const showDrawer = ref<boolean>(isFormRoute());

// Template 4: forms open next to this page from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isPagesListRoute.value);

// One editor per page (and one for Add): a new key remounts the routed form
const formKey = computed<string>((): string => `${String(route.name)}:${typeof route.params?.id === 'string' ? route.params.id : ''}`);

// The changed flag belongs to the editor that is open. Any route change that replaces or closes it clears the flag
// before the next editor mounts, so that one starts clean. A declined discard leaves the route, and the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
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

const navigate = (to: { name: string; params?: Record<string, string> }): void => {
	if (inDrawer.value) {
		router.replace(to);
	} else {
		router.push(to);
	}
};

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('dashboardModule.texts.misc.confirmDiscard'), t('dashboardModule.headings.misc.discard'), {
			confirmButtonText: t('dashboardModule.buttons.discard.title'),
			cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
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

	navigate({ name: RouteNames.PAGES });

	done?.();
};

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => !showDrawer.value || !remoteFormChanged.value || confirmDiscard();

const onPageDetail = async (id: IPage['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	router.push({ name: RouteNames.PAGE, params: { id } });
};

const onPageEdit = async (id: IPage['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGES_EDIT && route.params.id === id) || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGES_EDIT, params: { id } });
};

const onPageCreate = async (): Promise<void> => {
	if (route.name === RouteNames.PAGES_ADD || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGES_ADD });
};

const onPageRemove = (id: IPage['id']): void => {
	pageActions.remove(id);
};

const onBulkAction = (action: string, items: IPage[]): void => {
	if (action === 'delete') {
		pageActions.bulkRemove(items);
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
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
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = isFormRoute();
	}
);
</script>
