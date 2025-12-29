<template>
	<el-card
		v-loading="loading"
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<el-icon :size="18">
					<icon icon="mdi:tag-multiple" />
				</el-icon>
				{{ t('spacesModule.overview.categories.title') }}
			</div>
		</template>

		<div
			v-if="categoryCounts.length > 0"
			class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
		>
			<div
				v-for="item in categoryCounts"
				:key="item.category"
				class="flex items-center gap-2 p-2 rounded-md bg-[var(--el-fill-color-light)] hover:bg-[var(--el-fill-color)] transition-colors cursor-default"
			>
				<el-icon
					:size="20"
					class="color-[var(--el-color-primary)]"
				>
					<icon :icon="item.icon" />
				</el-icon>
				<div class="flex flex-col min-w-0">
					<span class="text-xs color-[var(--el-text-color-secondary)] truncate">
						{{ t(`spacesModule.fields.spaces.category.options.${item.category}`) }}
					</span>
					<span class="font-semibold">{{ item.count }}</span>
				</div>
			</div>
		</div>

		<el-empty
			v-else
			:description="t('spacesModule.overview.categories.empty')"
			:image-size="60"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElEmpty, ElIcon, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { SPACE_CATEGORY_TEMPLATES, type SpaceCategory } from '../spaces.constants';

import type { ISpacesOverviewCategoriesProps } from './spaces-overview-categories.types';

defineOptions({
	name: 'SpacesOverviewCategories',
});

const props = withDefaults(defineProps<ISpacesOverviewCategoriesProps>(), {
	spaces: () => [],
	loading: false,
});

const { t } = useI18n();

interface ICategoryCount {
	category: SpaceCategory;
	icon: string;
	count: number;
}

const categoryCounts = computed<ICategoryCount[]>((): ICategoryCount[] => {
	const counts: Record<string, number> = {};

	props.spaces
		.filter((space) => !space.draft && space.category)
		.forEach((space) => {
			if (space.category) {
				counts[space.category] = (counts[space.category] || 0) + 1;
			}
		});

	return Object.entries(counts)
		.map(([category, count]) => ({
			category: category as SpaceCategory,
			icon: SPACE_CATEGORY_TEMPLATES[category]?.icon || 'mdi:home',
			count,
		}))
		.sort((a, b) => b.count - a.count);
});
</script>
