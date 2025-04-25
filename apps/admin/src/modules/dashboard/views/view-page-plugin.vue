<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
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

	<view-header
		:heading="t('dashboardModule.headings.pages.detail', { page: page?.title })"
		:sub-heading="t('dashboardModule.subHeadings.pages.detail', { page: page?.title })"
		icon="mdi:monitor-dashboard"
	>
		<template #extra>
			<div
				id="page-manage-actions"
				class="flex items-center"
			/>
		</template>
	</view-header>

	<el-scrollbar
		v-if="isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2"
		view-class="overflow-hidden"
	>
		<router-view
			:key="props.id"
			v-slot="{ Component }"
		>
			<component
				:is="Component"
				v-if="page"
				:page="page"
			/>
		</router-view>
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
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElIcon, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints, useUuid } from '../../../common';
import { usePage } from '../composables/usePage';
import { RouteNames } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import type { IPage } from '../store/pages.store.types';

import type { IViewPagePluginProps } from './view-page-plugin.types';

defineOptions({
	name: 'ViewPagePlugin',
	inheritAttrs: false,
});

const props = defineProps<IViewPagePluginProps>();

const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { page, fetchPage, isLoading } = usePage({ id: props.id });

if (!validateUuid(props.id)) {
	throw new Error('Page identifier is not valid');
}

const mounted = ref<boolean>(false);

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

onBeforeMount((): void => {
	fetchPage().catch((error: unknown): void => {
		const err = error as Error;

		throw new DashboardException('Something went wrong', err);
	});
});

onMounted((): void => {
	mounted.value = true;
});

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
