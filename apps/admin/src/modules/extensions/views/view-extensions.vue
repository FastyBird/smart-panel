<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:puzzle"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('extensionsModule.headings.list') }}
		</template>

		<template #subtitle>
			{{ t('extensionsModule.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
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

	<view-header
		:heading="t('extensionsModule.headings.list')"
		:sub-heading="t('extensionsModule.subHeadings.list')"
		icon="mdi:puzzle"
	/>

	<el-tabs
		v-model="activeTab"
		class="grow-1 overflow-hidden flex-1 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-tab-pane
			name="extensions"
			class="h-full overflow-hidden flex flex-col gap-2"
		>
			<template #label>
				<div class="flex items-center gap-2">
					<icon icon="mdi:puzzle" />
					{{ t('extensionsModule.tabs.all') }}
				</div>
			</template>

			<list-extensions
				v-model:filters="filters"
				v-model:view-mode="viewMode"
				v-model:paginate-size="paginateSize"
				v-model:paginate-page="paginatePage"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="extensionsPaginated"
				:all-items="extensions"
				:total-rows="totalRows"
				:loading="areLoading"
				:filters-active="filtersActive"
				@toggle-enabled="onToggleEnabled"
				@detail="onExtensionDetail"
				@adjust-list="onAdjustList"
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
			/>
		</el-tab-pane>

		<el-tab-pane
			name="services"
			class="h-full overflow-hidden flex flex-col"
		>
			<template #label>
				<div class="flex items-center gap-2">
					<icon icon="mdi:cog-play" />
					{{ t('extensionsModule.tabs.services') }}
				</div>
			</template>

			<services-list
				v-model:active-kind="activeServiceKind"
				:services="services"
				:loading="areServicesLoading"
				:extension-names="serviceExtensionNames"
				:is-acting="isActingOnService"
				@start="onStartService"
				@stop="onStopService"
				@restart="onRestartService"
			/>
		</el-tab-pane>
	</el-tabs>

	<el-drawer
		v-model="showDrawer"
		:show-close="false"
		size="300px"
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

			<list-extensions-adjust
				v-if="showDrawer"
				v-model:filters="filters"
				:filters-active="filtersActive"
				@reset-filters="onResetFilters"
			/>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElDrawer, ElIcon, ElTabPane, ElTabs } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { ExtensionKind, ExtensionsModuleServiceOwnerKind } from '../../../openapi.constants';
import { ListExtensions, ListExtensionsAdjust, ServicesList } from '../components/components';
import { useExtensionActions, useExtensionsDataSource, useServiceActions, useServices } from '../composables/composables';
import { RouteNames } from '../extensions.constants';
import { ExtensionsException } from '../extensions.exceptions';
import type { IExtension } from '../store/extensions.store.types';

import type { IViewExtensionsProps } from './view-extensions.types';

defineOptions({
	name: 'ViewExtensions',
});

type ExtensionsPageTab = 'extensions' | 'services';

defineProps<IViewExtensionsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('extensionsModule.meta.extensions.list.title'),
});

const { isMDDevice } = useBreakpoints();

const {
	extensions,
	extensionsPaginated,
	totalRows,
	areLoading,
	fetchExtensions,
	filters,
	filtersActive,
	paginateSize,
	paginatePage,
	sortBy,
	sortDir,
	viewMode,
	resetFilter,
} = useExtensionsDataSource();
const { toggleEnabled, bulkEnable, bulkDisable } = useExtensionActions();

// Services
const { services, areLoading: areServicesLoading, fetchServices } = useServices();
const { startService, stopService, restartService, isActing } = useServiceActions();

const serviceExtensionNames = computed<Record<string, string>>(() => {
	return Object.fromEntries(
		extensions.value.map((extension) => [
			`${extension.kind === ExtensionKind.module ? ExtensionsModuleServiceOwnerKind.module : ExtensionsModuleServiceOwnerKind.plugin}:${extension.type}`,
			extension.name,
		])
	);
});

