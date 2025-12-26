<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:view-dashboard"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('spacesModule.headings.overview') }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.overview') }}
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
		:heading="t('spacesModule.headings.overview')"
		:sub-heading="t('spacesModule.subHeadings.overview')"
		icon="mdi:view-dashboard"
	>
		<template #extra>
			<div class="flex gap-2">
				<el-button @click="onViewSpaces">
					<el-icon class="mr-1"><icon icon="mdi:format-list-bulleted" /></el-icon>
					{{ t('spacesModule.buttons.viewAll.title') }}
				</el-button>
				<el-button
					type="primary"
					@click="onAddSpace"
				>
					{{ t('spacesModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div class="p-4">
		<el-row :gutter="20">
			<el-col
				:xs="24"
				:sm="24"
				:md="10"
				:lg="9"
			>
				<div class="grid gap-4">
					<spaces-overview-stats
						:spaces="spaces"
						:loading="areLoading"
					/>

					<spaces-overview-quick-actions />
				</div>
			</el-col>

			<el-col
				:xs="24"
				:sm="24"
				:md="14"
				:lg="15"
			>
				<div class="grid gap-4 lt-md:mt-4">
					<spaces-overview-categories
						:spaces="spaces"
						:loading="areLoading"
					/>

					<spaces-overview-recent
						:spaces="recentSpaces"
						:loading="areLoading"
						@detail="onSpaceDetail"
					/>
				</div>
			</el-col>
		</el-row>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCol, ElIcon, ElMessage, ElRow } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import {
	SpacesOverviewCategories,
	SpacesOverviewQuickActions,
	SpacesOverviewRecent,
	SpacesOverviewStats,
} from '../components/components';
import { useSpaces } from '../composables';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

defineOptions({
	name: 'ViewSpacesOverview',
});

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('spacesModule.meta.spaces.overview.title'),
});

const { isMDDevice } = useBreakpoints();

const { spaces, fetching, firstLoadFinished, fetchSpaces } = useSpaces();

const areLoading = computed<boolean>((): boolean => {
	return fetching.value || !firstLoadFinished.value;
});

const recentSpaces = computed<ISpace[]>((): ISpace[] => {
	return [...spaces.value]
		.filter((space) => !space.draft)
		.sort((a, b) => {
			const dateA = a.updatedAt ?? a.createdAt;
			const dateB = b.updatedAt ?? b.createdAt;
			return dateB.getTime() - dateA.getTime();
		})
		.slice(0, 5);
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.overview'),
				route: router.resolve({ name: RouteNames.SPACES_OVERVIEW }),
			},
		];
	}
);

const onViewSpaces = (): void => {
	router.push({ name: RouteNames.SPACES });
};

const onAddSpace = (): void => {
	router.push({ name: RouteNames.SPACES_EDIT });
};

const onSpaceDetail = (id: ISpace['id']): void => {
	router.push({
		name: RouteNames.SPACE,
		params: { id },
	});
};

onBeforeMount((): void => {
	fetchSpaces().catch((): void => {
		ElMessage.error(t('spacesModule.messages.loadError'));
	});
});
</script>
