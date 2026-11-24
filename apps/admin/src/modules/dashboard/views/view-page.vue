<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isPageRoute || inDrawer"
		:title="page?.title ?? ''"
		:subtitle="t('dashboardModule.subHeadings.pages.detail', { page: page?.title })"
		icon="mdi:view-dashboard"
		:actions="page ? [{ icon: 'mdi:pencil', label: t('dashboardModule.buttons.edit.title'), handler: onPageEdit }] : []"
		@back="onBack"
	>
		<template #actions>
			<el-tooltip
				v-if="page"
				:content="t('dashboardModule.buttons.edit.title')"
				placement="top"
			>
				<el-button
					:aria-label="t('dashboardModule.aria.pages.edit', { page: page.title })"
					plain
					data-test-id="page-edit"
					@click="onPageEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</el-tooltip>
		</template>
	</view-header>

	<div
		v-if="isPageRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: edit and the data source forms open next to the detail from tablet portrait up, as their own
		     page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<!-- Template 3: the summary card, then the data sources; the page scrolls as one -->
			<div
				v-if="page"
				class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto"
			>
				<page-summary
					:key="page.id"
					:page="page"
				/>

				<data-sources-card
					:items="dataSources"
					:loading="areLoading"
					@add="onDataSourceAdd"
					@edit="onDataSourceEdit"
					@remove="onDataSourceRemove"
				/>
			</div>

			<state-view
				v-else
				kind="loading"
				icon="mdi:view-dashboard"
				:title="t('dashboardModule.texts.pages.loadingPage')"
			/>

			<template #form>
				<!-- Keyed like the form: an error caught in one form does not stay over the next one -->
				<view-error :key="formKey">
					<template #icon>
						<icon icon="mdi:view-dashboard" />
					</template>
					<template #message>
						{{ t('dashboardModule.messages.misc.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="formKey"
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
		</edit-drawer-layout>
	</div>

	<router-view
		v-else
		:key="formKey"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			v-if="page"
			:page="page"
		/>
	</router-view>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, StateView, ViewError, ViewHeader, provideEditDrawer, useFlashMessage, useUuid } from '../../../common';
import DataSourcesCard from '../components/data-sources/data-sources-card.vue';
import PageSummary from '../components/pages/page-summary.vue';
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
const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

if (!validateUuid(props.id)) {
	throw new Error('Page identifier is not valid');
}

const { page, fetchPage, isLoading } = usePage({ id: props.id });

// Track if the page was loaded once, so its deletion can be told from a failed first load
const wasPageLoaded = ref<boolean>(false);

const { dataSources, areLoading, fetchDataSources } = useDataSourcesDataSource({ parent: 'page', parentId: props.id });
const dataSourcesActions = useDataSourcesActions({ parent: 'page', parentId: props.id });

const remoteFormChanged = ref<boolean>(false);

const FORM_ROUTES: string[] = [RouteNames.PAGE_EDIT, RouteNames.PAGE_ADD_DATA_SOURCE, RouteNames.PAGE_EDIT_DATA_SOURCE];

const isPageRoute = computed<boolean>((): boolean => route.name === RouteNames.PAGE);

const isFormRoute = (): boolean => route.matched.some((matched) => FORM_ROUTES.includes(String(matched.name)));

const showDrawer = ref<boolean>(isFormRoute());

// Template 4: the forms open next to this page from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isPageRoute.value);

// One form per data source (and one for edit and for Add): a new key remounts the routed form
const formKey = computed<string>(
	(): string => `${String(route.name)}:${typeof route.params?.dataSourceId === 'string' ? route.params.dataSourceId : ''}`
);

// The changed flag belongs to the form that is open. Any route change that replaces or closes it clears the flag
// before the next form mounts, so that one starts clean. A declined discard leaves the route, and the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('dashboardModule.breadcrumbs.pages.list'),
			route: router.resolve({ name: RouteNames.PAGES }),
		},
		{
			label: t('dashboardModule.breadcrumbs.pages.detail', { page: page.value?.title }),
			route: router.resolve({ name: RouteNames.PAGE, params: { id: props.id } }),
		},
	]
);

const navigate = (to: { name: string; params: Record<string, string> }): void => {
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

	navigate({ name: RouteNames.PAGE, params: { id: props.id } });

	done?.();
};

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => !showDrawer.value || !remoteFormChanged.value || confirmDiscard();

const onPageEdit = async (): Promise<void> => {
	if (route.name === RouteNames.PAGE_EDIT || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_EDIT, params: { id: props.id } });
};

const onDataSourceAdd = async (): Promise<void> => {
	if (route.name === RouteNames.PAGE_ADD_DATA_SOURCE || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_ADD_DATA_SOURCE, params: { id: props.id } });
};

const onDataSourceEdit = async (id: IDataSource['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_EDIT_DATA_SOURCE && route.params.dataSourceId === id) || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_EDIT_DATA_SOURCE, params: { id: props.id, dataSourceId: id } });
};

const onDataSourceRemove = (id: IDataSource['id']): void => {
	dataSourcesActions.remove(id);
};

const onBack = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	router.push({ name: RouteNames.PAGES });
};

onBeforeMount((): void => {
	fetchPage()
		.then((): void => {
			if (page.value !== null) {
				wasPageLoaded.value = true;
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
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = isFormRoute();
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if the page was never loaded (initial load failed)
		if (!val && page.value === null && !wasPageLoaded.value) {
			throw new DashboardException('Page not found');
		}
	}
);

watch(
	(): IPage | null => page.value,
	(val: IPage | null): void => {
		if (val !== null) {
			wasPageLoaded.value = true;
			meta.title = t('dashboardModule.meta.pages.detail.title', { page: val.title });
		} else if (wasPageLoaded.value && !isLoading.value) {
			// The page was deleted while it was open
			flashMessage.warning(t('dashboardModule.messages.pages.deletedWhileEditing'), { duration: 0 });

			router.replace({ name: RouteNames.PAGES });
		} else if (!isLoading.value && val === null && !wasPageLoaded.value) {
			throw new DashboardException('Page not found');
		}
	}
);
</script>
