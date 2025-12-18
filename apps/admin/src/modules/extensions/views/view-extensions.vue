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

	<div class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden">
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
		/>
	</div>

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
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElDrawer, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { ListExtensions, ListExtensionsAdjust } from '../components/components';
import { useExtensionActions, useExtensionsDataSource } from '../composables/composables';
import { RouteNames } from '../extensions.constants';
import { ExtensionsException } from '../extensions.exceptions';
import type { IExtension } from '../store/extensions.store.types';

import type { IViewExtensionsProps } from './view-extensions.types';

defineOptions({
	name: 'ViewExtensions',
});

defineProps<IViewExtensionsProps>();

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
	resetFilter,
} = useExtensionsDataSource();
const { toggleEnabled } = useExtensionActions();

const showDrawer = ref<boolean>(false);
const viewMode = ref<'table' | 'cards'>('table');

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

const onToggleEnabled = async (type: IExtension['type'], enabled: boolean): Promise<void> => {
	await toggleEnabled(type, enabled);
};

const onResetFilters = (): void => {
	resetFilter();
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

onBeforeMount((): void => {
	fetchExtensions().catch((error: unknown): void => {
		const err = error as Error;

		throw new ExtensionsException('Something went wrong', err);
	});
});
</script>