const showDrawer = ref<boolean>(false);
const servicesLoaded = ref<boolean>(false);

const isServiceKind = (value: unknown): value is ExtensionsModuleServiceOwnerKind => {
	return value === ExtensionsModuleServiceOwnerKind.module || value === ExtensionsModuleServiceOwnerKind.plugin;
};

const activeServiceKind = computed<ExtensionsModuleServiceOwnerKind>({
	get: (): ExtensionsModuleServiceOwnerKind => {
		return isServiceKind(route.query.serviceKind) ? route.query.serviceKind : ExtensionsModuleServiceOwnerKind.module;
	},
	set: (serviceKind: ExtensionsModuleServiceOwnerKind): void => {
		router.replace({
			query: {
				...route.query,
				tab: 'services',
				serviceKind,
			},
		});
	},
});

const activeTab = computed<ExtensionsPageTab>({
	get: (): ExtensionsPageTab => (route.query.tab === 'services' ? 'services' : 'extensions'),
	set: (tab: ExtensionsPageTab): void => {
		router.replace({
			query: {
				...route.query,
				tab,
				serviceKind: activeServiceKind.value,
			},
		});
	},
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('extensionsModule.breadcrumbs.extensions.list'),
				route: router.resolve({ name: RouteNames.EXTENSIONS }),
			},
		];
	}
);

// Normalize linked tab state and lazy load services when selected
watch(
	[activeTab, () => route.query.serviceKind],
	async ([newTab]) => {
		if (newTab !== 'services') {
			return;
		}

		if (!isServiceKind(route.query.serviceKind)) {
			router.replace({
				query: {
					...route.query,
					tab: 'services',
					serviceKind: activeServiceKind.value,
				},
			});
		}

		if (servicesLoaded.value) {
			return;
		}

		try {
			await fetchServices();
			servicesLoaded.value = true;
		} catch (error: unknown) {
			const err = error as Error;
			throw new ExtensionsException('Failed to load services', err);
		}
	},
	{ immediate: true }
);

const onToggleEnabled = async (type: IExtension['type'], enabled: boolean): Promise<void> => {
	await toggleEnabled(type, enabled);
};

const onResetFilters = (): void => {
	resetFilter();
};

const onBulkAction = (action: string, items: IExtension[]): void => {
	switch (action) {
		case 'enable':
			bulkEnable(items);
			break;
		case 'disable':
			bulkDisable(items);
			break;
	}
};

const onExtensionDetail = (type: IExtension['type']): void => {
	router.push({
		name: RouteNames.EXTENSION_DETAIL,
		params: { type },
	});
};

const onAdjustList = (): void => {
	showDrawer.value = true;
};

const onCloseDrawer = (done?: () => void): void => {
	showDrawer.value = false;
	done?.();
};

// Service actions
const isActingOnService = (extensionKind: ExtensionsModuleServiceOwnerKind, extensionType: string, serviceId: string): boolean => {
	return isActing(extensionKind, extensionType, serviceId);
};

const onStartService = async (extensionKind: ExtensionsModuleServiceOwnerKind, extensionType: string, serviceId: string): Promise<void> => {
	await startService(extensionKind, extensionType, serviceId);
};

const onStopService = async (extensionKind: ExtensionsModuleServiceOwnerKind, extensionType: string, serviceId: string): Promise<void> => {
	await stopService(extensionKind, extensionType, serviceId);
};

const onRestartService = async (extensionKind: ExtensionsModuleServiceOwnerKind, extensionType: string, serviceId: string): Promise<void> => {
	await restartService(extensionKind, extensionType, serviceId);
};

onBeforeMount((): void => {
	fetchExtensions().catch((error: unknown): void => {
		const err = error as Error;

		throw new ExtensionsException('Something went wrong', err);
	});
});
</script>
