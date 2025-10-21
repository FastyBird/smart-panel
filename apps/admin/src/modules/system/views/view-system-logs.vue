<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:hammer"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('systemModule.headings.systemLogs.list') }}
		</template>

		<template #subtitle>
			{{ t('systemModule.subHeadings.systemLogs.list') }}
		</template>
	</app-bar-heading>

	<view-header
		:heading="t('systemModule.headings.systemLogs.list')"
		:sub-heading="t('systemModule.subHeadings.systemLogs.list')"
		icon="mdi:console"
	/>

	<div
		v-if="isSystemLogsRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<list-system-logs
			v-model:filters="filters"
			v-model:live="live"
			:items="systemLogs"
			:loading="areLoading"
			:filters-active="filtersActive"
			:has-more="hasMore"
			@detail="onLogEntryDetail"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
			@load-more="onLoadMore"
			@refresh="onRefresh"
			@clear="onClearSystemLogs"
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
				<list-system-logs-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon icon="mdi:console" />
					</template>
					<template #message>
						{{ t('systemModule.messages.misc.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="props.id"
							v-slot="{ Component }"
						>
							<component :is="Component" />
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
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElDrawer, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { ListSystemLogs, ListSystemLogsAdjust } from '../components/components';
import { useSystemLogsDataSource } from '../composables/useSystemLogsDataSource';
import type { ILogEntry } from '../store/logs-entries.store.types';
import { RouteNames } from '../system.constants';
import { SystemException } from '../system.exceptions';

import type { IViewSystemLogsProps } from './view-system-logs.types';

defineOptions({
	name: 'ViewSystemLogs',
});

const props = defineProps<IViewSystemLogsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { fetchSystemLogs, loadMoreSystemLogs, systemLogs, hasMore, filters, live, filtersActive, areLoading, resetFilter, refreshSystemLogs } =
	useSystemLogsDataSource();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const isSystemLogsRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SYSTEM_LOGS;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	return [
		{
			label: t('systemModule.breadcrumbs.system.system'),
			route: router.resolve({ name: RouteNames.SYSTEM }),
		},
		{
			label: t('systemModule.breadcrumbs.systemLogs.list'),
			route: router.resolve({ name: RouteNames.SYSTEM_LOGS }),
		},
	];
});

const onCloseDrawer = (done?: () => void): void => {
	if (adjustList.value) {
		showDrawer.value = false;
		adjustList.value = false;

		done?.();
	} else {
		if (isLGDevice.value) {
			router.replace({
				name: RouteNames.SYSTEM_LOGS,
			});
		} else {
			router.push({
				name: RouteNames.SYSTEM_LOGS,
			});
		}

		done?.();
	}
};

const onLogEntryDetail = (id: ILogEntry['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SYSTEM_LOG_DETAIL,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.SYSTEM_LOG_DETAIL,
			params: {
				id,
			},
		});
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

const onLoadMore = (): void => {
	loadMoreSystemLogs().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});
};

const onRefresh = (): void => {
	refreshSystemLogs().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});
};

const onClearSystemLogs = (): void => {
	// handle clear
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

onBeforeMount((): void => {
	fetchSystemLogs().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.SYSTEM_LOG_DETAIL) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): boolean => areLoading.value,
	(val: boolean): void => {
		if (!val && systemLogs.value === null) {
			throw new SystemException('Something went wrong');
		}
	}
);

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.SYSTEM_LOG_DETAIL) !== undefined;
	}
);

useMeta({
	title: t('systemModule.meta.systemLogs.list.title'),
});
</script>
