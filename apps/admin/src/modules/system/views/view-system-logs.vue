<template>
	<template v-if="twoPane || !detailId">
		<app-breadcrumbs :items="breadcrumbs" />

		<view-header
			:title="t('systemModule.headings.systemLogs.list')"
			:subtitle="t('systemModule.subHeadings.systemLogs.list')"
			icon="mdi:console"
			:actions="[
				{
					icon: live ? 'mdi:pause' : 'mdi:play',
					label: live ? t('systemModule.buttons.pauseLiveTail.title') : t('systemModule.buttons.liveTail.title'),
					handler: () => (live = !live),
				},
				{ icon: 'mdi:refresh', label: t('systemModule.buttons.refresh.title'), handler: onRefresh },
			]"
		>
			<template #actions>
				<el-switch
					v-model="live"
					:active-text="t('systemModule.buttons.liveTail.title')"
					class="mr-3"
					data-test-id="system-logs-live"
				/>

				<el-button
					plain
					data-test-id="system-logs-refresh"
					@click="onRefresh"
				>
					<template #icon>
						<icon icon="mdi:refresh" />
					</template>

					{{ t('systemModule.buttons.refresh.title') }}
				</el-button>
			</template>
		</view-header>
	</template>

	<!-- Template 7 from tablet landscape: the entries in a 320 px pane and the open one beside it, each scrolling on its
	     own. Below it the list, and the entry as a page of its own -->
	<div
		v-if="twoPane"
		class="page-pad flex gap-4 flex-1 min-h-0 box-border"
		data-test-id="system-logs-two-pane"
	>
		<section
			:aria-label="t('systemModule.headings.systemLogs.list')"
			class="flex flex-col w-[320px] shrink-0 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden"
		>
			<list-filter-bar
				v-model:search="search"
				:search-placeholder="t('systemModule.fields.systemLogs.search.placeholder')"
				:active-count="activeCount"
				@reset="onResetFilters"
			>
				<template #filters>
					<system-logs-filters v-model:filters="filters" />
				</template>
			</list-filter-bar>

			<div class="flex flex-col flex-1 min-h-0 overflow-y-auto">
				<system-logs-list
					:items="systemLogs"
					:active-id="detailId"
					:loading="areLoading && !loadFailed"
					:filters-active="filtersActive"
					:has-more="hasMore"
					:failed="loadFailed"
					@open="onOpen"
					@load-more="onLoadMore"
					@reset-filters="onResetFilters"
					@retry="onRefresh"
				/>
			</div>
		</section>

		<section class="flex flex-col flex-1 min-w-0 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden">
			<router-view v-slot="{ Component }">
				<component
					:is="Component"
					v-if="Component"
					:key="detailId ?? undefined"
					in-pane
				/>
				<state-view
					v-else
					kind="empty"
					icon="mdi:note-text-outline"
					:title="t('systemModule.texts.systemLogs.selectOne')"
					data-test-id="system-logs-no-selection"
				/>
			</router-view>
		</section>
	</div>

	<router-view
		v-else-if="detailId"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			:key="detailId"
		/>
	</router-view>

	<div
		v-else
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<section class="flex flex-col flex-1 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden">
			<list-filter-bar
				v-model:search="search"
				:search-placeholder="t('systemModule.fields.systemLogs.search.placeholder')"
				:active-count="activeCount"
				@reset="onResetFilters"
			>
				<template #filters>
					<system-logs-filters v-model:filters="filters" />
				</template>
			</list-filter-bar>

			<div class="flex flex-col flex-1 min-h-0 overflow-y-auto">
				<system-logs-list
					:items="systemLogs"
					:loading="areLoading && !loadFailed"
					:filters-active="filtersActive"
					:has-more="hasMore"
					:failed="loadFailed"
					@open="onOpen"
					@load-more="onLoadMore"
					@reset-filters="onResetFilters"
					@retry="onRefresh"
				/>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElButton, ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, ListFilterBar, StateView, ViewHeader, useFlashMessage, useSizeClass } from '../../../common';
import { SystemLogsFilters, SystemLogsList } from '../components/components';
import { useSystemLogsDataSource } from '../composables/useSystemLogsDataSource';
import type { ILogEntry } from '../store/logs-entries.store.types';
import { RouteNames } from '../system.constants';

import type { IViewSystemLogsProps } from './view-system-logs.types';

defineOptions({
	name: 'ViewSystemLogs',
});

// The open entry's id comes with the route too; the view reads it from the route, as the child route may be any
defineProps<IViewSystemLogsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

const { isPhone, isTabletPortrait } = useSizeClass();

const { fetchSystemLogs, loadMoreSystemLogs, systemLogs, hasMore, filters, live, filtersActive, areLoading, resetFilter, refreshSystemLogs } =
	useSystemLogsDataSource();

// Template 7: two panes from tablet landscape; below it the list, then the entry as a page of its own
const twoPane = computed<boolean>((): boolean => !isPhone.value && !isTabletPortrait.value);

const detailId = computed<ILogEntry['id'] | null>((): ILogEntry['id'] | null =>
	route.name === RouteNames.SYSTEM_LOG_DETAIL && typeof route.params.id === 'string' ? route.params.id : null
);

const search = computed<string>({
	get: (): string => filters.value.search ?? '',
	set: (value: string): void => {
		filters.value.search = value === '' ? undefined : value;
	},
});

// The drawer's filters, the search left out: it is visible in the bar on its own
const activeCount = computed<number>(
	(): number => (filters.value.levels.length > 0 ? 1 : 0) + (filters.value.sources.length > 0 ? 1 : 0) + (filters.value.tag ? 1 : 0)
);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => [
	{
		label: t('systemModule.breadcrumbs.system.system'),
		route: router.resolve({ name: RouteNames.SYSTEM }),
	},
	{
		label: t('systemModule.breadcrumbs.systemLogs.list'),
		route: router.resolve({ name: RouteNames.SYSTEM_LOGS }),
	},
]);

// The query carries the list's filters, so the list reads the same when the entry is left again
const onOpen = (id: ILogEntry['id']): void => {
	void router.push({ name: RouteNames.SYSTEM_LOG_DETAIL, params: { id }, query: route.query });
};

const onResetFilters = (): void => {
	resetFilter();
};

// The last read of the entries failed; with none on screen the list says so and offers a retry
const loadFailed = ref<boolean>(false);

const reportError = (): void => {
	flashMessage.error(t('systemModule.messages.misc.requestError'));
};

const read = (request: () => Promise<void>): void => {
	request()
		.then((): void => {
			loadFailed.value = false;
		})
		.catch((): void => {
			loadFailed.value = true;

			reportError();
		});
};

const onLoadMore = (): void => {
	read(loadMoreSystemLogs);
};

const onRefresh = (): void => {
	read(refreshSystemLogs);
};

onBeforeMount((): void => {
	read(fetchSystemLogs);
});

useMeta({
	title: t('systemModule.meta.systemLogs.list.title'),
});
</script>
